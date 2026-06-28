# Impl: Branch H — `feat/signal-spine` ("the 52 triggers we watch")

> **Agent:** one (light branch). **Base:** `main@wave-0-done`. **Parallel-safe with** A/B/C/D.
> **JTBD:** make the growth-engine narrative real — show the trigger taxonomy and replay a real recent trigger (esp. job-change) through the loop. Mostly narrative + one free Fiber call.
> **Prereq:** `FIBER_API_KEY`, `npx convex dev`. Best paired with A+B for the full replay effect, but the panel ships standalone.

## Files
| File | Action |
|---|---|
| `convex/tracker.ts` | `listRules` action (Fiber `listAvailableTrackerRules`, cached) + `replay` action |
| `components/TriggerPanel.tsx` | renders the 52 rules + a "replay" button |

## Contract (from Wave 0)
- `action` from `convex/_generated/server`; `api` from `convex/_generated/api`.
- Reuses branch A's `ingest:ingestLead` + branch B's `creatives_write:generateForLead` for replay (so this branch is thin).

## `convex/tracker.ts`
```ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// 52 signal types: funding, hiring, JOB CHANGES, etc. Free endpoint.
export const listRules = action({ args: {}, handler: async () => {
  const res = await fetch("https://api.fiber.ai/v1/listAvailableTrackerRules", { headers: { "x-api-key": process.env.FIBER_API_KEY! } });
  if (!res.ok) throw new Error(`tracker rules ${res.status}`);
  const json = await res.json();
  // Zod-parse to a small shape: [{ key, label, category }]
  return json; // map/parse to the panel shape
}});

// Replay a REAL recent trigger through the loop (honest: real event, not a faked webhook).
export const replay = action({ args: { query: v.string() }, handler: async (ctx, a) => {
  const { companyId, /* personId via ingest */ } = await ctx.runAction(api.ingest.ingestLead, { query: a.query });
  // fetch personId for that company, then:
  // return ctx.runAction(api.creatives_write.generateForLead, { companyId, personId, lead });
}});
```
> For demo without waiting on a live webhook, `previewTrackerSignal` / `fireTrackerDummy` (both free) demonstrate the signal→action path. **Honesty guard: replay real recent events + dummy-fire; never claim a live webhook fired if it didn't.**

## `components/TriggerPanel.tsx`
- On mount, call `listRules` (via `useAction`) and render the 52 types grouped by category (funding · hiring · **job change** · ...).
- Feature **job-change** as the hero trigger ("your champion just moved to {co}") — highest-converting real sales trigger.
- A "Replay this trigger" input → `replay({query})` → a new reasoned card appears in the pipeline (branch C grid).
- Mounts as a panel/tab on the dashboard (coordinate one import line with branch C, or render on its own `/signals` route to avoid touching `app/page.tsx`).

## GOTCHAs
- `listAvailableTrackerRules` is free — safe to call live; cache the result in module memory or a small table if you want.
- Don't build real webhook infra (won't fire in 24h). Narrative spine + replay + dummy-fire is the demo.
- Keep it thin — this branch is narrative leverage, not a system.

## VALIDATE / Acceptance
- `npx convex run tracker:listRules` → the 52 rule types.
- The panel renders them; "replay" on a real recently-funded/hiring company → a reasoned card in the pipeline.
- `pnpm typecheck` green.
