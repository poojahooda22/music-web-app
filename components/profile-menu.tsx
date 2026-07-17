"use client";

import { LogOut, User as UserIcon } from "lucide-react";

import { useProfile } from "@/lib/use-profile";
import { useView } from "@/lib/view-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return (parts[0] ?? "U").slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function ProfileMenu({
  name,
  email,
  image,
  onSignOut,
}: {
  name: string;
  email?: string;
  image?: string;
  onSignOut: () => void;
}) {
  const { data: profile } = useProfile();
  const setView = useView((s) => s.setView);

  // App-owned profile overrides the auth name/photo, so the top-right avatar
  // reflects the chosen photo and edited name immediately.
  const displayName = profile?.displayName ?? name;
  const avatar = profile?.avatarUrl ?? image;
  const initials = getInitials(displayName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-[3px]"
          aria-label={`Open user menu for ${displayName}`}
        >
          <Avatar className="size-9">
            <AvatarImage src={avatar} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuLabel className="flex items-center gap-2 py-2 font-normal">
          <Avatar className="size-8">
            <AvatarImage src={avatar} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{displayName}</div>
            {email && <div className="text-muted-foreground truncate text-xs">{email}</div>}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => setView({ kind: "profile" })}>
          <UserIcon />
          Profile
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}