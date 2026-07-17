"use client";

import { useEffect, useRef, useState } from "react";
import { Music, Search } from "lucide-react";

import { authClient } from "@/lib/auth/client";
import { useView } from "@/lib/view-store";
import { ProfileMenu } from "./profile-menu";
import { Button } from "./ui/button";

export function TopBar({
  user,
}: {
  user: { name: string; email?: string; image?: string } | null;
}) {
  const [q, setQ] = useState("");
  const qRef = useRef("");
  const viewKind = useView((s) => s.view.kind);
  const setView = useView((s) => s.setView);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search: ≥2 chars opens the results view; clearing returns home.
  const onChange = (value: string) => {
    setQ(value);
    qRef.current = value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Stale-closure guard: the input moved on (or navigation cleared it).
      if (qRef.current !== value) return;
      const query = value.trim();
      if (query.length >= 2) setView({ kind: "search", q: query });
      else if (useView.getState().view.kind === "search") setView({ kind: "home" });
    }, 250);
  };

  // Navigating away from search (tabs, menus, tiles) resets the box. The state
  // reset runs DURING render via the previous-value pattern (adjust state when a
  // tracked value changes) rather than in an effect, so it never cascades a
  // second setState-in-effect render and stale text never paints.
  const [prevViewKind, setPrevViewKind] = useState(viewKind);
  if (viewKind !== prevViewKind) {
    setPrevViewKind(viewKind);
    if (viewKind !== "search" && q !== "") setQ("");
  }

  // The imperative side of leaving search: cancel any pending debounce and clear
  // the guard ref so a mid-flight timer can't yank the user back into search.
  // Timer/ref writes belong in an effect; only setState-in-effect is avoided.
  useEffect(() => {
    if (viewKind !== "search") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      qRef.current = "";
    }
  }, [viewKind]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Client-side sign-out + full navigation (mirrors sign-in). The server-action
  // + redirect() pattern doesn't navigate reliably when fired from a dropdown
  // onSelect (not a form/transition); the client method clears the cookie and
  // the hard reload re-reads the cleared session.
  const onSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/";
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 px-4">
      <button
        onClick={() => setView({ kind: "home" })}
        aria-label="Home"
        className="focus-visible:ring-ring/50 flex shrink-0 items-center gap-2 rounded-full outline-none focus-visible:ring-2"
      >
        <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-full">
          <Music className="size-5" />
        </div>
        <span className="hidden text-lg font-semibold tracking-tight sm:inline">Music</span>
      </button>
      <div className="relative mx-auto w-full max-w-md">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          type="search"
          value={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What do you want to play?"
          aria-label="Search songs, artists, albums"
          className="bg-secondary border-border focus:border-ring/60 w-full rounded-full border py-2 pr-4 pl-10 text-sm outline-none"
        />
      </div>
      {user ? (
        <ProfileMenu
          name={user.name}
          email={user.email}
          image={user.image}
          onSignOut={onSignOut}
        />
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            className="rounded-full"
            onClick={() => (window.location.href = "/auth/sign-in")}
          >
            Log in
          </Button>
        </div>
      )}
    </header>
  );
}