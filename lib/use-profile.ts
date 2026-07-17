"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Profile {
  displayName: string | null;
  avatarUrl: string | null;
}

/** App-owned profile overrides (name + avatar); null fields fall back to auth. */
export function useProfile() {
  return useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: async () => {
      const r = await fetch("/api/profile");
      if (!r.ok) throw new Error("Failed to load profile");
      return (await r.json()) as Profile;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { displayName?: string; avatarUrl?: string | null }) => {
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error("Failed to update profile");
      return (await r.json()) as Profile;
    },
    meta: { toast: () => "Profile updated", error: "Couldn't update your profile — try again." },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["profile"] });
      const prev = qc.getQueryData<Profile>(["profile"]);
      qc.setQueryData<Profile>(["profile"], (old) => ({
        displayName: patch.displayName ?? old?.displayName ?? null,
        avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : (old?.avatarUrl ?? null),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["profile"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}