"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Heart,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";

import { usePlayer, useCurrentTrack } from "@/lib/player-store";
import { useLikedIds, useToggleLike } from "@/lib/use-likes";
import { recordPlay } from "@/lib/use-top-tracks";
import { useLoggedIn } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt-store";
import { cn } from "@/lib/utils";

function fmt(s: number) {
  if (!s || Number.isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function Equalizer() {
  return (
    <div className="flex h-4 items-end gap-[3px]">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="bg-primary animate-eq w-[3px] rounded-full"
          style={{ height: "100%", animationDelay: `${i * 130}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * Waveform seek bar: the same bar primitive as the mini equalizer (3px bars, 3px gaps,
 * rounded, bottom-anchored scaleY pulse) repeated as a fixed set across the timeline.
 * Bars freeze in place on pause (play-state, not class removal), fill with progress,
 * and support click, drag-scrub, and keyboard seeking.
 */
const SEEK_BAR_W = 3;
const SEEK_BAR_GAP = 3;
const SEEK_BAR_MAX = 120;

/** Deterministic per-bar phase (0..1) — stable across renders, no random flicker. */
function barPhase(i: number) {
  return 0.5 + 0.5 * Math.sin(i * 342.06184 + 23.434);
}

function WaveformSeek({
  time,
  dur,
  playing,
  onSeek,
}: {
  time: number;
  dur: number;
  playing: boolean;
  onSeek: (t: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setCount(
        Math.min(SEEK_BAR_MAX, Math.floor((el.clientWidth + SEEK_BAR_GAP) / (SEEK_BAR_W + SEEK_BAR_GAP))),
      );
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const posToTime = (clientX: number) => {
    const el = ref.current;
    if (!el || dur <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return p * dur;
  };

  const shown = scrub ?? time;
  const progress = dur > 0 ? shown / dur : 0;

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(dur) || 0}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={`${fmt(shown)} of ${fmt(dur)}`}
      onPointerDown={(e) => {
        if (dur <= 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setScrub(posToTime(e.clientX));
      }}
      onPointerMove={(e) => {
        if (scrub !== null) setScrub(posToTime(e.clientX));
      }}
      onPointerUp={() => {
        if (scrub !== null) onSeek(scrub);
        setScrub(null);
      }}
      onPointerCancel={() => setScrub(null)}
      onKeyDown={(e) => {
        if (dur <= 0) return;
        const steps: Record<string, number> = {
          ArrowRight: 5,
          ArrowUp: 5,
          ArrowLeft: -5,
          ArrowDown: -5,
          PageUp: 30,
          PageDown: -30,
        };
        if (e.key in steps) {
          e.preventDefault();
          onSeek(Math.min(dur, Math.max(0, time + steps[e.key])));
        } else if (e.key === "Home") {
          e.preventDefault();
          onSeek(0);
        } else if (e.key === "End") {
          e.preventDefault();
          onSeek(dur);
        }
      }}
      className="focus-visible:ring-ring/50 flex h-8 flex-1 cursor-pointer touch-none items-end justify-between gap-[3px] rounded-md py-2 outline-none focus-visible:ring-2"
    >
      {Array.from({ length: count }, (_, i) => {
        const played = (i + 0.5) / count <= progress;
        return (
          <span
            key={i}
            className={cn(
              "animate-eq w-[3px] rounded-full transition-colors",
              played ? "bg-primary" : "bg-muted-foreground/30",
            )}
            style={{
              height: "100%",
              animationDelay: `${(-0.9 * barPhase(i)).toFixed(3)}s`,
              animationPlayState: playing ? "running" : "paused",
            }}
          />
        );
      })}
    </div>
  );
}

export function PlayerBar() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const current = useCurrentTrack();
  const isPlaying = usePlayer((s) => s.isPlaying);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);

  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolume] = useState(0.8);

  const likedIds = useLikedIds();
  const toggleLike = useToggleLike();
  const loggedIn = useLoggedIn();
  const promptLogin = useAuthPrompt((s) => s.prompt);
  const isLiked = current != null && likedIds.has(current.id);

  // Load + autoplay when the track changes, and record one play (fire-and-forget)
  // for "top tracks this month".
  useEffect(() => {
    const a = audioRef.current;
    if (a && current) {
      a.load();
      a.play().catch(() => {});
      recordPlay(current.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Sync play/pause with the store.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (isPlaying) a.play().catch(() => {});
    else a.pause();
  }, [isPlaying, current]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  return (
    <footer className="border-border bg-card z-20 flex h-20 items-center gap-4 border-t px-4">
      <audio
        ref={audioRef}
        src={current?.url}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => {
          if (repeat === "one" && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          } else {
            next();
          }
        }}
        onPlay={() => usePlayer.getState().setPlaying(true)}
        onPause={() => usePlayer.getState().setPlaying(false)}
      />

      {/* Now playing */}
      <div className="flex w-[30%] min-w-0 items-center gap-3">
        <div className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-md">
          {current?.imageUrl ? (
            <Image src={current.imageUrl} alt={current.title} width={48} height={48} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Music className="text-muted-foreground size-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{current?.title ?? "Nothing playing"}</p>
          <p className="text-muted-foreground truncate text-xs">{current?.artist ?? "—"}</p>
        </div>
        {current && (
          <button
            onClick={() => {
              if (!loggedIn) return promptLogin("save songs");
              toggleLike.mutate({ track: current, liked: !isLiked });
            }}
            aria-label={isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}
            aria-pressed={isLiked}
            className={cn(
              "shrink-0 transition-colors",
              isLiked ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Heart className={cn("size-4", isLiked && "fill-current")} />
          </button>
        )}
      </div>

      {/* Controls + progress */}
      <div className="flex flex-1 flex-col items-center gap-1.5">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleShuffle}
            className={cn("transition-colors", shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            aria-label="Shuffle"
          >
            <Shuffle className="size-4" />
          </button>
          <button onClick={prev} className="text-muted-foreground hover:text-foreground" aria-label="Previous">
            <SkipBack className="size-5" />
          </button>
          <button
            onClick={toggle}
            disabled={!current}
            className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-full transition-transform hover:scale-105 disabled:opacity-40"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button onClick={next} className="text-muted-foreground hover:text-foreground" aria-label="Next">
            <SkipForward className="size-5" />
          </button>
          <button
            onClick={cycleRepeat}
            className={cn("transition-colors", repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            aria-label="Repeat"
          >
            {repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
          </button>
        </div>
        <div className="flex w-full max-w-xl items-center gap-2">
          <span className="text-muted-foreground w-9 text-right text-[11px] tabular-nums">{fmt(time)}</span>
          <WaveformSeek
            time={time}
            dur={dur}
            playing={isPlaying}
            onSeek={(t) => {
              if (audioRef.current) audioRef.current.currentTime = t;
              setTime(t);
            }}
          />
          <span className="text-muted-foreground w-9 text-[11px] tabular-nums">{fmt(dur)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex w-[30%] items-center justify-end gap-2">
        <Volume2 className="text-muted-foreground size-4" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="accent-primary h-1 w-28 cursor-pointer"
          aria-label="Volume"
        />
      </div>
    </footer>
  );
}