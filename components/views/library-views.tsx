"use client";

import { Heart, ListMusic, Loader2, Plus } from "lucide-react";

import { useLikes } from "@/lib/use-likes";
import { useCreatePlaylist, usePlaylist, usePlaylists } from "@/lib/use-playlists";
import { useView } from "@/lib/view-store";
import { DetailView } from "../detail-view";
import { PlaylistMenu } from "../playlist-menu";
import { Button } from "../ui/button";

export function PlaylistView({ id, name }: { id: number; name: string }) {
  const { data, isLoading, isError, refetch } = usePlaylist(id);
  const setView = useView((s) => s.setView);
  if (isLoading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  if (isError)
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-destructive text-sm">Couldn&rsquo;t load this playlist.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setView({ kind: "playlists" })}>
            Back to playlists
          </Button>
        </div>
      </div>
    );
  const tracks = data?.tracks ?? [];
  const currentName = data?.playlist.name ?? name;
  return (
    <DetailView
      back={{ kind: "playlists" }}
      eyebrow="Playlist"
      title={currentName}
      image={tracks.find((t) => t.imageUrl)?.imageUrl}
      tracks={tracks}
      showDate
      empty="No songs yet — open the ⋯ menu on any song and add it here."
      playlistContext={{ id, name: currentName }}
    />
  );
}

/** The user's liked songs — a top-level library tab, no back navigation. */
export function LikedView() {
  const { data: tracks = [], isLoading, isError, refetch } = useLikes();
  if (isLoading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  if (isError)
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-destructive text-sm">Couldn&rsquo;t load your liked songs.</p>
        <Button size="sm" variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  return (
    <DetailView
      eyebrow="Playlist"
      title="Liked Songs"
      // Signature gradient cover, kept monochrome to stay on our design system
      // (primary = grayscale) rather than Spotify's purple.
      cover={
        <div className="from-primary/30 to-primary/5 flex size-full items-center justify-center bg-gradient-to-br">
          <Heart className="text-primary size-12 fill-current" />
        </div>
      }
      tracks={tracks}
      showDate
      empty="Songs you like will appear here — tap the heart on any song."
    />
  );
}

export function PlaylistsView() {
  const { data: playlists = [], isLoading } = usePlaylists();
  const createPlaylist = useCreatePlaylist();
  const setView = useView((s) => s.setView);

  // Just create — the optimistic tile appears on the grid instantly and the
  // toast fires immediately. No auto-navigation; the user clicks the tile to
  // open it.
  const onCreate = () => {
    createPlaylist.mutate(undefined);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Playlists</h1>
          <p className="text-muted-foreground text-sm">{playlists.length} playlists</p>
        </div>
        <Button onClick={onCreate} disabled={createPlaylist.isPending}>
          <Plus /> New playlist
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      ) : playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <ListMusic className="text-muted-foreground mb-3 size-10" />
          <p className="font-medium">No playlists yet</p>
          <p className="text-muted-foreground text-sm">
            Create one, or use the ⋯ menu on any song.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {playlists.map((p) => (
            <div
              key={p.id}
              onClick={() => setView({ kind: "playlist", id: p.id, name: p.name })}
              className="group bg-card hover:bg-accent/60 border-border flex cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left transition-colors"
            >
              <button
                aria-label={`Open ${p.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setView({ kind: "playlist", id: p.id, name: p.name });
                }}
                className="bg-muted focus-visible:ring-ring/50 flex aspect-square w-full items-center justify-center rounded-lg outline-none focus-visible:ring-2"
              >
                <ListMusic className="text-muted-foreground size-8" />
              </button>
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {p.count} {p.count === 1 ? "song" : "songs"}
                  </p>
                </div>
                <PlaylistMenu
                  id={p.id}
                  name={p.name}
                  count={p.count}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}