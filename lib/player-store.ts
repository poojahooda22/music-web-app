import { create } from "zustand";

export interface Track {
  id: number;
  // Discriminates a song (default) from an audiobook chapter. A chapter's id is
  // from book_chapters, NOT songs — so play/like recording (which key on songs.id)
  // must be gated on this, or it writes against the wrong table.
  kind?: "song" | "audiobook";
  title: string;
  artist: string;
  artistId?: number | null;
  genre: string | null;
  duration: number | null;
  imageUrl: string | null;
  albumId: number | null;
  albumTitle: string | null;
  license: string;
  attribution: string;
  addedAt?: string | null; // when liked / added to a playlist (context-specific)
  url: string;
}

export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
  queue: Track[];
  index: number;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;

  playQueue: (tracks: Track[], startIndex: number) => void;
  toggle: () => void;
  setPlaying: (playing: boolean) => void;
  next: () => void;
  prev: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: [],
  index: -1,
  isPlaying: false,
  shuffle: false,
  repeat: "off",

  playQueue: (tracks, startIndex) => set({ queue: tracks, index: startIndex, isPlaying: true }),
  toggle: () => set((s) => (s.index >= 0 ? { isPlaying: !s.isPlaying } : s)),
  setPlaying: (playing) => set({ isPlaying: playing }),

  next: () =>
    set((s) => {
      if (s.queue.length === 0) return s;
      let ni: number;
      if (s.shuffle) {
        // Draw from the OTHER indices so shuffle never replays the same track
        // back-to-back (a uniform draw repeats with probability 1/len).
        ni =
          s.queue.length > 1
            ? (s.index + 1 + Math.floor(Math.random() * (s.queue.length - 1))) % s.queue.length
            : s.index;
      } else ni = s.index + 1;
      if (ni >= s.queue.length) {
        if (s.repeat === "all") ni = 0;
        else return { isPlaying: false };
      }
      return { index: ni, isPlaying: true };
    }),

  prev: () =>
    set((s) => {
      if (s.queue.length === 0) return s;
      const pi = s.index - 1 < 0 ? 0 : s.index - 1;
      return { index: pi, isPlaying: true };
    }),

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => ({ repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off" })),
}));

/** The currently-selected track (or null). */
export const useCurrentTrack = () => usePlayer((s) => s.queue[s.index] ?? null);