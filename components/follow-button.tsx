"use client";

import { useFollowedIds, useToggleFollow } from "@/lib/use-follows";
import { Button } from "@/components/ui/button";

/** Follow / Following pill for an artist. Optimistic — flips instantly. */
export function FollowButton({ artistId, artistName }: { artistId: number; artistName: string }) {
  const followedIds = useFollowedIds();
  const toggle = useToggleFollow();
  const following = followedIds.has(artistId);

  return (
    <Button
      variant={following ? "secondary" : "outline"}
      size="sm"
      className="rounded-full"
      onClick={() => toggle.mutate({ artistId, artistName, following: !following })}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}