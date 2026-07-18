"use client";

import Image from "next/image";
import { ChevronLeft, Users } from "lucide-react";

import { type Track } from "@/lib/player-store";
import { useSongs } from "@/lib/use-songs";
import { useView } from "@/lib/view-store";
import { GenreCircle, groupByGenre } from "../browse";
import { SongTable } from "../song-table";

/** All genres as circular cards — the "Show all" page for Browse by genre. */
export function GenresView() {
  const { data: songs = [] } = useSongs();
  const setView = useView((s) => s.setView);
  const genres = groupByGenre(songs);
  return (
    <div>
      <button
        onClick={() => setView({ kind: "home" })}
        className="text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" /> Back
      </button>
      <h1 className="text-2xl font-bold tracking-tight">Genres</h1>
      <p className="text-muted-foreground mb-4 text-sm">{genres.length} genres</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {genres.map(([genre, list]) => (
          <GenreCircle key={genre} genre={genre} list={list} align="center" className="w-full" />
        ))}
      </div>
    </div>
  );
}

export function SongsView() {
  const { data: songs = [] } = useSongs();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">All songs</h1>
      <SongTable tracks={songs} />
    </div>
  );
}

export function ArtistsView() {
  const { data: songs = [] } = useSongs();
  const setView = useView((s) => s.setView);

  const byArtist = new Map<string, Track[]>();
  for (const s of songs) {
    if (!byArtist.has(s.artist)) byArtist.set(s.artist, []);
    byArtist.get(s.artist)!.push(s);
  }
  const artists = [...byArtist.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Artists</h1>
      <p className="text-muted-foreground mb-4 text-sm">{artists.length} artists</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {artists.map(([name, list]) => {
          const img = list.find((t) => t.imageUrl)?.imageUrl;
          return (
            <button
              key={name}
              onClick={() => setView({ kind: "artist", name })}
              className="bg-card hover:bg-accent/60 border-border focus-visible:ring-ring/50 flex flex-col items-center gap-3 rounded-xl border p-4 text-center transition-colors outline-none focus-visible:ring-2"
            >
              <div className="bg-muted size-24 shrink-0 overflow-hidden rounded-full">
                {img ? (
                  <Image src={img} alt={name} width={96} height={96} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Users className="text-muted-foreground size-8" />
                  </div>
                )}
              </div>
              <div className="min-w-0 self-stretch">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="text-muted-foreground text-xs">{list.length} songs</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}