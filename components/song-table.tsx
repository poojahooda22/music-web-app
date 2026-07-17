"use client";

import { memo } from "react";
import { Clock, Music, Play } from "lucide-react";

import { usePlayer, type Track } from "@/lib/player-store";
import { useView } from "@/lib/view-store";
import { cn } from "@/lib/utils";
import { SongMenu } from "./song-menu";

function fmtDuration(s?: number | null): string {
  if (!s || s < 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** Recent → relative ("6 seconds ago"), older → "Oct 24, 2024". */
function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.round((then - Date.now()) / 1000); // negative = past
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(sec, "second");
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return rtf.format(hr, "hour");
  const day = Math.round(hr / 24);
  if (Math.abs(day) < 7) return rtf.format(day, "day");
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Total run time of a track set → "13 min 58 sec" / "1 hr 3 min". */
export function fmtTotal(tracks: Track[]): string {
  const total = tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0);
  const min = Math.floor(total / 60);
  if (min < 60) return `${min} min ${Math.floor(total % 60)} sec`;
  return `${Math.floor(min / 60)} hr ${min % 60} min`;
}

// The grid template, shared by the header and every row so columns line up.
// Title / Album / Date use PROPORTIONAL fr shares (not a greedy 1fr title) so
// the free width distributes across the columns like a real table — no dead gap
// between the title and the right-side columns. Album appears at md, date at lg;
// # and duration are fixed. minmax(0,·) lets the flexible columns truncate.
function gridClass(showDate: boolean): string {
  const base = "grid-cols-[2rem_1fr_4.5rem]";
  const md = "md:grid-cols-[2rem_minmax(0,2fr)_minmax(0,1fr)_4.5rem]";
  const lg = "lg:grid-cols-[2rem_minmax(0,5fr)_minmax(0,3fr)_minmax(0,2fr)_4.5rem]";
  return showDate ? `${base} ${md} ${lg}` : `${base} ${md}`;
}

/** Animated equalizer shown in the # column for the row that's currently playing. */
function MiniEq() {
  return (
    <span className="flex h-3.5 items-end gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="bg-primary animate-eq w-0.5 rounded-full"
          style={{ height: "100%", animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

const SongTableRow = memo(function SongTableRow({
  tracks,
  index,
  showDate,
  playlistContext,
}: {
  tracks: Track[];
  index: number;
  showDate: boolean;
  playlistContext?: { id: number; name: string };
}) {
  const track = tracks[index];
  const setView = useView((s) => s.setView);
  const playQueue = usePlayer((s) => s.playQueue);
  const toggle = usePlayer((s) => s.toggle);
  // Per-row boolean selectors — only the ~2 affected rows re-render on a track
  // change / play-pause (see SongRow for the rationale).
  const active = usePlayer((s) => (s.queue[s.index]?.id ?? null) === track.id);
  const activePlaying = usePlayer((s) => s.isPlaying && (s.queue[s.index]?.id ?? null) === track.id);

  const activate = () => (active ? toggle() : playQueue(tracks, index));

  return (
    <div
      onClick={activate}
      className={cn(
        "group/row hover:bg-accent/50 grid cursor-pointer items-center gap-4 rounded-md px-4 py-2",
        gridClass(showDate),
      )}
    >
      {/* # / play / equalizer */}
      <div className="text-muted-foreground flex items-center justify-center text-sm">
        {activePlaying ? (
          <MiniEq />
        ) : (
          <>
            <span className={cn("tabular-nums group-hover/row:hidden", active && "text-primary")}>
              {index + 1}
            </span>
            <Play className="text-foreground hidden size-3.5 fill-current group-hover/row:block" />
          </>
        )}
      </div>

      {/* Title: cover + title + artist */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="bg-muted relative size-10 shrink-0 overflow-hidden rounded">
          {track.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Music className="text-muted-foreground size-4" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-medium", active && "text-primary")}>{track.title}</p>
          <p className="text-muted-foreground truncate text-xs">{track.artist}</p>
        </div>
      </div>

      {/* Album */}
      <div className="hidden min-w-0 items-center md:flex">
        {track.albumId != null && track.albumTitle ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setView({ kind: "album", id: track.albumId!, title: track.albumTitle! });
            }}
            className="text-muted-foreground hover:text-foreground truncate text-left text-sm hover:underline"
          >
            {track.albumTitle}
          </button>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </div>

      {/* Date added */}
      {showDate && (
        <div className="text-muted-foreground hidden items-center text-sm lg:flex">
          {fmtDate(track.addedAt)}
        </div>
      )}

      {/* ⋯ menu (hover) + duration */}
      <div className="flex items-center justify-end gap-3">
        <SongMenu
          track={track}
          playlistContext={playlistContext}
          className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
        />
        <span className="text-muted-foreground w-10 text-right text-sm tabular-nums">
          {fmtDuration(track.duration)}
        </span>
      </div>
    </div>
  );
});

export function SongTable({
  tracks,
  showDate = false,
  playlistContext,
}: {
  tracks: Track[];
  showDate?: boolean;
  playlistContext?: { id: number; name: string };
}) {
  return (
    <div>
      {/* Header */}
      <div
        className={cn(
          "text-muted-foreground border-border mb-2 grid items-center gap-4 border-b px-4 pb-2 text-xs",
          gridClass(showDate),
        )}
      >
        <div className="text-center">#</div>
        <div>Title</div>
        <div className="hidden md:block">Album</div>
        {showDate && <div className="hidden lg:block">Date added</div>}
        <div className="flex justify-end">
          <Clock className="size-4" />
        </div>
      </div>

      <div className="space-y-0.5">
        {tracks.map((t, i) => (
          <SongTableRow
            key={t.id}
            tracks={tracks}
            index={i}
            showDate={showDate}
            playlistContext={playlistContext}
          />
        ))}
      </div>
    </div>
  );
}