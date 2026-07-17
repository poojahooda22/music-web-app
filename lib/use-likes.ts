"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Track } from "./player-store";

/** The user's liked songs, most recently liked first. */
export function useLikes() {
  return useQuery<Track[]>({
    queryKey: ["likes"],
    queryFn: async () => {
      const r = await fetch("/api/likes");
      if (!r.ok) throw new Error("Failed to load liked songs");
      const j = await r.json();
      return Array.isArray(j.tracks) ? j.tracks : [];
    },
  });
}

/** Set of liked song ids, memoized — cheap membership checks in hot renders. */
export function useLikedIds() {
  const { data: liked = [] } = useLikes();
  return useMemo(() => new Set(liked.map((t) => t.id)), [liked]);
}

/**
 * Like/unlike with an optimistic cache update: the heart flips instantly,
 * rolls back (with a notice) if the server rejects, and re-syncs on settle.
 */
export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ track, liked }: { track: Track; liked: boolean }) => {
      const r = liked
        ? await fetch("/api/likes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ songId: track.id }),
          })
        : await fetch(`/api/likes?songId=${track.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to update liked songs");
      return r.json();
    },
    // Toast fires from the global MutationCache (unmount-proof) — so liking from
    // a dropdown that closes immediately still confirms. See query-provider.tsx.
    meta: {
      success: (_d: unknown, vars: unknown) =>
        (vars as { liked: boolean }).liked ? "Saved to Liked Songs" : "Removed from Liked Songs",
      error: "Couldn't update Liked Songs — try again.",
    },
    onMutate: async ({ track, liked }) => {
      await qc.cancelQueries({ queryKey: ["likes"] });
      const prev = qc.getQueryData<Track[]>(["likes"]);
      qc.setQueryData<Track[]>(["likes"], (old = []) =>
        liked ? [track, ...old.filter((t) => t.id !== track.id)] : old.filter((t) => t.id !== track.id),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["likes"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["likes"] }),
  });
}