"use client";

import { Disc3, Heart, ListPlus, ListX, MoreHorizontal, Plus, User } from "lucide-react";

import type { Track } from "@/lib/player-store";
import { useView } from "@/lib/view-store";
import { useAddToPlaylist, useCreatePlaylist, usePlaylists, useRemoveFromPlaylist } from "@/lib/use-playlists";
import { useLikedIds, useToggleLike } from "@/lib/use-likes";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The per-song three-dot menu. The trigger is deliberately hook-free: the data +
 * mutation hooks live in SongMenuBody, which Radix only mounts while the menu is
 * OPEN. Long lists render hundreds of these triggers; eager hooks in every row
 * (usePlaylists/useLikes/3 mutations ×578 rows) stalled tab switches — the lazy
 * body means those subscriptions exist only for the one open menu.
 */
export function SongMenu({
  track,
  className,
  playlistContext,
}: {
  track: Track;
  className?: string;
  /** When the menu is rendered inside an owned playlist, enables "Remove from this playlist". */
  playlistContext?: { id: number; name: string };
}) {
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`More options for ${track.title}`}
          onClick={stop}
          onKeyDown={stop}
          className={cn(
            "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2",
            className,
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      {/* Portal contents still bubble through the React tree — stop clicks AND
          keys here so menu interaction never activates the row underneath. */}
      <DropdownMenuContent align="end" className="w-60" onClick={stop} onKeyDown={stop}>
        <SongMenuBody track={track} playlistContext={playlistContext} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Mounts only while the menu is open — all the query/mutation hooks live here. */
function SongMenuBody({
  track,
  playlistContext,
}: {
  track: Track;
  playlistContext?: { id: number; name: string };
}) {
  const setView = useView((s) => s.setView);
  const { data: playlists = [], isError: playlistsFailed } = usePlaylists();
  const createPlaylist = useCreatePlaylist();
  const addToPlaylist = useAddToPlaylist();
  const removeFromPlaylist = useRemoveFromPlaylist();
  const likedIds = useLikedIds();
  const toggleLike = useToggleLike();
  const isLiked = likedIds.has(track.id);
  const busy = createPlaylist.isPending || addToPlaylist.isPending;

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <ListPlus /> Add to playlist
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-52">
          <DropdownMenuItem disabled={busy} onSelect={() => createPlaylist.mutate({ songId: track.id })}>
            <Plus /> New playlist
          </DropdownMenuItem>
          {playlistsFailed && (
            <DropdownMenuLabel className="text-destructive text-xs font-normal">
              Couldn&rsquo;t load your playlists.
            </DropdownMenuLabel>
          )}
          {playlists.length > 0 && <DropdownMenuSeparator />}
          {playlists.map((p) => (
            <DropdownMenuItem
              key={p.id}
              disabled={busy}
              onSelect={() => addToPlaylist.mutate({ playlistId: p.id, track, playlistName: p.name })}
            >
              <span className="truncate">{p.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuItem onSelect={() => toggleLike.mutate({ track, liked: !isLiked })}>
        <Heart className={isLiked ? "fill-current" : undefined} />
        {isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}
      </DropdownMenuItem>
      {playlistContext && (
        <DropdownMenuItem
          onSelect={() =>
            removeFromPlaylist.mutate({
              playlistId: playlistContext.id,
              songId: track.id,
              playlistName: playlistContext.name,
            })
          }
        >
          <ListX /> Remove from this playlist
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={() => setView({ kind: "artist", name: track.artist })}>
        <User /> Go to artist
      </DropdownMenuItem>
      {track.albumId != null && track.albumTitle && (
        <DropdownMenuItem
          onSelect={() => setView({ kind: "album", id: track.albumId!, title: track.albumTitle! })}
        >
          <Disc3 /> Go to album
        </DropdownMenuItem>
      )}
    </>
  );
}