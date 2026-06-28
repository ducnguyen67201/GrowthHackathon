# Impl: Branch C — `feat/dashboard` (the cyborg review UI)

> **Agent:** one. **Base:** `main@wave-0-done`. **Parallel-safe with** A/B/D/H (uses `creatives_read.ts`, not `_write`).
> **JTBD:** browse the pipeline, render the reasoning chain **first-class**, edit/pick-variant/approve. Builds against **seed data** — does NOT need A or B.
> **Prereq:** `npx convex dev` running + `npx convex run seed:run` (gives you 4 creatives).

## Files
| File | Action |
|---|---|
| `convex/creatives_read.ts` | `list` query (+ joined company/person + artifactUrl), `approve`/`pickVariant`/`editCopy` mutations |
| `app/page.tsx` | replace shell with the realtime grid (`"use client"`) |
| `components/Card.tsx` | one creative card |
| `components/ReasoningChain.tsx` | the saw→inferred→angle→why block (THE hero element) |
| `components/SourcesPopover.tsx` | sources (field/post + url) |

## Contract (from Wave 0)
- `Doc`, `Id` from `convex/_generated/dataModel`; `api` from `convex/_generated/api`.
- `useQuery`, `useMutation` from `convex/react`. Tokens in `styles/tokens.css` (use the CSS vars — don't hardcode palette).

## `convex/creatives_read.ts`
```ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    const rows = status
      ? await ctx.db.query("creatives").withIndex("by_status", q => q.eq("status", status as any)).order("desc").collect()
      : await ctx.db.query("creatives").order("desc").collect();
    return Promise.all(rows.map(async (c) => ({
      ...c,
      company: await ctx.db.get(c.companyId),
      person: await ctx.db.get(c.personId),
      artifactUrl: c.artifactStorageId ? await ctx.storage.getUrl(c.artifactStorageId) : null,
    })));
  },
});

export const approve = mutation({ args: { id: v.id("creatives") },
  handler: (ctx, a) => ctx.db.patch(a.id, { status: "approved" }) });

export const pickVariant = mutation({ args: { id: v.id("creatives"), index: v.number() },
  handler: (ctx, a) => ctx.db.patch(a.id, { chosenCopyIndex: a.index }) });

export const editCopy = mutation({
  args: { id: v.id("creatives"), index: v.number(), subject: v.string(), body: v.string() },
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.id); if (!c) throw new Error("not found");
    const copyVariants = c.copyVariants.map((cv, i) => (i === a.index ? { subject: a.subject, body: a.body } : cv));
    await ctx.db.patch(a.id, { copyVariants });
  },
});
```

## `app/page.tsx` (client)
```tsx
"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Card } from "@/components/Card";

export default function Home() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const creatives = useQuery(api.creatives_read.list, { status });
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--space-3)" }}>
      <header>{/* brand + status filter chips: all / draft / approved / sent */}</header>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: "var(--space-2)" }}>
        {creatives?.map((c) => <Card key={c._id} creative={c} />)}
      </section>
    </main>
  );
}
```

## `components/ReasoningChain.tsx` (THE hero — make it the visual focus)
- Render `saw → inferred → pain → angle`, and **`whyThisAngle` emphasized** (this is what reads as senior-rep judgment).
- Show `confidence` as a small bar. Type props from the query row (`Doc<"creatives">["reasoning"]`).
- Do NOT bury this behind a click. It's the first thing a judge sees.

## `components/Card.tsx`
- Layout: artifact image (`artifactUrl`, lazy-loaded) + `ReasoningChain` + editable copy (variant switcher → `pickVariant`, inline edit → `editCopy`) + a `SourcesPopover` + an **Approve** button (`approve`).
- Use `useMutation(api.creatives_read.approve)` etc. Optimistic feel: Convex re-renders on write automatically.

## GOTCHAs
- `useQuery` auto-subscribes — no polling, no useEffect fetching.
- The reasoning chain is the hero; the artifact is proof. Hierarchy: reasoning legible in 2s.
- Build entirely against seed data — you don't need A/B merged.

## VALIDATE / Acceptance
- `pnpm dev` → seeded cards render live; the reasoning chain is the visual focus.
- Approve flips a card to `approved` (re-renders instantly); edit copy + pick variant persist.
- `pnpm typecheck` green.
