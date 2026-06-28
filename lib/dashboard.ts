import type { CopyVariant } from "@/convex/validators";

// Pure dashboard helpers — shared by the UI (SourcesPopover) and the read-side
// mutation (creatives_read.editCopy), kept here so they're DRY and testable
// without React or the Convex runtime.

// Block javascript:/data: and other schemes before they reach an href (XSS).
export function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}

// Immutable replace of one copy variant. Throws on out-of-range index so a bad
// edit fails loudly instead of silently no-op'ing.
export function replaceVariant(
  variants: readonly CopyVariant[],
  index: number,
  next: CopyVariant,
): CopyVariant[] {
  if (index < 0 || index >= variants.length) {
    throw new Error(
      `variant index ${index} out of range (have ${variants.length})`,
    );
  }
  return variants.map((variant, i) => (i === index ? next : variant));
}
