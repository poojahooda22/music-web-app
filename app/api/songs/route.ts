import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { songs, artists, artistSongs, albums } from "@/db/schema";

export const dynamic = "force-dynamic";

const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE ?? "").replace(/\/$/, "");

// Read route: metadata from Neon + the CDN URL. The browser streams the audio
// straight from the CDN — this route never proxies the bytes.
export async function GET() {
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
    })
    .from(songs)
    .leftJoin(artistSongs, eq(artistSongs.songId, songs.id))
    .leftJoin(artists, eq(artists.id, artistSongs.artistId))
    .leftJoin(albums, eq(albums.id, songs.albumId))
    .orderBy(desc(songs.ingestedAt))
    .limit(500);

  const data = rows.map((r) => ({
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
    url: `${PUBLIC_BASE}/${r.fileUrl}`,
  }));

  return NextResponse.json({ songs: data });
}
