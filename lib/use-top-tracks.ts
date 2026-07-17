"use client";

import { useQuery } from "@tanstack/react-query";
import type { Track } from "./player-store";

export type TopTrack = Track & { playCount: number };

/** The user's most-played tracks over the last 30 days. */
export function useTopTracks() {
  return useQuery<TopTrack[]>({
    queryKey: ["top-tracks"],
    queryFn: async () => {
      const r = await fetch("/api/plays");
      if (!r.ok) throw new Error("Failed to load top tracks");
      const j = await r.json();
      return Array.isArray(j.tracks) ? j.tracks : [];
    },
  });
}

/** Fire-and-forget: record a play when a track starts. Never blocks playback. */
export function recordPlay(songId: number) {
  fetch("/api/plays", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songId }),
  }).catch(() => {});
}