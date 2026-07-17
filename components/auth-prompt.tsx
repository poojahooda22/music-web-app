"use client";

import { Music } from "lucide-react";

import { useAuthPrompt } from "@/lib/auth-prompt-store";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

/** The "log in to continue" dialog, opened by useAuthPrompt().prompt(reason). */
export function AuthPrompt() {
  const { open, reason, close } = useAuthPrompt();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader className="items-center text-center">
          <div className="bg-secondary mb-1 flex size-12 items-center justify-center rounded-full">
            <Music className="size-6" />
          </div>
          <DialogTitle>Log in to {reason ?? "continue"}</DialogTitle>
          <DialogDescription>
            Sign in or create a free account to {reason ?? "use this feature"}. Browsing stays open.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={close}>
            Not now
          </Button>
          <Button
            onClick={() => {
              close();
              window.location.href = "/auth/sign-in";
            }}
          >
            Sign in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
