import { NextResponse } from "next/server";
import { count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { books, bookChapters } from "@/db/schema";

export const dynamic = "force-dynamic";

// Public catalog route (like /api/songs) — audiobooks are open browse content.
// Only books that actually have chapters are listed.
export async function GET() {
  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      reader: books.reader,
      coverUrl: books.coverUrl,
      language: books.language,
      totalDurationS: books.totalDurationS,
      attribution: books.attribution,
      chapters: count(bookChapters.id),
    })
    .from(books)
    .leftJoin(bookChapters, eq(bookChapters.bookId, books.id))
    .groupBy(books.id)
    .having(sql`count(${bookChapters.id}) > 0`)
    .orderBy(desc(books.ingestedAt))
    .limit(200);

  return NextResponse.json({ books: rows });
}