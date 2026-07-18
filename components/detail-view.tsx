"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { ChevronLeft, Music, Pause, Play } from "lucide-react";

import { usePlayer, useCurrentTrack, type Track } from "@/lib/player-store";
import { useView, type View } from "@/lib/view-store";
import { cn } from "@/lib/utils";
import { SongTable, fmtTotal } from "./song-table";
import { Button } from "./ui/button";

/** Shared detail layout: back link, top-aligned artwork header, right-aligned Play, track table. */
export function DetailView({
  back,
  eyebrow,
  title,
  subtitle,
  owner,
  image,
  cover,
  round,
  tracks,
  empty,
  showDate = false,
  playlistContext,
  belowMeta,
}: {
  back?: View;
  eyebrow: string;
  title: string;
  subtitle?: string;
  owner?: string;
  image?: string | null;
  cover?: ReactNode;
  round?: boolean;
  tracks: Track[];
  empty?: string;
  showDate?: boolean;
  playlistContext?: { id: number; name: string };
  belowMeta?: ReactNode;
}) {
  const setView = useView((s) => s.setView);
  const playQueue = usePlayer((s) => s.playQueue);
  const toggle = usePlayer((s) => s.toggle);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const current = useCurrentTrack();

  // Two states: if the playing track belongs to THIS list, the button toggles
  // pause/resume in place; otherwise it starts the list from the top.
  const listActive = current != null && tracks.some((t) => t.id === current.id);
  const playingThis = listActive && isPlaying;

  return (
    <div>
      {back && (
        <button
          onClick={() => setView(back)}
          className="text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" /> Back
        </button>
      )}
      <div className="mb-6 flex items-start gap-5">
        <div
          className={cn(
            "size-32 shrink-0 overflow-hidden",
            round ? "rounded-full" : "rounded-xl",
            !cover && "bg-muted border-border border",
          )}
        >
          {cover ? (
            cover
          ) : image ? (
            <Image src={image} alt={title} width={128} height={128} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Music className="text-muted-foreground size-10" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {eyebrow}
          </p>
          <h1 className="truncate text-3xl font-bold tracking-tight capitalize">{title}</h1>
          <p className="text-muted-foreground text-sm">
            {owner ? (
              <span className="text-foreground font-medium">{owner}</span>
            ) : subtitle ? (
              <span>{subtitle}</span>
            ) : null}
            {(owner || subtitle) && " · "}
            {tracks.length} {tracks.length === 1 ? "song" : "songs"}
            {tracks.length > 0 ? `, ${fmtTotal(tracks)}` : ""}
          </p>
          {belowMeta && <div className="mt-3">{belowMeta}</div>}
        </div>
        {tracks.length > 0 && (
          <Button
            className="shrink-0"
            onClick={() => (listActive ? toggle() : playQueue(tracks, 0))}
          >
            {playingThis ? (
              <>
                <Pause /> Pause
              </>
            ) : (
              <>
                <Play /> Play
              </>
            )}
          </Button>
        )}
      </div>
      {tracks.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty ?? "Nothing here yet."}</p>
      ) : (
        <SongTable tracks={tracks} showDate={showDate} playlistContext={playlistContext} />
      )}
    </div>
  );
}