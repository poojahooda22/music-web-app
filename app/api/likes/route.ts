import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { likes, songs, artists, artistSongs, albums } from "@/db/schema";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE ?? "").replace(/\/$/, "");

async function requireUser() {
  const { data: session } = await auth.getSession();
  return session?.user ?? null;
}

// The signed-in user's liked songs, most recently liked first.
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: songs.id,
      title: songs.title,
      genre: songs.genre,
      duration: songs.durationS,
      fileUrl: songs.fileUrl,
      imageUrl: songs.imageUrl,
      attribution: songs.attribution,
      license: songs.license,
      albumId: songs.albumId,
      albumTitle: albums.title,
      artist: artists.name,
      addedAt: likes.likedAt,
    })
    .from(likes)
    .innerJoin(songs, eq(songs.id, likes.songId))
    .leftJoin(artistSongs, eq(artistSongs.songId, songs.id))
    .leftJoin(artists, eq(artists.id, artistSongs.artistId))
    .leftJoin(albums, eq(albums.id, songs.albumId))
    .where(eq(likes.userId, user.id))
    .orderBy(desc(likes.likedAt));

  const tracks = rows.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist ?? "Unknown Artist",
    genre: r.genre,
    duration: r.duration,
    imageUrl: r.imageUrl,
    albumId: r.albumId,
    albumTitle: r.albumTitle,
    license: r.license,
    attribution: r.attribution,
    addedAt: r.addedAt,
    url: `${PUBLIC_BASE}/${r.fileUrl}`,
  }));

  return NextResponse.json({ tracks });
}

// Like a song. The (user_id, song_id) composite primary key makes this
// idempotent at the database — a double-tap can never create two likes.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const songId = Number(body?.songId);
  if (!Number.isInteger(songId) || songId <= 0) {
    return NextResponse.json({ error: "Invalid song id" }, { status: 400 });
  }
  const [song] = await db.select({ id: songs.id }).from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });

  const inserted = await db
    .insert(likes)
    .values({ userId: user.id, songId })
    .onConflictDoNothing({ target: [likes.userId, likes.songId] })
    .returning({ songId: likes.songId });

  return NextResponse.json({ liked: true, added: !!inserted[0] }, { status: inserted[0] ? 201 : 200 });
}

// Unlike a song (?songId=). Removing a song that isn't liked is a no-op.
export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const songId = Number(req.nextUrl.searchParams.get("songId"));
  if (!Number.isInteger(songId) || songId <= 0) {
    return NextResponse.json({ error: "Invalid song id" }, { status: 400 });
  }

  const removed = await db
    .delete(likes)
    .where(and(eq(likes.userId, user.id), eq(likes.songId, songId)))
    .returning({ songId: likes.songId });

  return NextResponse.json({ liked: false, removed: !!removed[0] });
}