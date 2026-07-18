import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { books, bookChapters } from "@/db/schema";
import type { Track } from "@/lib/player-store";

export const dynamic = "force-dynamic";

const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE ?? "").replace(/\/$/, "");

// One book + its chapters as playable Tracks (position order). Public, like the
// list route. Each chapter maps to the shared Track shape with kind:"audiobook"
// so the existing player/queue can play it unchanged; the kind flag keeps the
// player from recording plays/likes against the songs table (see player-store).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isInteger(bookId) || bookId <= 0) {
    return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
  }

  const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const chapters = await db
    .select()
    .from(bookChapters)
    .where(eq(bookChapters.bookId, bookId))
    .orderBy(asc(bookChapters.position));

  const tracks: Track[] = chapters.map((c) => ({
    id: c.id,
    kind: "audiobook",
    title: c.title,
    artist: book.author ?? "Unknown Author",
    artistId: null,
    genre: null,
    duration: c.durationS,
    imageUrl: book.coverUrl,
    albumId: null,
    albumTitle: book.title,
    license: book.license,
    attribution: book.attribution,
    url: `${PUBLIC_BASE}/${c.fileUrl}`,
  }));

  return NextResponse.json({
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      reader: book.reader,
      description: book.description,
      coverUrl: book.coverUrl,
      language: book.language,
      totalDurationS: book.totalDurationS,
      attribution: book.attribution,
    },
    tracks,
  });
}