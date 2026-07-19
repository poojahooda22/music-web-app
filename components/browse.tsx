"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BookOpen, ChevronLeft, ChevronRight, Loader2, Music } from "lucide-react";

import { useSongs } from "@/lib/use-songs";
import { useAudiobooks, type BookSummary } from "@/lib/use-audiobooks";
import { useView } from "@/lib/view-store";
import type { Track } from "@/lib/player-store";
import { cn } from "@/lib/utils";
import { SongCard } from "./song-card";

/** Group the catalog by genre, largest genre first. */
export function groupByGenre(songs: Track[]): [string, Track[]][] {
  const byGenre = new Map<string, Track[]>();
  for (const s of songs) {
    const g = s.genre || "other";
    if (!byGenre.has(g)) byGenre.set(g, []);
    byGenre.get(g)!.push(s);
  }
  return [...byGenre.entries()].sort((a, b) => b[1].length - a[1].length);
}

/** Shared horizontal scroller: hidden scrollbar + hover chevrons that appear
 *  only when that side actually has overflow to scroll to. Reports overflow
 *  upward so headers can hide "Show all" when everything already fits. */
export function ScrollRow({
  children,
  itemCount,
  onOverflow,
}: {
  children: React.ReactNode;
  itemCount: number;
  onOverflow?: (overflowing: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 2);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
      onOverflow?.(el.scrollWidth > el.clientWidth + 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [itemCount, onOverflow]);

  const scrollBy = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: "smooth" });

  return (
    <div className="group/row relative">
      <div ref={ref} className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth pb-1">
        {children}
      </div>

      {canLeft && (
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
          className="bg-card/95 border-border hover:bg-accent absolute top-1/2 left-1 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg backdrop-blur transition-colors group-hover/row:flex"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {canRight && (
        <button
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
          className="bg-card/95 border-border hover:bg-accent absolute top-1/2 right-1 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg backdrop-blur transition-colors group-hover/row:flex"
        >
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  );
}

/** Genre as a circular card (artist-circle format): round cover art, name +
 *  count below. `align` = "left" for the home row (circle + text both left),
 *  "center" for the Genres grid page. Clicking opens that genre's own page. */
export function GenreCircle({
  genre,
  list,
  className,
  align = "left",
}: {
  genre: string;
  list: Track[];
  className?: string;
  align?: "left" | "center";
}) {
  const setView = useView((s) => s.setView);
  const img = list.find((t) => t.imageUrl)?.imageUrl;
  return (
    <button
      onClick={() => setView({ kind: "genre", genre })}
      className={cn(
        "group focus-visible:ring-ring/50 flex shrink-0 flex-col gap-3 rounded-xl p-3 outline-none focus-visible:ring-2",
        align === "center" ? "items-center text-center" : "w-36 items-start text-left",
        className,
      )}
    >
      <div className="bg-muted border-border relative size-28 shrink-0 overflow-hidden rounded-full border">
        {img ? (
          <Image
            src={img}
            alt=""
            width={112}
            height={112}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Music className="text-muted-foreground size-8" />
          </div>
        )}
      </div>
      <div className="min-w-0 self-stretch">
        <p className="truncate text-sm font-medium capitalize">{genre}</p>
        <p className="text-muted-foreground text-xs">
          {list.length} {list.length === 1 ? "track" : "tracks"}
        </p>
      </div>
    </button>
  );
}

function GenreRow({ genre, list }: { genre: string; list: Track[] }) {
  const setView = useView((s) => s.setView);
  const [overflows, setOverflows] = useState(false);
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold capitalize">{genre}</h2>
        {overflows && (
          <button
            onClick={() => setView({ kind: "genre", genre })}
            className="text-muted-foreground hover:text-foreground text-xs font-medium"
          >
            Show all
          </button>
        )}
      </div>
      <ScrollRow itemCount={list.length} onOverflow={setOverflows}>
        {list.map((t, i) => (
          <SongCard key={t.id} tracks={list} index={i} />
        ))}
      </ScrollRow>
    </section>
  );
}

function AudiobookCard({ book }: { book: BookSummary }) {
  const setView = useView((s) => s.setView);
  return (
    <button
      onClick={() => setView({ kind: "book", id: book.id, title: book.title })}
      className="group bg-card hover:bg-accent/60 border-border focus-visible:ring-ring/50 flex w-40 shrink-0 flex-col gap-2 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-2"
    >
      <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-lg">
        {book.coverUrl ? (
          <Image src={book.coverUrl} alt="" fill sizes="160px" unoptimized className="object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <BookOpen className="text-muted-foreground size-8" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{book.title}</p>
        <p className="text-muted-foreground truncate text-xs">{book.author ?? "Unknown author"}</p>
      </div>
    </button>
  );
}

/** Home-page audiobooks shelf — hidden until at least one book loads. */
function AudiobookRow() {
  const { data: books = [] } = useAudiobooks();
  const setView = useView((s) => s.setView);
  const [overflows, setOverflows] = useState(false);
  if (!books.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <button
          onClick={() => setView({ kind: "audiobooks" })}
          className="hover:text-foreground/80 text-lg font-semibold transition-colors"
        >
          Audiobooks
        </button>
        {overflows && (
          <button
            onClick={() => setView({ kind: "audiobooks" })}
            className="text-muted-foreground hover:text-foreground text-xs font-medium"
          >
            Show all
          </button>
        )}
      </div>
      <ScrollRow itemCount={books.length} onOverflow={setOverflows}>
        {books.map((b) => (
          <AudiobookCard key={b.id} book={b} />
        ))}
      </ScrollRow>
    </section>
  );
}

export function Browse() {
  const { data: songs = [], isLoading, error } = useSongs();
  const setView = useView((s) => s.setView);

  if (isLoading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  if (error) return <p className="text-destructive text-sm">Failed to load songs.</p>;

  const genres = groupByGenre(songs);

  return (
    <div className="space-y-8 pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All Music</h1>
        <p className="text-muted-foreground text-sm">
          {songs.length} tracks across {genres.length} genres
        </p>
      </div>

      <section>
        {/* The heading opens the full Genres grid; no separate "Show all". */}
        <button
          onClick={() => setView({ kind: "genres" })}
          className="hover:text-foreground/80 mb-3 block text-lg font-semibold transition-colors"
        >
          Browse by genre
        </button>
        <ScrollRow itemCount={genres.length}>
          {genres.map(([genre, list]) => (
            <GenreCircle key={genre} genre={genre} list={list} />
          ))}
        </ScrollRow>
      </section>

      <AudiobookRow />

      {genres.map(([genre, list]) => (
        <GenreRow key={genre} genre={genre} list={list} />
      ))}
    </div>
  );
}