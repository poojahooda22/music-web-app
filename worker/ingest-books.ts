/**
 * Audiobook ingest worker — the ONLY component that fetches LibriVox/archive.org.
 * For each curated title: fetch metadata -> download chapter mp3s -> R2 ->
 * idempotent upsert into Neon. LibriVox is public domain, so the audio is
 * re-hosted (same as the Jamendo music path) — unlike podcasts/radio later.
 * Idempotent + resumable at CHAPTER granularity; rate-limited for archive.org.
 *
 * Run:  bun run worker/ingest-books.ts
 *   INGEST_BOOK_LIMIT  max books to ingest this run (default 40)
 *   MAX_CHAPTERS       skip a whole book with more chapters than this (default 50)
 *   RATE_MS            delay between chapter downloads (default 400)
 */

import { S3Client } from "bun";
import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { books, bookChapters, syncState } from "../db/schema";
import {
  fetchBookList,
  fetchBookById,
  bookAuthor,
  bookReader,
  bookCoverUrl,
  bookAttribution,
  LIBRIVOX_LICENSE,
  USER_AGENT,
  type LibriVoxBook,
} from "./librivox";

const r2 = new S3Client({
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  bucket: process.env.R2_BUCKET!,
  endpoint: process.env.R2_ENDPOINT!,
  region: "auto",
});

const BOOK_LIMIT = Number(process.env.INGEST_BOOK_LIMIT ?? 40);
const MAX_CHAPTERS = Number(process.env.MAX_CHAPTERS ?? 50);
const RATE_MS = Number(process.env.RATE_MS ?? 400);

// Page size for the lightweight catalog listing we page through. Low offsets are
// LibriVox's earliest recordings — which skew to the well-known classics.
const PAGE = 50;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Download with exponential backoff on archive.org throttling (503/429). */
async function download(url: string, attempt = 0): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 503 || res.status === 429) {
    if (attempt >= 4) throw new Error(`throttled HTTP ${res.status} after ${attempt} retries`);
    await sleep(1000 * 2 ** attempt); // 1s, 2s, 4s, 8s
    return download(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Insert the book row (or return the id of an existing one) — idempotent on librivox_id. */
async function upsertBook(b: LibriVoxBook): Promise<number> {
  const existing = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.librivoxId, b.id))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const inserted = await db
    .insert(books)
    .values({
      librivoxId: b.id,
      title: b.title.trim(),
      author: bookAuthor(b),
      reader: bookReader(b),
      description: b.description?.trim() || null,
      coverUrl: bookCoverUrl(b),
      language: b.language ?? null,
      totalDurationS: b.totaltimesecs ?? null,
      license: LIBRIVOX_LICENSE,
      attribution: bookAttribution(b),
    })
    .onConflictDoNothing({ target: books.librivoxId })
    .returning({ id: books.id });
  if (inserted[0]) return inserted[0].id;

  // Lost an insert race — re-select the winner's id.
  const again = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.librivoxId, b.id))
    .limit(1);
  return again[0].id;
}

async function chapterExists(bookId: number, position: number): Promise<boolean> {
  const rows = await db
    .select({ id: bookChapters.id })
    .from(bookChapters)
    .where(and(eq(bookChapters.bookId, bookId), eq(bookChapters.position, position)))
    .limit(1);
  return !!rows[0];
}

async function ingestBook(b: LibriVoxBook): Promise<{ chapters: number } | "skipped"> {
  const sections = (b.sections ?? []).filter((s) => s.listen_url);
  if (!sections.length) return "skipped";
  if (sections.length > MAX_CHAPTERS) {
    console.log(`  ~ skip "${b.title.trim()}" (${sections.length} chapters > ${MAX_CHAPTERS})`);
    return "skipped";
  }

  const bookId = await upsertBook(b);
  let added = 0;
  for (const s of sections) {
    const position = Number(s.section_number);
    if (!Number.isFinite(position)) continue;
    if (await chapterExists(bookId, position)) continue;

    const bytes = await download(s.listen_url);
    const key = `audiobooks/${b.id}/${position}.mp3`;
    await r2.write(key, bytes, { type: "audio/mpeg" });

    await db
      .insert(bookChapters)
      .values({
        bookId,
        title: s.title.trim() || `Chapter ${position}`,
        position,
        durationS: Number(s.playtime) || null,
        fileUrl: key,
        librivoxSectionId: s.id,
      })
      .onConflictDoNothing({ target: [bookChapters.bookId, bookChapters.position] });
    added++;
    await sleep(RATE_MS); // be polite to archive.org
  }
  return { chapters: added };
}

async function main() {
  console.log(
    `Ingesting up to ${BOOK_LIMIT} English audiobooks (≤${MAX_CHAPTERS} chapters) from LibriVox → R2 + Neon…`,
  );
  let ingested = 0;
  let chapters = 0;
  let skipped = 0;
  let failed = 0;
  let offset = 0;

  while (ingested < BOOK_LIMIT) {
    let page: LibriVoxBook[];
    try {
      page = await fetchBookList({ limit: PAGE, offset });
    } catch (err) {
      console.error(`  ! list offset=${offset}: ${err instanceof Error ? err.message : err}`);
      break;
    }
    if (!page.length) break; // reached the end of the catalog
    offset += PAGE;

    for (const light of page) {
      if (ingested >= BOOK_LIMIT) break;

      // Quality filter on the lightweight record: English, complete, not a monster.
      const secs = Number(light.num_sections);
      if (light.language !== "English") continue;
      if (!Number.isFinite(secs) || secs < 1 || secs > MAX_CHAPTERS) continue;

      const have = await db
        .select({ id: books.id })
        .from(books)
        .where(eq(books.librivoxId, light.id))
        .limit(1);
      if (have[0]) {
        skipped++;
        continue;
      }

      // The lightweight record has no sections — fetch the full one to ingest.
      let full: LibriVoxBook | null;
      try {
        full = await fetchBookById(light.id);
      } catch (err) {
        failed++;
        console.error(`  ! detail ${light.id}: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      if (!full || !(full.sections ?? []).length) {
        skipped++;
        continue;
      }

      try {
        const result = await ingestBook(full);
        if (result === "skipped") {
          skipped++;
          continue;
        }
        ingested++;
        chapters += result.chapters;
        console.log(`  + ${full.title.trim()} — ${result.chapters} chapters`);
      } catch (err) {
        failed++;
        console.error(
          `  ! ingest ${light.id} "${light.title.trim()}": ${err instanceof Error ? err.message : err}`,
        );
      }
      await sleep(RATE_MS); // pace archive.org between books
    }
  }

  // Advance the watermark on success (incremental runs pick up from here).
  const now = new Date();
  await db
    .insert(syncState)
    .values({ source: "librivox", lastSynced: now })
    .onConflictDoUpdate({
      target: syncState.source,
      set: { lastSynced: now, updatedAt: now },
    });

  console.log(`Done. books=${ingested} chapters=${chapters} skipped=${skipped} failed=${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });