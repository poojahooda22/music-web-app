"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface FollowedArtist {
  id: number;
  name: string;
  imageUrl: string | null;
}

interface FollowsData {
  artistIds: number[];
  artists: FollowedArtist[];
}

/** Followed artists: ids (button state) + full rows (profile "Following"). */
export function useFollows() {
  return useQuery<FollowsData>({
    queryKey: ["follows"],
    queryFn: async () => {
      const r = await fetch("/api/follows");
      if (!r.ok) throw new Error("Failed to load follows");
      const j = await r.json();
      return {
        artistIds: Array.isArray(j.artistIds) ? j.artistIds : [],
        artists: Array.isArray(j.artists) ? j.artists : [],
      };
    },
  });
}

export function useFollowedIds() {
  const { data } = useFollows();
  return useMemo(() => new Set(data?.artistIds ?? []), [data]);
}

export function useFollowedArtists() {
  const { data } = useFollows();
  return data?.artists ?? [];
}

/**
 * Follow / unfollow, optimistic. The button (artistIds) flips instantly; the
 * profile "Following" list (artists) reconciles on settle. Toast fires from the
 * global MutationCache (unmount-proof). See query-provider.tsx.
 */
export function useToggleFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ artistId, following }: { artistId: number; artistName: string; following: boolean }) => {
      const r = following
        ? await fetch("/api/follows", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ artistId }),
          })
        : await fetch(`/api/follows?artistId=${artistId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to update follows");
      return r.json();
    },
    meta: {
      success: (_d: unknown, vars: unknown) => {
        const { artistName, following } = vars as { artistName: string; following: boolean };
        return following ? `Following ${artistName}` : `Unfollowed ${artistName}`;
      },
      error: "Couldn't update follows — try again.",
    },
    onMutate: async ({ artistId, following }) => {
      await qc.cancelQueries({ queryKey: ["follows"] });
      const prev = qc.getQueryData<FollowsData>(["follows"]);
      qc.setQueryData<FollowsData>(["follows"], (old) => {
        if (!old) return old;
        const artistIds = following
          ? [...old.artistIds.filter((id) => id !== artistId), artistId]
          : old.artistIds.filter((id) => id !== artistId);
        const artists = following ? old.artists : old.artists.filter((a) => a.id !== artistId);
        return { artistIds, artists };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["follows"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["follows"] }),
  });
}