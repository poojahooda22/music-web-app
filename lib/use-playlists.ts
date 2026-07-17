"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Track } from "./player-store";

export interface PlaylistSummary {
  id: number;
  name: string;
  count: number;
}

interface PlaylistDetail {
  playlist: { id: number; name: string };
  tracks: Track[];
}

/**
 * All playlist mutations are OPTIMISTIC (onMutate writes the cache in the same
 * frame; onError rolls back; onSettled reconciles) AND declare their toast text
 * in `meta` — the global MutationCache fires the toast so it survives the
 * triggering component unmounting (deleted tile / removed row) before the server
 * round-trip settles. See app/query-provider.tsx.
 */

export function usePlaylists() {
  return useQuery<PlaylistSummary[]>({
    queryKey: ["playlists"],
    queryFn: async () => {
      const r = await fetch("/api/playlists");
      if (!r.ok) throw new Error("Failed to load playlists");
      const j = await r.json();
      return Array.isArray(j.playlists) ? j.playlists : [];
    },
  });
}

export function usePlaylist(id: number | null) {
  return useQuery<PlaylistDetail>({
    queryKey: ["playlist", id],
    enabled: id != null,
    queryFn: async () => {
      const r = await fetch(`/api/playlists/${id}`);
      if (!r.ok) throw new Error("Failed to load playlist");
      const j = await r.json();
      return { playlist: j.playlist, tracks: Array.isArray(j.tracks) ? j.tracks : [] };
    },
  });
}

// Temp ids for optimistic tiles live below the real (positive) id space so they
// never collide, and get swapped for the server id on success.
let tempSeq = -1;

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    // Optional songId seeds the new playlist server-side in the same request.
    mutationFn: async (input?: { name?: string; songId?: number }) => {
      const r = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input ?? {}),
      });
      if (!r.ok) throw new Error("Failed to create playlist");
      const j = await r.json();
      return j.playlist as PlaylistSummary;
    },
    meta: {
      toast: (vars: unknown) => {
        const v = vars as { name?: string; songId?: number } | undefined;
        if (v?.songId) return "Added to a new playlist";
        return v?.name ? `Created ${v.name}` : "Playlist created";
      },
      error: "Couldn't create the playlist — try again.",
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["playlists"] });
      const prev = qc.getQueryData<PlaylistSummary[]>(["playlists"]);
      const tempId = tempSeq--;
      const optimistic: PlaylistSummary = {
        id: tempId,
        name: input?.name?.trim() || `My Playlist #${(prev?.length ?? 0) + 1}`,
        count: input?.songId ? 1 : 0,
      };
      qc.setQueryData<PlaylistSummary[]>(["playlists"], (old = []) => [optimistic, ...old]);
      return { prev, tempId };
    },
    onSuccess: (real, _input, ctx) => {
      // Swap the temp tile for the server row (real id, real name).
      qc.setQueryData<PlaylistSummary[]>(["playlists"], (old = []) =>
        old.map((p) => (p.id === ctx?.tempId ? { ...real, count: p.count } : p)),
      );
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(["playlists"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useAddToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ playlistId, track }: { playlistId: number; track: Track; playlistName: string }) => {
      const r = await fetch(`/api/playlists/${playlistId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: track.id }),
      });
      if (!r.ok) throw new Error("Failed to add to playlist");
      return (await r.json()) as { added: boolean };
    },
    meta: {
      toast: (vars: unknown) => `Added to ${(vars as { playlistName: string }).playlistName}`,
      error: "Couldn't add to the playlist — try again.",
    },
    onMutate: async ({ playlistId, track }) => {
      await qc.cancelQueries({ queryKey: ["playlist", playlistId] });
      await qc.cancelQueries({ queryKey: ["playlists"] });
      const prevDetail = qc.getQueryData<PlaylistDetail>(["playlist", playlistId]);
      const prevList = qc.getQueryData<PlaylistSummary[]>(["playlists"]);

      // If the detail is cached and already holds the song, it's a no-op —
      // don't double-count. If it isn't cached, assume a real add (onSettled
      // reconciles either way).
      const alreadyThere = prevDetail?.tracks.some((t) => t.id === track.id) ?? false;
      if (!alreadyThere) {
        qc.setQueryData<PlaylistDetail>(["playlist", playlistId], (old) =>
          old ? { ...old, tracks: [...old.tracks, track] } : old,
        );
        qc.setQueryData<PlaylistSummary[]>(["playlists"], (old = []) =>
          old.map((p) => (p.id === playlistId ? { ...p, count: p.count + 1 } : p)),
        );
      }
      return { prevDetail, prevList, playlistId };
    },
    onError: (_e, { playlistId }, ctx) => {
      if (ctx?.prevDetail !== undefined) qc.setQueryData(["playlist", playlistId], ctx.prevDetail);
      if (ctx?.prevList !== undefined) qc.setQueryData(["playlists"], ctx.prevList);
    },
    onSettled: (_d, _e, { playlistId }) => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      qc.invalidateQueries({ queryKey: ["playlist", playlistId] });
    },
  });
}

export function useRemoveFromPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ playlistId, songId }: { playlistId: number; songId: number; playlistName: string }) => {
      const r = await fetch(`/api/playlists/${playlistId}/items?songId=${songId}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("Failed to remove from playlist");
      return (await r.json()) as { removed: boolean };
    },
    meta: {
      toast: (vars: unknown) => `Removed from ${(vars as { playlistName: string }).playlistName}`,
      error: "Couldn't remove from the playlist — try again.",
    },
    onMutate: async ({ playlistId, songId }) => {
      await qc.cancelQueries({ queryKey: ["playlist", playlistId] });
      await qc.cancelQueries({ queryKey: ["playlists"] });
      const prevDetail = qc.getQueryData<PlaylistDetail>(["playlist", playlistId]);
      const prevList = qc.getQueryData<PlaylistSummary[]>(["playlists"]);

      let removed = false;
      qc.setQueryData<PlaylistDetail>(["playlist", playlistId], (old) => {
        if (!old) return old;
        const tracks = old.tracks.filter((t) => t.id !== songId);
        removed = tracks.length !== old.tracks.length;
        return { ...old, tracks };
      });
      if (removed) {
        qc.setQueryData<PlaylistSummary[]>(["playlists"], (old = []) =>
          old.map((p) => (p.id === playlistId ? { ...p, count: Math.max(0, p.count - 1) } : p)),
        );
      }
      return { prevDetail, prevList, playlistId };
    },
    onError: (_e, { playlistId }, ctx) => {
      if (ctx?.prevDetail !== undefined) qc.setQueryData(["playlist", playlistId], ctx.prevDetail);
      if (ctx?.prevList !== undefined) qc.setQueryData(["playlists"], ctx.prevList);
    },
    onSettled: (_d, _e, { playlistId }) => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      qc.invalidateQueries({ queryKey: ["playlist", playlistId] });
    },
  });
}

export function useRenamePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const r = await fetch(`/api/playlists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error("Failed to rename playlist");
      const j = await r.json();
      return j.playlist as { id: number; name: string };
    },
    meta: {
      toast: (vars: unknown) => `Renamed to ${(vars as { name: string }).name}`,
      error: "Couldn't rename the playlist — try again.",
    },
    onMutate: async ({ id, name }) => {
      await qc.cancelQueries({ queryKey: ["playlists"] });
      await qc.cancelQueries({ queryKey: ["playlist", id] });
      const prevList = qc.getQueryData<PlaylistSummary[]>(["playlists"]);
      const prevDetail = qc.getQueryData<PlaylistDetail>(["playlist", id]);
      qc.setQueryData<PlaylistSummary[]>(["playlists"], (old = []) =>
        old.map((p) => (p.id === id ? { ...p, name } : p)),
      );
      qc.setQueryData<PlaylistDetail>(["playlist", id], (old) =>
        old ? { ...old, playlist: { ...old.playlist, name } } : old,
      );
      return { prevList, prevDetail, id };
    },
    onError: (_e, { id }, ctx) => {
      if (ctx?.prevList !== undefined) qc.setQueryData(["playlists"], ctx.prevList);
      if (ctx?.prevDetail !== undefined) qc.setQueryData(["playlist", id], ctx.prevDetail);
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      qc.invalidateQueries({ queryKey: ["playlist", id] });
    },
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; name: string }) => {
      const r = await fetch(`/api/playlists/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete playlist");
      return (await r.json()) as { deleted: boolean };
    },
    meta: {
      toast: (vars: unknown) => `Deleted "${(vars as { name: string }).name}"`,
      error: "Couldn't delete the playlist — try again.",
    },
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ["playlists"] });
      const prev = qc.getQueryData<PlaylistSummary[]>(["playlists"]);
      qc.setQueryData<PlaylistSummary[]>(["playlists"], (old = []) => old.filter((p) => p.id !== id));
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["playlists"], ctx.prev);
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      qc.removeQueries({ queryKey: ["playlist", id] });
    },
  });
}