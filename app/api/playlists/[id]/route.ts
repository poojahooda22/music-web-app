import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { playlists, playlistItems, songs, artists, artistSongs, albums } from "@/db/schema";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE ?? "").replace(/\/$/, "");

async function requireUserAndId(params: Promise<{ id: string }>) {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  const { id } = await params;
  const playlistId = Number(id);
  const valid = Number.isInteger(playlistId) && playlistId > 0;
  return { user: user ?? null, playlistId, valid };
}

// One playlist + its tracks, in position order. Ownership is part of the
// predicate (right user AND right row), so another user's playlist id 404s.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, playlistId, valid } = await requireUserAndId(params);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!valid) return NextResponse.json({ error: "Invalid playlist id" }, { status: 400 });

  const [playlist] = await db
    .select({ id: playlists.id, name: playlists.name })
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerId, user.id)))
    .limit(1);
  if (!playlist) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
      position: playlistItems.position,
      addedAt: playlistItems.addedAt,
    })
    .from(playlistItems)
    .innerJoin(songs, eq(songs.id, playlistItems.songId))
    .leftJoin(artistSongs, eq(artistSongs.songId, songs.id))
    .leftJoin(artists, eq(artists.id, artistSongs.artistId))
    .leftJoin(albums, eq(albums.id, songs.albumId))
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(playlistItems.position);

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

  return NextResponse.json({ playlist, tracks });
}

// Rename. Ownership lives in the UPDATE predicate — one guarded statement.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, playlistId, valid } = await requireUserAndId(params);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!valid) return NextResponse.json({ error: "Invalid playlist id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const [updated] = await db
    .update(playlists)
    .set({ name })
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerId, user.id)))
    .returning({ id: playlists.id, name: playlists.name });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ playlist: updated });
}

// Delete the playlist and its items. Items go first (the FK has no cascade);
// a crash between the two deletes leaves an empty playlist — a retryable,
// harmless state (the neon-http driver has no transactions; sequenced deletes
// are the documented compromise at this tier).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, playlistId, valid } = await requireUserAndId(params);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!valid) return NextResponse.json({ error: "Invalid playlist id" }, { status: 400 });

  const [owned] = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerId, user.id)))
    .limit(1);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(playlistItems).where(eq(playlistItems.playlistId, playlistId));
  const deleted = await db
    .delete(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerId, user.id)))
    .returning({ id: playlists.id });
  if (!deleted[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ deleted: true });
}