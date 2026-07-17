"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, ListMusic, Loader2, Pencil, Users } from "lucide-react";

import { useProfile, useUpdateProfile } from "@/lib/use-profile";
import { usePlaylists } from "@/lib/use-playlists";
import { useFollowedArtists } from "@/lib/use-follows";
import { useTopTracks } from "@/lib/use-top-tracks";
import { useView } from "@/lib/view-store";
import { useNotify } from "@/lib/notify-store";
import { SongTable } from "./song-table";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "U";
}

/** Read a File, cover-crop to a 256px square, return a compact JPEG data URL.
 *  Canvas re-encode strips EXIF — desirable for an avatar (privacy + size). */
async function fileToAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ProfileView({ userName, userImage }: { userName: string; userImage?: string }) {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const { data: playlists = [] } = usePlaylists();
  const followed = useFollowedArtists();
  const { data: top = [], isLoading: topLoading } = useTopTracks();
  const setView = useView((s) => s.setView);
  const notify = useNotify((s) => s.notify);

  const fileRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");

  const name = profile?.displayName ?? userName;
  const avatar = profile?.avatarUrl ?? userImage ?? null;

  const onPhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("Please choose an image file.");
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      update.mutate({ avatarUrl: dataUrl });
    } catch {
      notify("Couldn't process that image — try another.");
    }
  };

  const submitName = () => {
    const trimmed = draft.trim();
    setRenaming(false);
    if (trimmed && trimmed !== name) update.mutate({ displayName: trimmed });
  };

  return (
    <div className="space-y-10 pb-6">
      {/* Header */}
      <div className="flex items-end gap-6">
        <button
          onClick={() => fileRef.current?.click()}
          aria-label="Choose profile photo"
          className="group border-border relative size-40 shrink-0 overflow-hidden rounded-full border"
        >
          {avatar ? (
            // A data-URL photo (or a remote provider avatar) — unoptimized so
            // next/image serves it as-is without needing every host whitelisted.
            <Image src={avatar} alt={name} width={256} height={256} unoptimized className="size-full object-cover" />
          ) : (
            <div className="bg-muted text-muted-foreground flex size-full items-center justify-center text-4xl font-semibold">
              {initials(name)}
            </div>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Camera className="size-7" />
            <span className="text-xs font-medium">Choose photo</span>
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />

        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Profile</p>
          <button
            onClick={() => {
              setDraft(name);
              setRenaming(true);
            }}
            className="group flex max-w-full items-center gap-3 text-left"
          >
            <h1 className="truncate text-5xl font-bold tracking-tight">{name}</h1>
            <Pencil className="text-muted-foreground size-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
          <p className="text-muted-foreground mt-2 text-sm">
            {playlists.length} {playlists.length === 1 ? "Playlist" : "Playlists"} · {followed.length}{" "}
            Following
          </p>
        </div>
      </div>

      {/* Top tracks this month */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight">Top tracks this month</h2>
        <p className="text-muted-foreground mb-4 text-sm">Only visible to you</p>
        {topLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          </div>
        ) : top.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Play some music and your most-played tracks will show up here.
          </p>
        ) : (
          <SongTable tracks={top} />
        )}
      </section>

      {/* Public Playlists */}
      {playlists.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold tracking-tight">Playlists</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => setView({ kind: "playlist", id: p.id, name: p.name })}
                className="bg-card hover:bg-accent/60 border-border flex flex-col gap-3 rounded-xl border p-4 text-left transition-colors"
              >
                <div className="bg-muted flex aspect-square w-full items-center justify-center rounded-lg">
                  <ListMusic className="text-muted-foreground size-8" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {p.count} {p.count === 1 ? "song" : "songs"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Following */}
      {followed.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold tracking-tight">Following</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {followed.map((a) => (
              <button
                key={a.id}
                onClick={() => setView({ kind: "artist", name: a.name })}
                className="hover:bg-accent/50 flex flex-col items-center gap-3 rounded-xl p-3 text-center transition-colors"
              >
                <div className="bg-muted border-border size-28 shrink-0 overflow-hidden rounded-full border">
                  {a.imageUrl ? (
                    <Image src={a.imageUrl} alt={a.name} width={112} height={112} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <Users className="text-muted-foreground size-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 self-stretch">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-muted-foreground text-xs">Artist</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Rename dialog */}
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit name</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitName();
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={60}
              autoFocus
              aria-label="Display name"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!draft.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}