import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { playlists, playlistItems, songs } from "@/db/schema";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

async function requireUser() {
  const { data: session } = await auth.getSession();
  return session?.user ?? null;
}

// The signed-in user's playlists, newest first, with item counts.
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      createdAt: playlists.createdAt,
      count: sql<number>`count(${playlistItems.id})::int`,
    })
    .from(playlists)
    .leftJoin(playlistItems, eq(playlistItems.playlistId, playlists.id))
    .where(eq(playlists.ownerId, user.id))
    .groupBy(playlists.id)
    .orderBy(desc(playlists.createdAt));

  return NextResponse.json({ playlists: rows });
}

// Create a playlist. Defaults to "My Playlist #n" when no name is given.
// An optional songId seeds the new playlist in the same request, so the
// client's "add to new playlist" is one call with one failure mode (no
// orphan-playlist window between a create call and a separate add call).
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let name =
    typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 100) : null;

  let songId: number | null = null;
  if (body?.songId !== undefined) {
    songId = Number(body.songId);
    if (!Number.isInteger(songId) || songId <= 0) {
      return NextResponse.json({ error: "Invalid song id" }, { status: 400 });
    }
    const [song] = await db.select({ id: songs.id }).from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  if (!name) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(playlists)
      .where(eq(playlists.ownerId, user.id));
    name = `My Playlist #${n + 1}`;
  }

  const [created] = await db
    .insert(playlists)
    .values({ ownerId: user.id, name })
    .returning({ id: playlists.id, name: playlists.name });

  if (songId != null) {
    await db
      .insert(playlistItems)
      .values({ playlistId: created.id, songId, position: 1 })
      .onConflictDoNothing({ target: [playlistItems.playlistId, playlistItems.songId] });
  }

  return NextResponse.json(
    { playlist: { ...created, count: songId != null ? 1 : 0 } },
    { status: 201 },
  );
}