# Implementation Report: Branch B — `feat/sdr-brain` (the SDR brain)

## Summary
Implemented Wave-1 Branch B: the product core. `EnrichedLead` → source-grounded reasoning
chain (non-obvious angle) → 2 copy variants → designed Satori artifact (PNG) → `creatives`
write path. Plan source: `wave-1-core-loop.plan.md` → "Branch B — feat/sdr-brain". (The
requested path `wave-1/B-sdr-brain.impl.md` does not exist; B is unambiguously that section.)

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Critical-path (Gate 1) | As predicted — the artifact/font/JSX plumbing was the real work |
| Confidence | High ("ships alone" on mock) | Confirmed — smoke runs with zero external services |
| Files Changed | 5 | 5 changed + 1 created + 2 font assets + .gitignore |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | `lib/agents.ts` — `reason`, `writeCopy` | ✅ Complete | OpenAI structured outputs via `zodResponseFormat` |
| 2 | `lib/artifact.tsx` — `renderArtifact` | ✅ Complete | Satori + resvg, 2 templates, real logo / monogram fallback |
| 3 | `convex/creatives_write.ts` — `create`, `setArtifact` (+`generateUploadUrl`, `artifactUrl`) | ✅ Complete | Mirrors `seed.ts` + `validators.ts` |
| 4 | `app/api/artifact/[id]/route.ts` — serve PNG | ✅ Complete | Resolves creative → signed storage URL → 302 |
| 5 | `scripts/smoke-brain.ts` — Gate-1 smoke | ✅ Complete | Real brain w/ key, fixture chain without |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (tsc) | ⚠️ Blocked (environmental) | Only errors: `@/convex/_generated/*` missing — needs `npx convex dev` (codegen requires a live deployment; tsconfig notes convex is typechecked there). My non-Convex code is clean. |
| Smoke (`pnpm smoke:brain`) | ✅ Pass | Reasoning chain + 2 copy variants printed; 2 PNGs (1200×630) rendered |
| Artifact eyeball | ✅ Pass | Real Inter rendering, pixel-perfect text, clean hierarchy, light + dark variants |
| Real OpenAI path | ⏳ Not run | No `OPENAI_API_KEY` headless — code follows structured-output contract; run `pnpm smoke:brain` with a key on 5 real companies before declaring Gate 1 done |
| Convex write path | ⏳ Not run | Needs `npx convex dev` + seeded company/person |

## Files Changed

| File | Action | Lines |
|---|---|---|
| `lib/agents.ts` | IMPLEMENTED | +137 |
| `lib/artifact.tsx` | IMPLEMENTED | +293 |
| `convex/creatives_write.ts` | IMPLEMENTED | +70 |
| `scripts/smoke-brain.ts` | IMPLEMENTED | +149 |
| `app/api/artifact/[id]/route.ts` | CREATED | +27 |
| `public/fonts/Inter-{Regular,SemiBold}.ttf` | ADDED | Satori fonts (Wave 0 gap) |
| `.gitignore` | UPDATED | ignore `.artifacts/` |

## Deviations from Plan
- **`renderArtifact` signature**: added an optional `anchorFact` field to the input object.
  `anchorFact` lives on `ReasonResult`, not `Reasoning`, so the template couldn't show the
  real hook otherwise. Additive + optional → existing `{reasoning, lead, variant}` callers
  still compile. WHY: the artifact's headline IS the anchor fact.
- **`reason` API schema**: OpenAI structured outputs reject a top-level union, so the API
  call uses an internal object schema (`ReasonResponse`) then maps to the contract's
  `ReasonResult` union (skip decided by `confidence < 0.5`). The public signature is unchanged.
- **`creatives_write` extras**: added `generateUploadUrl` + `artifactUrl` beyond the planned
  `create`/`setArtifact` — required so the PNG can be uploaded from outside Convex and served
  by the route. No collision with `creatives_read` (Branch C).
- **Fonts vendored**: Wave 0 left `public/fonts/` with only `.gitkeep`; Satori needs real
  TTFs. Fetched static Inter 400/600 from the fontsource CDN.

## Issues Encountered
- **`React is not defined`** at render: tsconfig `jsx: preserve` → classic JSX runtime needs
  `React` in scope. Fixed by `import React from "react"` in `artifact.tsx`.
- **Clearbit logo fetch** returns no image in this sandbox → monogram fallback rendered
  (by design). With network to Clearbit the real logo inlines as a data URI.
- **Headless typecheck/codegen**: `convex codegen` needs a deployment; can't run headlessly.
  Expected for every Convex-touching branch pre-`convex dev`.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `scripts/smoke-brain.ts` | 1 runnable smoke | reason→writeCopy→renderArtifact end-to-end + PNG sanity asserts |

## Next Steps
- [ ] Run `pnpm smoke:brain` with `OPENAI_API_KEY` on 5 real companies (Gate 1 acceptance: 5 sharp, slop-free cards)
- [ ] `npx convex dev` → confirm `creatives_write` typechecks + write a creative end-to-end
- [ ] Code review via `/code-review`
