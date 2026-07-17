"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";

import { authClient } from "@/lib/auth/client";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      social={{ providers: ["google", "github"] }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}