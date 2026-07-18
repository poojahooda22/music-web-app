"use client";

import { Loader2 } from "lucide-react";

import { useSearch } from "@/lib/use-search";
import { useView } from "@/lib/view-store";
import { SongRow } from "../song-row";
import { Button } from "../ui/button";

export function SearchView({ q }: { q: string }) {
  const { data, isLoading, isError, refetch } = useSearch(q);
  const setView = useView((s) => s.setView);

  const songs = data?.songs ?? [];
  const artistsR = data?.artists ?? [];
  const albumsR = data?.albums ?? [];
  const empty =
    !isLoading && !isError && songs.length === 0 && artistsR.length === 0 && albumsR.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        <p className="text-muted-foreground text-sm">Results for &ldquo;{q}&rdquo;</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-24">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      )}
      {isError && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-destructive text-sm">Search failed — the request didn&rsquo;t go through.</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}
      {empty && <p className="text-muted-foreground text-sm">No results for &ldquo;{q}&rdquo;.</p>}

      {artistsR.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Artists</h2>
          <div className="flex flex-wrap gap-2">
            {artistsR.map((a) => (
              <button
                key={a.id}
                onClick={() => setView({ kind: "artist", name: a.name })}
                className="bg-card hover:bg-accent border-border rounded-full border px-4 py-2 text-sm font-medium transition-colors"
              >
                {a.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {albumsR.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Albums</h2>
          <div className="flex flex-wrap gap-2">
            {albumsR.map((a) => (
              <button
                key={a.id}
                onClick={() => setView({ kind: "album", id: a.id, title: a.title })}
                className="bg-card hover:bg-accent border-border rounded-full border px-4 py-2 text-sm transition-colors"
              >
                <span className="font-medium">{a.title}</span>
                {a.artist ? <span className="text-muted-foreground"> · {a.artist}</span> : null}
              </button>
            ))}
          </div>
        </section>
      )}

      {songs.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Songs</h2>
          <div className="space-y-0.5">
            {songs.map((t, i) => (
              <SongRow key={t.id} tracks={songs} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}