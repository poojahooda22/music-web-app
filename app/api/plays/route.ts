import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { plays, songs, artists, artistSongs, albums } from "@/db/schema";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE ?? "").replace(/\/$/, "");

async function requireUser() {
  const { data: session } = await auth.getSession();
  return session?.user ?? null;
}

// Record a play (fired when a track starts). Append-only; the FK guards a bad id.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const songId = Number(body?.songId);
  if (!Number.isInteger(songId) || songId <= 0) {
    return NextResponse.json({ error: "Invalid song id" }, { status: 400 });
  }

  await db.insert(plays).values({ userId: user.id, songId });
  return NextResponse.json({ recorded: true }, { status: 201 });
}

// Top tracks over the last 30 days for the signed-in user, most-played first.
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
      artistId: artists.id,
      playCount: sql<number>`count(*)::int`,
    })
    .from(plays)
    .innerJoin(songs, eq(songs.id, plays.songId))
    .leftJoin(artistSongs, eq(artistSongs.songId, songs.id))
    .leftJoin(artists, eq(artists.id, artistSongs.artistId))
    .leftJoin(albums, eq(albums.id, songs.albumId))
    .where(and(eq(plays.userId, user.id), sql`${plays.playedAt} > now() - interval '30 days'`))
    .groupBy(songs.id, artists.name, artists.id, albums.title)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  const tracks = rows.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist ?? "Unknown Artist",
    artistId: r.artistId,
    genre: r.genre,
    duration: r.duration,
    imageUrl: r.imageUrl,
    albumId: r.albumId,
    albumTitle: r.albumTitle,
    license: r.license,
    attribution: r.attribution,
    playCount: r.playCount,
    url: `${PUBLIC_BASE}/${r.fileUrl}`,
  }));

  return NextResponse.json({ tracks });
}