"use client";

import { useFollowedIds, useToggleFollow } from "@/lib/use-follows";
import { Button } from "@/components/ui/button";
import { useLoggedIn } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt-store";

/** Follow / Following pill for an artist. Optimistic — flips instantly. */
export function FollowButton({ artistId, artistName }: { artistId: number; artistName: string }) {
  const followedIds = useFollowedIds();
  const toggle = useToggleFollow();
  const loggedIn = useLoggedIn();
  const promptLogin = useAuthPrompt((s) => s.prompt);
  const following = followedIds.has(artistId);

  return (
    <Button
      variant={following ? "secondary" : "outline"}
      size="sm"
      className="rounded-full"
      onClick={() => {
        if (!loggedIn) return promptLogin("follow artists");
        toggle.mutate({ artistId, artistName, following: !following });
      }}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}