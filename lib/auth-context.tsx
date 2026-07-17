"use client";

import { createContext, useContext } from "react";

/**
 * Server-verified logged-in state, provided once by AppShell so deep leaves
 * (song menu, player heart, follow button) can gate actions without prop
 * drilling. It's the initial server session; after a login the page reloads
 * (or SessionWatcher refreshes) with the user present.
 */
const LoggedInContext = createContext(false);

export const LoggedInProvider = LoggedInContext.Provider;

export function useLoggedIn(): boolean {
  return useContext(LoggedInContext);
}