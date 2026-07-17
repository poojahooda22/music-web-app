"use client";

import { create } from "zustand";

/**
 * Global "please log in" prompt. A gated action on the open/browse app calls
 * prompt("save songs") when the visitor isn't signed in; <AuthPrompt/> renders
 * the dialog. Keeps auth-gating out of every leaf component's markup.
 */
interface AuthPromptState {
  open: boolean;
  reason: string | null;
  prompt: (reason?: string) => void;
  close: () => void;
}

export const useAuthPrompt = create<AuthPromptState>((set) => ({
  open: false,
  reason: null,
  prompt: (reason) => set({ open: true, reason: reason ?? null }),
  close: () => set({ open: false }),
}));