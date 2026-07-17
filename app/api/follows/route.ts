import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { follows, artists, artistSongs, songs } from "@/db/schema";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

async function requireUser() {
  const { data: session } = await auth.getSession();
  return session?.user ?? null;
}

// The artists the signed-in user follows — ids (cheap button state) plus full
// rows (name + image) for the profile "Following" section, in one round-trip.
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Artists have no images from ingest, so fall back to one of the artist's
  // song covers (same convention the artist page uses).
  const rows = await db
    .select({
      id: artists.id,
      name: artists.name,
      imageUrl: sql<string | null>`coalesce(${artists.imageUrl}, max(${songs.imageUrl}))`,
    })
    .from(follows)
    .innerJoin(artists, eq(artists.id, follows.artistId))
    .leftJoin(artistSongs, eq(artistSongs.artistId, artists.id))
    .leftJoin(songs, eq(songs.id, artistSongs.songId))
    .where(eq(follows.userId, user.id))
    .groupBy(artists.id, artists.name, artists.imageUrl)
    .orderBy(artists.name);

  return NextResponse.json({ artistIds: rows.map((r) => r.id), artists: rows });
}

// Follow an artist. The (user_id, artist_id) composite primary key makes this
// idempotent — a double-tap can never create two rows.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const artistId = Number(body?.artistId);
  if (!Number.isInteger(artistId) || artistId <= 0) {
    return NextResponse.json({ error: "Invalid artist id" }, { status: 400 });
  }
  const [artist] = await db
    .select({ id: artists.id })
    .from(artists)
    .where(eq(artists.id, artistId))
    .limit(1);
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const inserted = await db
    .insert(follows)
    .values({ userId: user.id, artistId })
    .onConflictDoNothing({ target: [follows.userId, follows.artistId] })
    .returning({ artistId: follows.artistId });

  return NextResponse.json({ following: true, added: !!inserted[0] }, { status: inserted[0] ? 201 : 200 });
}

// Unfollow an artist (?artistId=). Unfollowing one not followed is a no-op.
export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const artistId = Number(req.nextUrl.searchParams.get("artistId"));
  if (!Number.isInteger(artistId) || artistId <= 0) {
    return NextResponse.json({ error: "Invalid artist id" }, { status: 400 });
  }

  const removed = await db
    .delete(follows)
    .where(and(eq(follows.userId, user.id), eq(follows.artistId, artistId)))
    .returning({ artistId: follows.artistId });

  return NextResponse.json({ following: false, removed: !!removed[0] });
}