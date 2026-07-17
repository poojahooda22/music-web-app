"use client";

import { useEffect, useRef, useState } from "react";
import { Music, Search } from "lucide-react";

import { signOutAction } from "@/app/actions";
import { useView } from "@/lib/view-store";
import { ProfileMenu } from "./profile-menu";

export function TopBar({
  name,
  email,
  image,
}: {
  name: string;
  email?: string;
  image?: string;
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

  // Navigating away from search (tabs, menus, tiles) clears the box AND cancels
  // any pending debounce — otherwise the timer fires after the click and yanks
  // the user back into the search view.
  useEffect(() => {
    if (viewKind !== "search") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setQ("");
      qRef.current = "";
    }
  }, [viewKind]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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
      <ProfileMenu name={name} email={email} image={image} onSignOut={() => signOutAction()} />
    </header>
  );
}