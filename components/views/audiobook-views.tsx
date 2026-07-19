"use client";

import { memo } from "react";
import Image from "next/image";
import { BookOpen, ChevronLeft, Loader2, Pause, Play } from "lucide-react";

import { usePlayer, useCurrentTrack, type Track } from "@/lib/player-store";
import { useAudiobooks, useBook } from "@/lib/use-audiobooks";
import { useView } from "@/lib/view-store";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

function fmtDuration(s?: number | null): string {
  if (!s || s < 0) return "—";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** Total run time → "45 min" / "8 hr 12 min". */
function fmtLong(s?: number | null): string {
  if (!s) return "";
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} hr ${min % 60} min`;
}

/** LibriVox descriptions carry HTML (<i>, <br/>) — flatten to plain text. */
function stripHtml(s?: string | null): string {
  if (!s) return "";
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The audiobook catalog — a grid of book covers. */
export function AudiobooksView() {
  const { data: books = [], isLoading } = useAudiobooks();
  const setView = useView((s) => s.setView);

  if (isLoading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Audiobooks</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        {books.length} books
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {books.map((b) => (
          <button
            key={b.id}
            onClick={() => setView({ kind: "book", id: b.id, title: b.title })}
            className="group bg-card hover:bg-accent/60 border-border focus-visible:ring-ring/50 flex flex-col gap-3 rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-2"
          >
            <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-lg">
              {b.coverUrl ? (
                <Image src={b.coverUrl} alt="" fill sizes="200px" unoptimized className="object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <BookOpen className="text-muted-foreground size-8" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{b.title}</p>
              <p className="text-muted-foreground truncate text-xs">{b.author ?? "Unknown author"}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// A chapter row — a slim cousin of a song row (no like / playlist / album, since
// those are song concepts). Per-row selectors so only the ~2 affected rows
// re-render on a track change / play-pause.
const ChapterRow = memo(function ChapterRow({ tracks, index }: { tracks: Track[]; index: number }) {
  const track = tracks[index];
  const playQueue = usePlayer((s) => s.playQueue);
  const toggle = usePlayer((s) => s.toggle);
  const active = usePlayer((s) => (s.queue[s.index]?.id ?? null) === track.id);
  const activePlaying = usePlayer((s) => s.isPlaying && (s.queue[s.index]?.id ?? null) === track.id);

  const activate = () => (active ? toggle() : playQueue(tracks, index));

  return (
    <div
      onClick={activate}
      className="group/row hover:bg-accent/50 grid cursor-pointer grid-cols-[2rem_1fr_4.5rem] items-center gap-4 rounded-md px-4 py-2.5"
    >
      <div className="text-muted-foreground flex items-center justify-center text-sm">
        {activePlaying ? (
          <span className="flex h-3.5 items-end gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="bg-primary animate-eq w-0.5 rounded-full"
                style={{ height: "100%", animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
        ) : (
          <>
            <span className={cn("tabular-nums group-hover/row:hidden", active && "text-primary")}>
              {index + 1}
            </span>
            <Play className="text-foreground hidden size-3.5 fill-current group-hover/row:block" />
          </>
        )}
      </div>
      <p className={cn("truncate text-sm", active && "text-primary font-medium")}>{track.title}</p>
      <span className="text-muted-foreground text-right text-sm tabular-nums">
        {fmtDuration(track.duration)}
      </span>
    </div>
  );
});

/** A single book: cover header, Play, description, chapter list. */
export function BookView({ id }: { id: number; title: string }) {
  const { data, isLoading, isError, refetch } = useBook(id);
  const setView = useView((s) => s.setView);
  const playQueue = usePlayer((s) => s.playQueue);
  const toggle = usePlayer((s) => s.toggle);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const current = useCurrentTrack();

  if (isLoading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  if (isError || !data)
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-destructive text-sm">Couldn&rsquo;t load this book.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setView({ kind: "audiobooks" })}>
            Back to audiobooks
          </Button>
        </div>
      </div>
    );

  const { book, tracks } = data;
  const listActive = current != null && tracks.some((t) => t.id === current.id);
  const playingThis = listActive && isPlaying;

  return (
    <div>
      <button
        onClick={() => setView({ kind: "audiobooks" })}
        className="text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" /> Back
      </button>

      <div className="mb-6 flex items-start gap-5">
        <div className="bg-muted border-border relative size-32 shrink-0 overflow-hidden rounded-xl border">
          {book.coverUrl ? (
            <Image src={book.coverUrl} alt="" fill sizes="128px" unoptimized className="object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <BookOpen className="text-muted-foreground size-10" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Audiobook</p>
          <h1 className="truncate text-3xl font-bold tracking-tight">{book.title}</h1>
          <p className="text-muted-foreground text-sm">
            {book.author && <span className="text-foreground font-medium">{book.author}</span>}
            {book.author && " · "}
            {tracks.length} {tracks.length === 1 ? "chapter" : "chapters"}
            {book.totalDurationS ? `, ${fmtLong(book.totalDurationS)}` : ""}
          </p>
          {book.reader && (
            <p className="text-muted-foreground mt-1 truncate text-xs">Read by {book.reader}</p>
          )}
        </div>
        {tracks.length > 0 && (
          <Button className="shrink-0" onClick={() => (listActive ? toggle() : playQueue(tracks, 0))}>
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

      {book.description && (
        <p className="text-muted-foreground mb-6 max-w-3xl text-sm leading-relaxed">
          {stripHtml(book.description)}
        </p>
      )}

      <div className="space-y-0.5">
        {tracks.map((t, i) => (
          <ChapterRow key={t.id} tracks={tracks} index={i} />
        ))}
      </div>

      <p className="text-muted-foreground mt-6 text-xs">{book.attribution}</p>
    </div>
  );
}