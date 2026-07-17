"use client";

import { create } from "zustand";

export interface Notice {
  id: number;
  message: string;
  description?: string;
  kind: "error" | "success";
}

interface NotifyState {
  notices: Notice[];
  notify: (message: string, kind?: Notice["kind"], description?: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const AUTO_DISMISS_MS = 4000;

/** App-wide transient notices (mutation failures, quick confirmations). */
export const useNotify = create<NotifyState>((set) => ({
  notices: [],
  notify: (message, kind = "error", description) => {
    const id = nextId++;
    set((s) => ({ notices: [...s.notices, { id, message, description, kind }] }));
    setTimeout(() => {
      set((s) => ({ notices: s.notices.filter((n) => n.id !== id) }));
    }, AUTO_DISMISS_MS);
  },
  dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));