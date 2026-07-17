"use client";

import { memo, useDeferredValue } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  Heart,
  Home,
  Library,
  ListMusic,
  Loader2,
  Music,
  Music2,
  Pause,
  Play,
  Plus,
  Users,
} from "lucide-react";

import { usePlayer, useCurrentTrack, type Track } from "@/lib/player-store";
import { useSongs } from "@/lib/use-songs";
import { useSearch } from "@/lib/use-search";
import { useLikes } from "@/lib/use-likes";
import { useCreatePlaylist, usePlaylist, usePlaylists } from "@/lib/use-playlists";
import { useView, type View } from "@/lib/view-store";
import { cn } from "@/lib/utils";
import { TopBar } from "./top-bar";
import { PlayerBar } from "./player-bar";
import { Browse, GenreCircle, groupByGenre } from "./browse";
import { SongRow } from "./song-row";
import { SongTable, fmtTotal } from "./song-table";
import { PlaylistMenu } from "./playlist-menu";
import { FollowButton } from "./follow-button";
import { ProfileView } from "./profile-view";
import { Toaster } from "./toaster";
import { Button } from "./ui/button";

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

/** All genres as circular cards — the "Show all" page for Browse by genre. */
function GenresView() {
  const { data: songs = [] } = useSongs();
  const setView = useView((s) => s.setView);
  const genres = groupByGenre(songs);
  return (
    <div>
      <button
        onClick={() => setView({ kind: "home" })}
        className="text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" /> Back
      </button>
      <h1 className="text-2xl font-bold tracking-tight">Genres</h1>
      <p className="text-muted-foreground mb-4 text-sm">{genres.length} genres</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {genres.map(([genre, list]) => (
          <GenreCircle key={genre} genre={genre} list={list} align="center" className="w-full" />
        ))}
      </div>
    </div>
  );
}

function SongsView() {
  const { data: songs = [] } = useSongs();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">All songs</h1>
      <SongTable tracks={songs} />
    </div>
  );
}

function ArtistsView() {
  const { data: songs = [] } = useSongs();
  const setView = useView((s) => s.setView);

  const byArtist = new Map<string, Track[]>();
  for (const s of songs) {
    if (!byArtist.has(s.artist)) byArtist.set(s.artist, []);
    byArtist.get(s.artist)!.push(s);
  }
  const artists = [...byArtist.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Artists</h1>
      <p className="text-muted-foreground mb-4 text-sm">{artists.length} artists</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {artists.map(([name, list]) => {
          const img = list.find((t) => t.imageUrl)?.imageUrl;
          return (
            <button
              key={name}
              onClick={() => setView({ kind: "artist", name })}
              className="bg-card hover:bg-accent/60 border-border focus-visible:ring-ring/50 flex flex-col items-center gap-3 rounded-xl border p-4 text-center transition-colors outline-none focus-visible:ring-2"
            >
              <div className="bg-muted size-24 shrink-0 overflow-hidden rounded-full">
                {img ? (
                  <Image src={img} alt={name} width={96} height={96} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Users className="text-muted-foreground size-8" />
                  </div>
                )}
              </div>
              <div className="min-w-0 self-stretch">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="text-muted-foreground text-xs">{list.length} songs</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Shared detail layout: back link, top-aligned artwork header, right-aligned Play, track table. */
function DetailView({
  back,
  eyebrow,
  title,
  subtitle,
  owner,
  image,
  cover,
  round,
  tracks,
  empty,
  showDate = false,
  playlistContext,
  belowMeta,
}: {
  back?: View;
  eyebrow: string;
  title: string;
  subtitle?: string;
  owner?: string;
  image?: string | null;
  cover?: React.ReactNode;
  round?: boolean;
  tracks: Track[];
  empty?: string;
  showDate?: boolean;
  playlistContext?: { id: number; name: string };
  belowMeta?: React.ReactNode;
}) {
  const setView = useView((s) => s.setView);
  const playQueue = usePlayer((s) => s.playQueue);
  const toggle = usePlayer((s) => s.toggle);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const current = useCurrentTrack();

  // Two states: if the playing track belongs to THIS list, the button toggles
  // pause/resume in place; otherwise it starts the list from the top.
  const listActive = current != null && tracks.some((t) => t.id === current.id);
  const playingThis = listActive && isPlaying;

  return (
    <div>
      {back && (
        <button
          onClick={() => setView(back)}
          className="text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" /> Back
        </button>
      )}
      <div className="mb-6 flex items-start gap-5">
        <div
          className={cn(
            "size-32 shrink-0 overflow-hidden",
            round ? "rounded-full" : "rounded-xl",
            !cover && "bg-muted border-border border",
          )}
        >
          {cover ? (
            cover
          ) : image ? (
            <Image src={image} alt={title} width={128} height={128} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Music className="text-muted-foreground size-10" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {eyebrow}
          </p>
          <h1 className="truncate text-3xl font-bold tracking-tight capitalize">{title}</h1>
          <p className="text-muted-foreground text-sm">
            {owner ? (
              <span className="text-foreground font-medium">{owner}</span>
            ) : subtitle ? (
              <span>{subtitle}</span>
            ) : null}
            {(owner || subtitle) && " · "}
            {tracks.length} {tracks.length === 1 ? "song" : "songs"}
            {tracks.length > 0 ? `, ${fmtTotal(tracks)}` : ""}
          </p>
          {belowMeta && <div className="mt-3">{belowMeta}</div>}
        </div>
        {tracks.length > 0 && (
          <Button
            className="shrink-0"
            onClick={() => (listActive ? toggle() : playQueue(tracks, 0))}
          >
            {playingThis ? (
              <>
                <Pause /> Pause
              </>
            ) : (
              <>
                <Play /> Play
              </>
            )}
          </Button>
        )}
      </div>
      {tracks.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty ?? "Nothing here yet."}</p>
      ) : (
        <SongTable tracks={tracks} showDate={showDate} playlistContext={playlistContext} />
      )}
    </div>
  );
}

function ArtistView({ name }: { name: string }) {
  const { data: songs = [] } = useSongs();
  const tracks = songs.filter((s) => s.artist === name);
  const artistId = tracks.find((t) => t.artistId != null)?.artistId ?? null;
  return (
    <DetailView
      back={{ kind: "artists" }}
      eyebrow="Artist"
      title={name}
      image={tracks.find((t) => t.imageUrl)?.imageUrl}
      round
      tracks={tracks}
      belowMeta={
        artistId != null ? <FollowButton artistId={artistId} artistName={name} /> : undefined
      }
    />
  );
}

function AlbumView({ id, title }: { id: number; title: string }) {
  const { data: songs = [] } = useSongs();
  const tracks = songs.filter((s) => s.albumId === id);
  return (
    <DetailView
      back={{ kind: "home" }}
      eyebrow="Album"
      title={title}
      subtitle={tracks[0]?.artist}
      image={tracks.find((t) => t.imageUrl)?.imageUrl}
      tracks={tracks}
    />
  );
}

function GenreView({ genre }: { genre: string }) {
  const { data: songs = [] } = useSongs();
  const tracks = songs.filter((s) => (s.genre || "other") === genre);
  return (
    <DetailView
      back={{ kind: "home" }}
      eyebrow="Genre"
      title={genre}
      image={tracks.find((t) => t.imageUrl)?.imageUrl}
      tracks={tracks}
    />
  );
}

function PlaylistView({ id, name, userName }: { id: number; name: string; userName: string }) {
  const { data, isLoading, isError, refetch } = usePlaylist(id);
  const setView = useView((s) => s.setView);
  if (isLoading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  if (isError)
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-destructive text-sm">Couldn&rsquo;t load this playlist.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setView({ kind: "playlists" })}>
            Back to playlists
          </Button>
        </div>
      </div>
    );
  const tracks = data?.tracks ?? [];
  const currentName = data?.playlist.name ?? name;
  return (
    <DetailView
      back={{ kind: "playlists" }}
      eyebrow="Playlist"
      title={currentName}
      owner={userName}
      image={tracks.find((t) => t.imageUrl)?.imageUrl}
      tracks={tracks}
      showDate
      empty="No songs yet — open the ⋯ menu on any song and add it here."
      playlistContext={{ id, name: currentName }}
    />
  );
}

/** The user's liked songs — a top-level library tab, no back navigation. */
function LikedView({ userName }: { userName: string }) {
  const { data: tracks = [], isLoading, isError, refetch } = useLikes();
  if (isLoading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  if (isError)
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-destructive text-sm">Couldn&rsquo;t load your liked songs.</p>
        <Button size="sm" variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  return (
    <DetailView
      eyebrow="Playlist"
      title="Liked Songs"
      owner={userName}
      // Signature gradient cover, kept monochrome to stay on our design system
      // (primary = grayscale) rather than Spotify's purple.
      cover={
        <div className="from-primary/30 to-primary/5 flex size-full items-center justify-center bg-gradient-to-br">
          <Heart className="text-primary size-12 fill-current" />
        </div>
      }
      tracks={tracks}
      showDate
      empty="Songs you like will appear here — tap the heart on any song."
    />
  );
}

function PlaylistsView() {
  const { data: playlists = [], isLoading } = usePlaylists();
  const createPlaylist = useCreatePlaylist();
  const setView = useView((s) => s.setView);

  // Fire-and-forget: the optimistic tile shows instantly; when the server id
  // arrives we open the new playlist. The "Created" toast fires from the global
  // MutationCache (see query-provider.tsx).
  const onCreate = () => {
    createPlaylist.mutate(undefined, {
      onSuccess: (p) => setView({ kind: "playlist", id: p.id, name: p.name }),
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Playlists</h1>
          <p className="text-muted-foreground text-sm">{playlists.length} playlists</p>
        </div>
        <Button onClick={onCreate} disabled={createPlaylist.isPending}>
          <Plus /> New playlist
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      ) : playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <ListMusic className="text-muted-foreground mb-3 size-10" />
          <p className="font-medium">No playlists yet</p>
          <p className="text-muted-foreground text-sm">
            Create one, or use the ⋯ menu on any song.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {playlists.map((p) => (
            <div
              key={p.id}
              onClick={() => setView({ kind: "playlist", id: p.id, name: p.name })}
              className="group bg-card hover:bg-accent/60 border-border flex cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left transition-colors"
            >
              <button
                aria-label={`Open ${p.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setView({ kind: "playlist", id: p.id, name: p.name });
                }}
                className="bg-muted focus-visible:ring-ring/50 flex aspect-square w-full items-center justify-center rounded-lg outline-none focus-visible:ring-2"
              >
                <ListMusic className="text-muted-foreground size-8" />
              </button>
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {p.count} {p.count === 1 ? "song" : "songs"}
                  </p>
                </div>
                <PlaylistMenu
                  id={p.id}
                  name={p.name}
                  count={p.count}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchView({ q }: { q: string }) {
  const { data, isLoading, isError, refetch } = useSearch(q);
  const setView = useView((s) => s.setView);

  const songs = data?.songs ?? [];
  const artistsR = data?.artists ?? [];
  const albumsR = data?.albums ?? [];
  const empty =
    !isLoading && !isError && songs.length === 0 && artistsR.length === 0 && albumsR.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        <p className="text-muted-foreground text-sm">Results for &ldquo;{q}&rdquo;</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-24">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      )}
      {isError && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-destructive text-sm">Search failed — the request didn&rsquo;t go through.</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}
      {empty && <p className="text-muted-foreground text-sm">No results for &ldquo;{q}&rdquo;.</p>}

      {artistsR.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Artists</h2>
          <div className="flex flex-wrap gap-2">
            {artistsR.map((a) => (
              <button
                key={a.id}
                onClick={() => setView({ kind: "artist", name: a.name })}
                className="bg-card hover:bg-accent border-border rounded-full border px-4 py-2 text-sm font-medium transition-colors"
              >
                {a.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {albumsR.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Albums</h2>
          <div className="flex flex-wrap gap-2">
            {albumsR.map((a) => (
              <button
                key={a.id}
                onClick={() => setView({ kind: "album", id: a.id, title: a.title })}
                className="bg-card hover:bg-accent border-border rounded-full border px-4 py-2 text-sm transition-colors"
              >
                <span className="font-medium">{a.title}</span>
                {a.artist ? <span className="text-muted-foreground"> · {a.artist}</span> : null}
              </button>
            ))}
          </div>
        </section>
      )}

      {songs.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Songs</h2>
          <div className="space-y-0.5">
            {songs.map((t, i) => (
              <SongRow key={t.id} tracks={songs} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Memoized so the URGENT tab-highlight render (where deferredView is unchanged)
// skips the content subtree entirely — only the deferred pass re-renders it.
const MainView = memo(function MainView({
  view,
  userName,
  userImage,
}: {
  view: View;
  userName: string;
  userImage?: string;
}) {
  switch (view.kind) {
    case "home":
      return <Browse />;
    case "songs":
      return <SongsView />;
    case "artists":
      return <ArtistsView />;
    case "playlists":
      return <PlaylistsView />;
    case "likes":
      return <LikedView userName={userName} />;
    case "profile":
      return <ProfileView userName={userName} userImage={userImage} />;
    case "genres":
      return <GenresView />;
    case "genre":
      return <GenreView genre={view.genre} />;
    case "artist":
      return <ArtistView name={view.name} />;
    case "album":
      return <AlbumView id={view.id} title={view.title} />;
    case "playlist":
      return <PlaylistView id={view.id} name={view.name} userName={userName} />;
    case "search":
      return <SearchView q={view.q} />;
  }
});

// Memoized: this panel is mounted on every tab, so without memo it reconciled
// its full song list on each AppShell re-render (tab switch, playback change).
const RightPanel = memo(function RightPanel() {
  const { data: songs = [] } = useSongs();
  return (
    <aside className="border-border bg-card/40 hidden w-80 shrink-0 flex-col rounded-lg border lg:flex">
      <div className="border-border border-b p-4">
        <h2 className="font-semibold">Songs</h2>
        <p className="text-muted-foreground text-xs">{songs.length} tracks</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {songs.map((t, i) => (
          <SongRow key={t.id} tracks={songs} index={i} />
        ))}
      </div>
    </aside>
  );
});

export function AppShell({
  name,
  email,
  image,
}: {
  name: string;
  email?: string;
  image?: string;
}) {
  const view = useView((s) => s.view);
  const setView = useView((s) => s.setView);
  // The tab highlight reads the URGENT view (paints in the same frame as the
  // click); the heavy main content reads a DEFERRED copy so its render can't
  // block that highlight paint. Without this, a 289-row list render sat in the
  // same commit as the highlight, so the active tab colour only appeared after
  // the list finished.
  const deferredView = useDeferredValue(view);
  const activeTab = tabFor(view);

  return (
    // select-none: click-heavy player chrome shouldn't text-select on drags and
    // double-clicks; inputs re-enable selection in globals.css @layer base.
    <div className="bg-background flex h-screen select-none flex-col">
      <TopBar name={name} email={email} image={image} />

      <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
        <nav className="bg-card/40 border-border hidden w-60 shrink-0 flex-col rounded-lg border p-3 md:flex">
          <div className="text-muted-foreground mb-2 flex items-center gap-2 px-2 text-sm font-semibold">
            <Library className="size-4" /> Your Library
          </div>
          <div className="space-y-1">
            {TABS.map((t) => (
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
          <MainView view={deferredView} userName={name} userImage={image} />
        </main>

        <RightPanel />
      </div>

      <PlayerBar />
      <Toaster />
    </div>
  );
}