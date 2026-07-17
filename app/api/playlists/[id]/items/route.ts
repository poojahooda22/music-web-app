import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { playlists, playlistItems, songs } from "@/db/schema";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

// Add a song to a playlist the signed-in user owns. Idempotency is enforced by
// the database — the (playlist_id, song_id) unique index turns a double-tap,
// retry, or concurrent add into a no-op ({ added: false }) via onConflictDoNothing.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const playlistId = Number(id);
  const body = await req.json().catch(() => ({}));
  const songId = Number(body?.songId);
  if (!Number.isInteger(playlistId) || playlistId <= 0 || !Number.isInteger(songId) || songId <= 0) {
    return NextResponse.json({ error: "Invalid playlist or song id" }, { status: 400 });
  }

  const [playlist] = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerId, user.id)))
    .limit(1);
  if (!playlist) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [song] = await db.select({ id: songs.id }).from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });

  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${playlistItems.position}), 0)::int` })
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlistId));

  const inserted = await db
    .insert(playlistItems)
    .values({ playlistId, songId, position: maxPos + 1 })
    .onConflictDoNothing({ target: [playlistItems.playlistId, playlistItems.songId] })
    .returning({ id: playlistItems.id });

  if (!inserted[0]) return NextResponse.json({ added: false });
  return NextResponse.json({ added: true }, { status: 201 });
}

// Remove a song from a playlist the signed-in user owns (?songId=).
// Removing a song that isn't in the playlist is a no-op ({ removed: false }).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const playlistId = Number(id);
  const songId = Number(req.nextUrl.searchParams.get("songId"));
  if (!Number.isInteger(playlistId) || playlistId <= 0 || !Number.isInteger(songId) || songId <= 0) {
    return NextResponse.json({ error: "Invalid playlist or song id" }, { status: 400 });
  }

  const [playlist] = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerId, user.id)))
    .limit(1);
  if (!playlist) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const removed = await db
    .delete(playlistItems)
    .where(and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.songId, songId)))
    .returning({ id: playlistItems.id });

  return NextResponse.json({ removed: !!removed[0] });
}