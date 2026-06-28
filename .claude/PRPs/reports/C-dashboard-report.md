# Implementation Report: Wave 1 / Branch C — `feat/dashboard`

## Summary
Implemented the realtime pipeline dashboard over `creatives`: a Convex read module
(`list` query + `approve`/`editCopy`/`pickVariant` mutations) and a reasoning-first
card UI. Cards lead with the reasoning chain (saw → inferred → pain → angle → why),
show the artifact, editable copy with a variant switcher, a sources popover, and an
Approve action that flips `status` to `approved`. Builds against Wave 0 seed data —
no dependency on branches A or B.

> The named plan file `.claude/PRPs/plans/wave-1/C-dashboard.impl.md` did not exist;
> implemented directly from the Branch C spec in `wave-1-core-loop.plan.md`.

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | `convex/creatives_read.ts` — `list` query (joined, status filter) | Complete | Resolves company/person + artifact storage URL per row |
| 2 | `creatives_read` mutations — `approve`, `pickVariant`, `editCopy` | Complete | Bounds-checked; immutable variant replace |
| 3 | `components/ReasoningChain.tsx` — the visual hero | Complete | 5-step chain + confidence badge |
| 4 | `components/SourcesPopover.tsx` — cited receipts | Complete | URL-scheme guard on hrefs |
| 5 | `components/Card.tsx` — full card (artifact, copy editor, variants, approve) | Complete | Variant editor remounts via `key` — no resync effect |
| 6 | `app/page.tsx` + `components/Pipeline.tsx` — RT grid + filter tabs | Complete | Server gate + client `Pipeline` (see Deviations) |
| 7 | `components/dashboard.css` — design system over Wave 0 tokens | Complete | Hover/focus/active states, reduced-motion |
| 8 | `lib/dashboard.ts` + `scripts/smoke-dashboard.ts` — pure helpers + check | Complete | XSS guard + immutable-replace assertions |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (app `tsc`) | Pass | zero errors |
| Static Analysis (convex `tsc`) | Pass | checked separately — `convex/` is excluded from the app pass |
| Unit check (`smoke:dashboard`) | Pass | 13 assertions, framework-free |
| Build (`next build`) | Pass | `/` = 4.86 kB, 128 kB First Load JS (< 150 kB budget) |
| Lint | Skipped | `next lint` is unconfigured in Wave 0 (interactive setup prompt); not Branch C's to scaffold |
| Integration | N/A | needs a live Convex deployment (no auth available in sandbox) |

## Files Changed

| File | Action | Notes |
|---|---|---|
| `convex/creatives_read.ts` | IMPLEMENTED | was a stub |
| `app/page.tsx` | REPLACED | Wave 0 shell → server gate |
| `package.json` | UPDATED | added `smoke:dashboard` script |
| `components/Pipeline.tsx` | CREATED | client grid + filter (hooks live here) |
| `components/Card.tsx` | CREATED | |
| `components/ReasoningChain.tsx` | CREATED | |
| `components/SourcesPopover.tsx` | CREATED | |
| `components/types.ts` | CREATED | `CreativeCard` view type |
| `components/dashboard.css` | CREATED | |
| `lib/dashboard.ts` | CREATED | `safeHref`, `replaceVariant` (pure, shared) |
| `scripts/smoke-dashboard.ts` | CREATED | |
| `convex/_generated/*` | GENERATED | api/server/dataModel — committed by repo design |

## Deviations from Plan

1. **`convex/_generated` had to be generated.** Wave 0 never ran `npx convex dev`,
   so the generated dir (which `.gitignore` says *is* committed) was missing, and no
   Convex+React code can import the API without it. I couldn't auth a deployment in
   the sandbox, so I produced the files by invoking Convex's own codegen templates
   (`node_modules/convex/.../codegen_templates`) — byte-faithful to what `convex dev`
   emits, not hand-rolled. The next real `npx convex dev` will regenerate them identically.

2. **Server gate + client `Pipeline` instead of one client `page.tsx`.** The Wave 0
   `ConvexClientProvider` renders children *without* a Convex client when
   `NEXT_PUBLIC_CONVEX_URL` is unset (true during `pnpm build`), so any `useQuery` on
   the prerendered page throws. Splitting the route into a server gate (checks the same
   env) and a client `Pipeline` (owns the hooks) lets the build prerender a clean shell
   and keeps rules-of-hooks intact. WHY: matches the provider's existing guard exactly.

3. **`api` is typed as `anyApi`** until a real `convex dev` runs, so `useQuery`/
   `useMutation` are loose. The query result is cast once to `CreativeCard[]` at that
   boundary; mutations call through loosely. Resolves to precise types post-codegen.

## Issues Encountered

- `convex codegen` / `convex dev` require a deployment (`CONVEX_DEPLOYMENT`) — not
  available headless. Resolved via the codegen-template approach above.
- `next build` prerender crash on `useQuery` without a provider — resolved via the
  server-gate split (Deviation 2).

## Next Steps
- [ ] Run `npx convex dev` once to provision a deployment + regenerate `_generated`,
      then `npx convex run seed:run`, then `pnpm dev` to verify the grid renders live
      and Approve flips status (the one validation I couldn't run in-sandbox).
- [ ] Code review via `/code-review`
- [ ] Merge with branches A/B/D for Gate 2
