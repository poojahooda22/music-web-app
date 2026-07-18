"use client";

import { useSongs } from "@/lib/use-songs";
import { DetailView } from "../detail-view";
import { FollowButton } from "../follow-button";

export function ArtistView({ name }: { name: string }) {
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

export function AlbumView({ id, title }: { id: number; title: string }) {
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

export function GenreView({ genre }: { genre: string }) {
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