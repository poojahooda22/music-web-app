"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { useNotify } from "@/lib/notify-store";

/**
 * A mutation may declare its toast text in `meta.toast` (derived from the
 * variables). The success toast fires from the global MutationCache's `onMutate`
 * — i.e. the instant the action starts, NOT when the server round-trip settles —
 * so feedback is immediate, matching the optimistic UI. Firing from the cache
 * (not a per-call callback) also means it survives the triggering component
 * unmounting (deleted tile / removed row). `error` fires on a failed settle.
 */
export interface ToastMeta {
  toast?: (vars: unknown) => string | null;
  error?: string;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
        mutationCache: new MutationCache({
          onMutate: (vars, mutation) => {
            const meta = mutation.meta as ToastMeta | undefined;
            const msg = meta?.toast?.(vars);
            if (msg) useNotify.getState().notify(msg, "success");
          },
          onError: (_err, _vars, _ctx, mutation) => {
            const meta = mutation.meta as ToastMeta | undefined;
            if (meta?.error) useNotify.getState().notify(meta.error);
          },
        }),
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}