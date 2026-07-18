"use client";

import { memo } from "react";

import { useSongs } from "@/lib/use-songs";
import { SongRow } from "./song-row";

// Memoized: this panel is mounted on every tab, so without memo it reconciled
// its full song list on each AppShell re-render (tab switch, playback change).
export const RightPanel = memo(function RightPanel() {
  const { data: songs = [] } = useSongs();
  return (
    <aside className="border-border bg-card/40 hidden w-80 shrink-0 flex-col rounded-lg border lg:flex">
      <div className="border-border border-b p-4">
        <h2 className="font-semibold">Songs</h2>
        <p className="text-muted-foreground text-xs">{songs.length} tracks</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {songs.map((t, i) => (
          <SongRow key={t.id} tracks={songs} index={i} />
        ))}
      </div>
    </aside>
  );
});