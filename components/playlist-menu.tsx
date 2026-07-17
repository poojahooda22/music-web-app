"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { useDeletePlaylist, useRenamePlaylist } from "@/lib/use-playlists";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The per-playlist three-dot menu: rename (input dialog) and delete (confirm
 * dialog). Menu open state is controlled so onSelect can hand off to a dialog
 * without the menu's focus-restore stealing the dialog's focus. Rendered inside
 * clickable tiles — every layer stops propagation so menu/dialog interaction
 * never opens the playlist underneath.
 */
export function PlaylistMenu({
  id,
  name,
  count,
  onDeleted,
  className,
}: {
  id: number;
  name: string;
  count: number;
  onDeleted?: () => void;
  className?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [draft, setDraft] = useState(name);
  const rename = useRenamePlaylist();
  const del = useDeletePlaylist();

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  // Fire-and-forget: close the dialog in the same frame. The optimistic cache
  // update in the hook flips the name / removes the tile instantly; the success
  // or error toast fires from the global MutationCache (unmount-proof — the tile
  // this menu lives on vanishes on delete before the request settles).
  const submitRename = () => {
    const trimmed = draft.trim();
    setDialog(null);
    if (trimmed && trimmed !== name) rename.mutate({ id, name: trimmed });
  };

  const confirmDelete = () => {
    setDialog(null);
    onDeleted?.();
    del.mutate({ id, name });
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Options for ${name}`}
            onClick={stop}
            onKeyDown={stop}
            className={cn(
              "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2",
              className,
            )}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44" onClick={stop} onKeyDown={stop}>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              setDraft(name);
              setDialog("rename");
            }}
          >
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              setDialog("delete");
            }}
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "rename"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent onClick={stop} onKeyDown={stop}>
          <DialogHeader>
            <DialogTitle>Rename playlist</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitRename();
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={100}
              autoFocus
              aria-label="Playlist name"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!draft.trim() || rename.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent onClick={stop} onKeyDown={stop}>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{name}&rdquo;?</DialogTitle>
            <DialogDescription>
              This removes the playlist{count > 0 ? ` and its ${count} ${count === 1 ? "song" : "songs"}` : ""} from
              your library. The songs themselves stay in the catalog.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={del.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}