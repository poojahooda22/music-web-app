import { NextRequest, NextResponse } from "next/server";
import { eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { songs, artists, artistSongs, albums } from "@/db/schema";

export const dynamic = "force-dynamic";

const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE ?? "").replace(/\/$/, "");

/** Escape LIKE wildcards so user input matches literally. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

// Case-insensitive substring search across song titles, artist names, and album
// titles. ILIKE over the full catalog is the Tier-1 implementation (hundreds of
// rows); the upgrade path is pg_trgm/FTS indexes before the catalog reaches ~100k.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) {
    return NextResponse.json({ songs: [], artists: [], albums: [] });
  }
  const pattern = `%${escapeLike(q)}%`;

  // The three result sets are independent — run them as concurrent round-trips
  // (Promise.all) instead of serially. Over neon-http each query is its own
  // ~250ms hop, so serial = 3× the latency of parallel for identical work.
  const [songRows, artistRows, albumRows] = await Promise.all([
    db
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
      })
      .from(songs)
      .leftJoin(artistSongs, eq(artistSongs.songId, songs.id))
      .leftJoin(artists, eq(artists.id, artistSongs.artistId))
      .leftJoin(albums, eq(albums.id, songs.albumId))
      // Match song title, artist, album, AND genre — so "rock" finds every
      // track tagged rock, not just ones with "rock" in the title.
      .where(
        or(
          ilike(songs.title, pattern),
          ilike(artists.name, pattern),
          ilike(albums.title, pattern),
          ilike(songs.genre, pattern),
        ),
      )
      // Deterministic tiering: a title hit outranks an artist hit outranks the rest.
      .orderBy(
        sql`case when ${songs.title} ilike ${pattern} then 0 when ${artists.name} ilike ${pattern} then 1 else 2 end`,
        songs.title,
      )
      .limit(100),

    db
      .select({ id: artists.id, name: artists.name, imageUrl: artists.imageUrl })
      .from(artists)
      .where(ilike(artists.name, pattern))
      .limit(12),

    db
      .select({ id: albums.id, title: albums.title, artist: artists.name })
      .from(albums)
      .leftJoin(artists, eq(artists.id, albums.artistId))
      .where(ilike(albums.title, pattern))
      .limit(12),
  ]);

  return NextResponse.json({
    songs: songRows.map((r) => ({
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
      url: `${PUBLIC_BASE}/${r.fileUrl}`,
    })),
    artists: artistRows,
    albums: albumRows,
  });
}