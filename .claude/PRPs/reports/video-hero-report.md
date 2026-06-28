# Implementation Report: Branch G — `feat/video-hero`

## Summary
Implemented the personalized hero-video amplifier: `lib/video.ts:renderHeroVideo` (OpenAI TTS → Remotion bundle/select/render → MP4 `Buffer`), the `remotion/HeroVideo.tsx` composition (logo lands, anchorFact slides in, brand-color accent, voiceover audio) + `remotion/Root.tsx` entry, a `scripts/make-video.ts` driver, and isolated Convex video read/write in `convex/creatives_video.ts`. One reasoned creative → one MP4 attached as `artifactType:"video"`.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium |
| Confidence | 8/10 | held — one expected codegen workaround |
| Files Changed | 6 | 7 (+generated api.d.ts) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Remotion deps + `video` script | ✅ Complete | `remotion`/`@remotion/bundler`/`@remotion/renderer` ^4, `pnpm install` clean |
| 2 | `remotion/Root.tsx` + `HeroVideo.tsx` | ✅ Complete | Mirrors artifact.tsx palette/monogram/quote; compositor-only motion |
| 3 | `renderHeroVideo` | ✅ Complete | TTS → data URI, `ensureBrowser`→`bundle`→`selectComposition`→`renderMedia` (tmp file → Buffer) |
| 4 | `convex/creatives_video.ts` | ✅ Complete | `getForVideo` join + `setVideoArtifact`; isolated per risk #5 |
| 5 | `scripts/make-video.ts` | ✅ Complete | Zod-parses joined lead, size-asserts MP4, uploads + flips type |
| 6 | Record backup MP4 | ⏳ Deferred | Rehearsal-time manual step (gated); cannot run headless here |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | ✅ Pass | `pnpm typecheck` clean (fixed: `fetch` body Buffer→Blob) |
| Lint | ⚠️ N/A | `next lint` unconfigured in repo (interactive setup prompt) — pre-existing; ran `prettier --write` instead |
| Unit Tests | ⚠️ N/A | Plan's runnable check is the in-script `MIN_MP4_BYTES` assert (Task 5); needs secrets + Chromium to exercise |
| Build | ⚠️ Skipped | New code is Node-script-only (not imported by any Next route) → outside the `next build` bundle; build gate not meaningful and needs Convex env |
| Integration / Render | ⏳ Manual | `pnpm video <creativeId>` needs `OPENAI_API_KEY` + live Convex deployment + a real reasoned creative + first-run Chromium download — run in rehearsal |

## Files Changed

| File | Action | Lines |
|---|---|---|
| `package.json` | UPDATED | +4 |
| `remotion/HeroVideo.tsx` | CREATED | +186 |
| `remotion/Root.tsx` | CREATED | +33 |
| `lib/video.ts` | UPDATED | +110 / -6 (stub replaced) |
| `convex/creatives_video.ts` | CREATED | +56 |
| `scripts/make-video.ts` | CREATED | +84 |
| `convex/_generated/api.d.ts` | UPDATED | +2 (manual codegen) |

## Deviations from Plan

1. **Convex codegen done by hand.** `npx convex codegen` / `convex dev` require Convex auth (not available in this environment). I manually added the two `creatives_video` lines to the tracked `convex/_generated/api.d.ts` exactly as the generator would. Running `npx convex dev` later regenerates the file identically — no drift. (This was the planned architecture; only the codegen step was manual.)
2. **`fetch` upload body.** Plan showed `body: mp4` (Buffer); strict DOM `BodyInit` rejects `Buffer`, so it's `new Blob([new Uint8Array(mp4)], { type: "video/mp4" })`.
3. **Render-in-script, not Convex action** — already a documented deviation in the plan (Remotion needs headless Chromium, impossible in Convex serverless Node). Implemented as planned.

## Issues Encountered
- `next lint` is unconfigured (prompts interactively) → used `prettier --write` for style. Pre-existing repo state.
- Convex codegen blocked on auth → manual `api.d.ts` patch (see Deviations).

## Tests Written
| Test | Location | Coverage |
|---|---|---|
| `MIN_MP4_BYTES` size assert | `scripts/make-video.ts` | Catches black/empty render at runtime (ponytail: one runnable check, no framework) |

## Next Steps
- [ ] `npx convex dev` once (codegen confirm + push `creatives_video`)
- [ ] `pnpm video <creativeId>` against a real reasoned creative; eyeball logo/name/fact + voiceover
- [ ] Record the backup MP4 in rehearsal (Task 6)
- [ ] Code review via `/code-review`; PR via `/prp-pr`
