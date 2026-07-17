import { auth } from "@/lib/auth/server";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: session } = await auth.getSession();
  const u = session?.user;

  // The app is open: browse works signed-out. AppShell shows a Sign-in button
  // (not the profile menu), hides the personal tabs, and gates personal actions
  // behind a login prompt when `user` is null.
  return (
    <AppShell
      user={
        u
          ? {
              name: u.name ?? u.email?.split("@")[0] ?? "You",
              email: u.email ?? undefined,
              image: u.image ?? undefined,
            }
          : null
      }
    />
  );
}