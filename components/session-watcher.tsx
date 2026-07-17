"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth/client";

/**
 * After an OAuth redirect, the server renders the logged-OUT landing before the
 * client verifier exchange finishes setting the session cookie — which is why a
 * manual reload "fixes" it. Rendered on the signed-out landing, this watches the
 * client session and, the moment a user appears, refreshes the route ONCE so the
 * server re-reads the now-set cookie and swaps in the app. No manual reload.
 */
export function SessionWatcher() {
  const router = useRouter();
  const { data } = authClient.useSession();
  const refreshed = useRef(false);

  useEffect(() => {
    if (data?.user && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [data?.user, router]);

  return null;
}