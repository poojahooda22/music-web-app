/**
 * Ingest worker — the ONLY component that fetches upstream (Jamendo).
 * Loop: fetch CC tracks -> download mp3 -> R2 -> idempotent upsert into Neon -> advance watermark.
 * Idempotent (keyed on jamendo_id), resumable, off the request path.
 *
 * Run:  bun run worker/ingest.ts        (INGEST_LIMIT env overrides the batch size)
 */

import { S3Client } from "bun";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { artists, albums, songs, artistSongs, syncState } from "../db/schema";
import {
  fetchTracks,
  firstGenre,
  attribution,
  safeReleaseDate,
  type JamendoTrack,
} from "./jamendo";

const r2 = new S3Client({
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  bucket: process.env.R2_BUCKET!,
  endpoint: process.env.R2_ENDPOINT!,
  region: "auto",
});

const GENRES = [
  "rock", "pop", "electronic", "jazz", "classical", "hiphop", "ambient",
  "folk", "metal", "lounge", "funk", "reggae", "blues", "soundtrack",
];
const PER_GENRE = Number(process.env.INGEST_PER_GENRE ?? 8);

async function upsertArtist(name: string): Promise<number> {
  const existing = await db
    .select({ id: artists.id })
    .from(artists)
    .where(eq(artists.name, name))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const inserted = await db.insert(artists).values({ name }).returning({ id: artists.id });
  return inserted[0].id;
}

async function upsertAlbum(title: string, artistId: number): Promise<number | null> {
  if (!title) return null;
  const existing = await db
    .select({ id: albums.id })
    .from(albums)
    .where(eq(albums.title, title))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const inserted = await db
    .insert(albums)
    .values({ title, artistId })
    .returning({ id: albums.id });
  return inserted[0].id;
}

async function ingestTrack(
  t: JamendoTrack,
  fallbackGenre: string | null = null,
): Promise<"inserted" | "skipped"> {
  const jamendoId = String(t.id);

  const already = await db
    .select({ id: songs.id })
    .from(songs)
    .where(eq(songs.jamendoId, jamendoId))
    .limit(1);
  if (already[0]) return "skipped";

  const downloadUrl = t.audiodownload || t.audio;
  if (!downloadUrl) return "skipped";

  // Download the mp3 and store it in R2 under a stable, idempotent key.
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  const key = `tracks/${jamendoId}.mp3`;
  await r2.write(key, bytes, { type: "audio/mpeg" });

  const artistId = await upsertArtist(t.artist_name || "Unknown Artist");
  const albumId = await upsertAlbum(t.album_name, artistId);

  const inserted = await db
    .insert(songs)
    .values({
      title: t.name,
      albumId,
      durationS: t.duration ?? null,
      genre: firstGenre(t) ?? fallbackGenre,
      fileUrl: key,
      imageUrl: t.image || null,
      releaseDate: safeReleaseDate(t.releasedate),
      jamendoId,
      license: t.license_ccurl || "unknown",
      attribution: attribution(t),
    })
    .onConflictDoNothing({ target: songs.jamendoId })
    .returning({ id: songs.id });

  if (inserted[0]) {
    await db
      .insert(artistSongs)
      .values({ songId: inserted[0].id, artistId })
      .onConflictDoNothing();
  }
  return "inserted";
}

async function main() {
  console.log(
    `Ingesting ~${PER_GENRE} tracks/genre across ${GENRES.length} genres → R2 + Neon…`,
  );

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const genre of GENRES) {
    let tracks: JamendoTrack[];
    try {
      tracks = await fetchTracks({ limit: PER_GENRE, genre });
    } catch (err) {
      console.error(`  ! fetch genre "${genre}": ${err instanceof Error ? err.message : err}`);
      continue;
    }
    console.log(`[${genre}] fetched ${tracks.length}`);

    for (const t of tracks) {
      try {
        const result = await ingestTrack(t, genre);
        if (result === "inserted") {
          inserted++;
          console.log(`  + [${genre}] ${t.artist_name} — ${t.name}`);
        } else {
          skipped++;
        }
      } catch (err) {
        failed++;
        console.error(`  ! ${t.id} "${t.name}": ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // Advance the watermark on success (incremental runs pick up from here).
  const now = new Date();
  await db
    .insert(syncState)
    .values({ source: "jamendo", lastSynced: now })
    .onConflictDoUpdate({
      target: syncState.source,
      set: { lastSynced: now, updatedAt: now },
    });

  console.log(`Done. inserted=${inserted} skipped=${skipped} failed=${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });