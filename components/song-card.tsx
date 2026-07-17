"use client";

import { memo } from "react";
import Image from "next/image";
import { Music, Pause, Play } from "lucide-react";

import { usePlayer, type Track } from "@/lib/player-store";
import { SongMenu } from "./song-menu";

export const SongCard = memo(function SongCard({
  tracks,
  index,
}: {
  tracks: Track[];
  index: number;
}) {
  const track = tracks[index];
  const playQueue = usePlayer((s) => s.playQueue);
  const toggle = usePlayer((s) => s.toggle);
  // Per-row boolean selectors — only the ~2 affected cards re-render on a track
  // change / play-pause, not every mounted card. See SongRow for the rationale.
  const active = usePlayer((s) => (s.queue[s.index]?.id ?? null) === track.id);
  const activePlaying = usePlayer((s) => s.isPlaying && (s.queue[s.index]?.id ?? null) === track.id);

  const activate = () => (active ? toggle() : playQueue(tracks, index));

  // The card div is a pointer convenience only; the REAL controls are the two
  // buttons inside (play circle + menu) — nesting a button in a role="button"
  // container is invalid in the accessibility tree.
  return (
    <div
      onClick={activate}
      className="group bg-card hover:bg-accent/60 border-border relative flex w-40 shrink-0 cursor-pointer flex-col gap-2 rounded-xl border p-3 text-left transition-colors"
    >
      <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-lg">
        {track.imageUrl ? (
          <Image src={track.imageUrl} alt="" width={160} height={160} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Music className="text-muted-foreground size-8" />
          </div>
        )}
        <button
          aria-label={activePlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          data-active={active}
          onClick={(e) => {
            e.stopPropagation();
            activate();
          }}
          className="bg-primary text-primary-foreground absolute right-2 bottom-2 flex size-9 items-center justify-center rounded-full opacity-0 shadow-lg transition-opacity outline-none group-hover:opacity-100 focus-visible:opacity-100 data-[active=true]:opacity-100"
        >
          {activePlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
      </div>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{track.title}</p>
          <p className="text-muted-foreground truncate text-xs">{track.artist}</p>
        </div>
        <SongMenu
          track={track}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
        />
      </div>
    </div>
  );
});