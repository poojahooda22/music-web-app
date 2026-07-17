"use client";

import { memo } from "react";
import { Music, Pause, Play } from "lucide-react";

import { usePlayer, type Track } from "@/lib/player-store";
import { cn } from "@/lib/utils";
import { SongMenu } from "./song-menu";

export const SongRow = memo(function SongRow({
  tracks,
  index,
  playlistContext,
}: {
  tracks: Track[];
  index: number;
  playlistContext?: { id: number; name: string };
}) {
  const track = tracks[index];
  const playQueue = usePlayer((s) => s.playQueue);
  const toggle = usePlayer((s) => s.toggle);
  // Per-row BOOLEAN selectors: Zustand only re-renders when the selected value
  // changes, so a track change or play/pause re-renders just the ~2 affected
  // rows — not every mounted row. (Selecting the current-track object instead
  // would re-render all rows on any change.)
  const active = usePlayer((s) => (s.queue[s.index]?.id ?? null) === track.id);
  const activePlaying = usePlayer((s) => s.isPlaying && (s.queue[s.index]?.id ?? null) === track.id);

  const activate = () => (active ? toggle() : playQueue(tracks, index));

  // The row div is a pointer convenience only; the REAL controls are the two
  // buttons inside (play overlay + menu) — nesting a button in a role="button"
  // container is invalid in the accessibility tree.
  return (
    <div
      onClick={activate}
      className="group hover:bg-accent/50 flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors"
    >
      <div className="bg-muted relative size-11 shrink-0 overflow-hidden rounded-md">
        {track.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Music className="text-muted-foreground size-4" />
          </div>
        )}
        <button
          aria-label={activePlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          data-active={active}
          onClick={(e) => {
            e.stopPropagation();
            activate();
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity outline-none group-hover:opacity-100 focus-visible:opacity-100 data-[active=true]:opacity-100"
        >
          {activePlaying ? (
            <Pause className="size-4 text-white" />
          ) : (
            <Play className="size-4 text-white" />
          )}
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", active && "text-primary")}>{track.title}</p>
        <p className="text-muted-foreground truncate text-xs">
          {track.artist}
          {track.genre ? ` · ${track.genre}` : ""}
        </p>
      </div>
      <SongMenu
        track={track}
        playlistContext={playlistContext}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
      />
    </div>
  );
});