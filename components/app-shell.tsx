"use client";

import { useDeferredValue } from "react";
import { Heart, Home, Library, ListMusic, Music2, Users } from "lucide-react";

import { useView, type View } from "@/lib/view-store";
import { cn } from "@/lib/utils";
import { LoggedInProvider } from "@/lib/auth-context";
import { TopBar } from "./top-bar";
import { PlayerBar } from "./player-bar";
import { Toaster } from "./toaster";
import { AuthPrompt } from "./auth-prompt";
import { SessionWatcher } from "./session-watcher";
import { MainView } from "./main-view";
import { RightPanel } from "./right-panel";

const TABS = [
  { kind: "home", label: "Home", icon: Home },
  { kind: "songs", label: "Songs", icon: Music2 },
  { kind: "artists", label: "Artists", icon: Users },
  { kind: "playlists", label: "Playlists", icon: ListMusic },
  { kind: "likes", label: "Liked Songs", icon: Heart },
] as const;

/** Which library tab a view highlights. */
function tabFor(view: View): (typeof TABS)[number]["kind"] | null {
  switch (view.kind) {
    case "artist":
      return "artists";
    case "playlist":
      return "playlists";
    case "genre":
    case "genres":
    case "album":
      return "home";
    case "search":
    case "profile":
      return null;
    default:
      return view.kind;
  }
}

export function AppShell({
  user,
}: {
  user: { name: string; email?: string; image?: string } | null;
}) {
  const loggedIn = user != null;
  const name = user?.name ?? "";
  const image = user?.image;

  const view = useView((s) => s.view);
  const setView = useView((s) => s.setView);
  // The tab highlight reads the URGENT view; the heavy main content reads a
  // DEFERRED copy so its render can't block that highlight paint.
  const deferredView = useDeferredValue(view);
  const activeTab = tabFor(view);

  // Personal tabs are hidden for signed-out visitors; browse tabs stay.
  const tabs = TABS.filter((t) => loggedIn || (t.kind !== "playlists" && t.kind !== "likes"));

  return (
    <LoggedInProvider value={loggedIn}>
      {/* select-none: click-heavy player chrome shouldn't text-select on drags;
          inputs re-enable selection in globals.css @layer base. */}
      <div className="bg-background flex h-screen select-none flex-col">
        {/* After an OAuth redirect the first server render is signed-out — refresh
            once the client session arrives so the app swaps to the logged-in UI. */}
        {!loggedIn && <SessionWatcher />}
        <TopBar user={user} />

        <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
          <nav className="bg-card/40 border-border hidden w-60 shrink-0 flex-col rounded-lg border p-3 md:flex">
            <div className="text-muted-foreground mb-2 flex items-center gap-2 px-2 text-sm font-semibold">
              <Library className="size-4" /> Your Library
            </div>
            <div className="space-y-1">
              {tabs.map((t) => (
                <button
                  key={t.kind}
                  onClick={() => setView({ kind: t.kind })}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    activeTab === t.kind
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  <t.icon className="size-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </nav>

          <main className="bg-card/20 min-w-0 flex-1 overflow-y-auto rounded-lg p-5">
            <MainView view={deferredView} userName={name} userImage={image} loggedIn={loggedIn} />
          </main>

          <RightPanel />
        </div>

        <PlayerBar />
        <Toaster />
        <AuthPrompt />
      </div>
    </LoggedInProvider>
  );
}