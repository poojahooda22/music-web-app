"use client";

import { useQuery } from "@tanstack/react-query";
import type { Track } from "./player-store";

export interface BookSummary {
  id: number;
  title: string;
  author: string | null;
  reader: string | null;
  coverUrl: string | null;
  language: string | null;
  totalDurationS: number | null;
  attribution: string;
  chapters: number;
}

export interface BookDetail {
  id: number;
  title: string;
  author: string | null;
  reader: string | null;
  description: string | null;
  coverUrl: string | null;
  language: string | null;
  totalDurationS: number | null;
  attribution: string;
}

/** The public audiobook catalog (books with at least one chapter). */
export function useAudiobooks() {
  return useQuery<BookSummary[]>({
    queryKey: ["audiobooks"],
    queryFn: async () => {
      const r = await fetch("/api/audiobooks");
      if (!r.ok) throw new Error("Failed to load audiobooks");
      const j = await r.json();
      return Array.isArray(j.books) ? j.books : [];
    },
  });
}

/** One book + its chapters as playable Tracks (kind:"audiobook"), in order. */
export function useBook(id: number | null) {
  return useQuery<{ book: BookDetail; tracks: Track[] }>({
    queryKey: ["book", id],
    enabled: id != null,
    queryFn: async () => {
      const r = await fetch(`/api/audiobooks/${id}`);
      if (!r.ok) throw new Error("Failed to load book");
      const j = await r.json();
      return { book: j.book, tracks: Array.isArray(j.tracks) ? j.tracks : [] };
    },
  });
}