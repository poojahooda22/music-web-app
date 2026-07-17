"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Track } from "./player-store";

export interface SearchResults {
  songs: Track[];
  artists: { id: number; name: string; imageUrl: string | null }[];
  albums: { id: number; title: string; artist: string | null }[];
}

const EMPTY: SearchResults = { songs: [], artists: [], albums: [] };

export function useSearch(q: string) {
  const query = q.trim();
  return useQuery<SearchResults>({
    queryKey: ["search", query],
    enabled: query.length >= 2,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error("Search failed");
      const j = await r.json();
      return {
        songs: Array.isArray(j.songs) ? j.songs : [],
        artists: Array.isArray(j.artists) ? j.artists : [],
        albums: Array.isArray(j.albums) ? j.albums : [],
      };
    },
    initialData: query.length < 2 ? EMPTY : undefined,
  });
}