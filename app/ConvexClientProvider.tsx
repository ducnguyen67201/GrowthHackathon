"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

// ponytail: before `npx convex dev` has set the URL, render the static shell anyway
// (warn, don't crash). Any branch that uses useQuery will have run convex dev first.
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    if (typeof window !== "undefined") {
      console.warn("NEXT_PUBLIC_CONVEX_URL not set — run `npx convex dev`. Realtime queries are disabled.");
    }
    return <>{children}</>;
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
