"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { useNotify } from "@/lib/notify-store";

/**
 * A mutation may declare its toast text in `meta`. Toasts fire from the global
 * MutationCache (not per-hook/per-call callbacks) so they show even when the
 * component that triggered the mutation unmounts before it settles — e.g. the
 * deleted playlist tile or the removed song row vanishes optimistically. Per-call
 * callbacks are dropped on unmount; MutationCache callbacks always run.
 */
export interface ToastMeta {
  success?: (data: unknown, vars: unknown) => string | null;
  error?: string;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
        mutationCache: new MutationCache({
          onSuccess: (data, vars, _ctx, mutation) => {
            const meta = mutation.meta as ToastMeta | undefined;
            const msg = meta?.success?.(data, vars);
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