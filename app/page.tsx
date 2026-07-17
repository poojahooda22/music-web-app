import Link from "next/link";
import { Music } from "lucide-react";

import { auth } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { SessionWatcher } from "@/components/session-watcher";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return (
      <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
        {/* If we landed here right after an OAuth redirect, the client session
            arrives a beat later — refresh once it does so the app swaps in. */}
        <SessionWatcher />
        <div className="border-border bg-card text-foreground flex size-12 items-center justify-center rounded-xl border">
          <Music className="size-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your music, everywhere</h1>
          <p className="text-muted-foreground text-sm">Sign in to start listening</p>
        </div>
        <Button asChild>
          <Link href="/auth/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  }

  const u = session.user;
  return (
    <AppShell
      name={u.name ?? u.email?.split("@")[0] ?? "You"}
      email={u.email ?? undefined}
      image={u.image ?? undefined}
    />
  );
}