import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

// ~700KB cap on the stored avatar data URL — the client resizes to a 256px
// JPEG (tens of KB); this just guards against an oversized payload.
const MAX_AVATAR_CHARS = 700_000;

async function requireUser() {
  const { data: session } = await auth.getSession();
  return session?.user ?? null;
}

// The app-owned profile overrides (name + avatar); the client falls back to the
// auth name/image when a field is null.
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({ displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  return NextResponse.json({ displayName: row?.displayName ?? null, avatarUrl: row?.avatarUrl ?? null });
}

export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // Only the provided fields change; an explicit null clears the avatar.
  const patch: { displayName?: string | null; avatarUrl?: string | null } = {};

  if (body?.displayName !== undefined) {
    if (typeof body.displayName !== "string" || !body.displayName.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    patch.displayName = body.displayName.trim().slice(0, 60);
  }

  if (body?.avatarUrl !== undefined) {
    if (body.avatarUrl === null) {
      patch.avatarUrl = null;
    } else if (typeof body.avatarUrl === "string" && body.avatarUrl.startsWith("data:image/")) {
      if (body.avatarUrl.length > MAX_AVATAR_CHARS) {
        return NextResponse.json({ error: "Image too large" }, { status: 413 });
      }
      patch.avatarUrl = body.avatarUrl;
    } else {
      return NextResponse.json({ error: "Invalid image" }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const now = new Date();
  const [saved] = await db
    .insert(profiles)
    .values({ userId: user.id, ...patch, updatedAt: now })
    .onConflictDoUpdate({ target: profiles.userId, set: { ...patch, updatedAt: now } })
    .returning({ displayName: profiles.displayName, avatarUrl: profiles.avatarUrl });

  return NextResponse.json({ displayName: saved.displayName, avatarUrl: saved.avatarUrl });
}