"use client";

import { create } from "zustand";

/**
 * The main-panel view state. Library tabs, detail drill-downs (artist/album/genre/
 * playlist), and search results all render in the center panel; this store is the
 * single source of truth for which one, so any component (tabs, song menus, genre
 * tiles, the search box) can navigate without prop drilling.
 */
export type View =
  | { kind: "home" }
  | { kind: "songs" }
  | { kind: "artists" }
  | { kind: "playlists" }
  | { kind: "likes" }
  | { kind: "profile" }
  | { kind: "genres" }
  | { kind: "genre"; genre: string }
  | { kind: "artist"; name: string }
  | { kind: "album"; id: number; title: string }
  | { kind: "playlist"; id: number; name: string }
  | { kind: "search"; q: string };

interface ViewState {
  view: View;
  setView: (view: View) => void;
}

export const useView = create<ViewState>((set) => ({
  view: { kind: "home" },
  setView: (view) => set({ view }),
}));
