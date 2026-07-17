"use client";

import { CircleCheck, CircleX, X } from "lucide-react";

import { useNotify } from "@/lib/notify-store";

/**
 * Transient notices, top-right, following the design system's Toast — the
 * DEFAULT (non-colored) variant: a neutral elevated card where only the icon
 * carries the semantic color; the title is foreground/semibold and the optional
 * description is muted. Slide-in from the top, hover-revealed close button.
 */
export function Toaster() {
  const notices = useNotify((s) => s.notices);
  const dismiss = useNotify((s) => s.dismiss);
  if (notices.length === 0) return null;

  return (
    <div aria-live="polite" className="fixed top-6 right-6 z-50 flex flex-col items-end gap-2">
      {notices.map((n) => {
        const isError = n.kind === "error";
        return (
          <div
            key={n.id}
            role="status"
            className="group bg-popover border-border animate-in fade-in slide-in-from-top-2 flex w-80 items-start gap-3 rounded-md border p-4 shadow-lg duration-200"
          >
            {isError ? (
              <CircleX className="text-destructive size-5 shrink-0" />
            ) : (
              <CircleCheck className="text-success size-5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-sm font-semibold">{n.message}</p>
              {n.description && (
                <p className="text-muted-foreground mt-0.5 text-sm">{n.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(n.id)}
              aria-label="Dismiss notification"
              className="text-muted-foreground hover:text-foreground -my-1 -mr-1 shrink-0 rounded-sm p-1 opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}