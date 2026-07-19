"use client";

import { memo } from "react";
import { Library } from "lucide-react";

import { type View } from "@/lib/view-store";
import { useAuthPrompt } from "@/lib/auth-prompt-store";
import { Browse } from "./browse";
import { ProfileView } from "./profile-view";
import { Button } from "./ui/button";
import { ArtistsView, GenresView, SongsView } from "./views/browse-views";
import { AlbumView, ArtistView, GenreView } from "./views/entity-views";
import { LikedView, PlaylistView, PlaylistsView } from "./views/library-views";
import { SearchView } from "./views/search-view";
import { AudiobooksView, BookView } from "./views/audiobook-views";

/** Shown in place of a personal view when a signed-out visitor reaches it. */
function GatedNotice({ reason }: { reason: string }) {
  const prompt = useAuthPrompt((s) => s.prompt);
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-28 text-center">
      <div className="bg-secondary flex size-12 items-center justify-center rounded-full">
        <Library className="size-6" />
      </div>
      <div>
        <p className="text-lg font-semibold">Log in to {reason}</p>
        <p className="text-muted-foreground text-sm">Browsing stays open — sign in for your library.</p>
      </div>
      <Button onClick={() => prompt(reason)}>Sign in</Button>
    </div>
  );
}

// Memoized so the URGENT tab-highlight render (where deferredView is unchanged)
// skips the content subtree entirely — only the deferred pass re-renders it.
export const MainView = memo(function MainView({
  view,
  userName,
  userImage,
  loggedIn,
}: {
  view: View;
  userName: string;
  userImage?: string;
  loggedIn: boolean;
}) {
  switch (view.kind) {
    case "home":
      return <Browse />;
    case "songs":
      return <SongsView />;
    case "artists":
      return <ArtistsView />;
    case "playlists":
      return loggedIn ? <PlaylistsView /> : <GatedNotice reason="see your playlists" />;
    case "likes":
      return loggedIn ? <LikedView /> : <GatedNotice reason="see your liked songs" />;
    case "profile":
      return loggedIn ? (
        <ProfileView userName={userName} userImage={userImage} />
      ) : (
        <GatedNotice reason="see your profile" />
      );
    case "genres":
      return <GenresView />;
    case "genre":
      return <GenreView genre={view.genre} />;
    case "artist":
      return <ArtistView name={view.name} />;
    case "album":
      return <AlbumView id={view.id} title={view.title} />;
    case "audiobooks":
      return <AudiobooksView />;
    case "book":
      return <BookView id={view.id} title={view.title} />;
    case "playlist":
      return loggedIn ? (
        <PlaylistView id={view.id} name={view.name} />
      ) : (
        <GatedNotice reason="open this playlist" />
      );
    case "search":
      return <SearchView q={view.q} />;
  }
});