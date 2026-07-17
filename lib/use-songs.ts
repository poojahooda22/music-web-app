"use client";

import { useQuery } from "@tanstack/react-query";
import type { Track } from "./player-store";

export function useSongs() {
  return useQuery<Track[]>({
    queryKey: ["catalog-songs"],
    queryFn: async () => {
      const r = await fetch("/api/songs");
      if (!r.ok) throw new Error("Failed to load songs");
      const j = await r.json();
      return Array.isArray(j.songs) ? (j.songs as Track[]) : [];
    },
  });
}