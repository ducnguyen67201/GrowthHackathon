# Implementation Report: Branch E — `feat/live-gen`

## Summary
Implemented the live-gen WOW: a streaming single-lead orchestrator (`lib/livegen.ts`) that runs discover → reason → writeCopy → renderArtifact → Convex-persist as one call, reusing the existing pieces (never forking the loop). An NDJSON `ReadableStream` route (`app/api/live/route.ts`) drives it; a client page (`app/live/page.tsx`) renders the reasoning chain progressively then the finished card. A two-layer cache (in-memory Map + durable `.livecache/`) makes pre-warmed inputs instant and survives an API flake. A pre-warm script seeds demo inputs; a credit-free smoke test asserts the cache-replay event order.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium (matched) |
| Confidence | 8/10 | 9/10 — implemented as planned, no surprises |
| Files Changed | 3 create + 1 optional script | 6 create, 3 update |
| New dependencies | 0 | 0 (matched) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | `lib/livegen.ts` orchestrator | [done] Complete | Async generator yielding typed `LiveEvent`s |
| 2 | `app/api/live/route.ts` NDJSON stream | [done] Complete | Native `ReadableStream`, Node runtime, 503/400 guards |
| 3 | `app/live/page.tsx` + `live.css` | [done] Complete | Reuses `ReasoningChain` + dashboard `.reasoning*`/`.card-artifact` |
| 4 | Cache + durable backup | [done] Complete | Folded into `lib/livegen.ts` as planned |
| 5 | `scripts/prewarm-live.ts` | [done] Complete | + `pnpm prewarm` script |
| — | One runnable check | [done] Complete | `scripts/smoke-live.ts` + `pnpm smoke:live` |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | [done] Pass | `tsc --noEmit` zero errors |
| Lint | [skipped] | ESLint not configured in repo (interactive setup prompt); Next build's type-validity check passes instead |
| Unit / Smoke | [done] Pass | `pnpm smoke:live` — cache-replay event order asserted, zero API keys needed |
| Build | [done] Pass | `next build` ✓; `/live` static (1.78 kB), `/api/live` dynamic |
| Integration | [done] Pass | Live `curl` against dev server: NDJSON `reasoning→5 steps→rendering→done(cached)`; empty-query→400; no-Convex→503 |
| Edge Cases | [done] Pass | Empty query (400), Convex unset (503), cache hit replay, multi-byte decode, runId omitted |

## Files Changed

| File | Action | Lines |
|---|---|---|
| `lib/livegen.ts` | CREATED | +258 |
| `app/api/live/route.ts` | CREATED | +44 |
| `app/live/page.tsx` | CREATED | +186 |
| `app/live/live.css` | CREATED | +130 |
| `scripts/smoke-live.ts` | CREATED | +78 |
| `scripts/prewarm-live.ts` | CREATED | +18 |
| `package.json` | UPDATED | +2 (smoke:live, prewarm scripts) |
| `.gitignore` | UPDATED | +3 (.livecache/) |
| `.claude/PRPs/plans/wave-2-amplifiers.plan.md` | UPDATED | status pointers |

## Deviations from Plan
- **Lint skipped, not run.** The repo has no ESLint config; `next lint` only offers interactive setup. Scaffolding ESLint was out of scope (no other branch has it). Next's build-time type/validity check covers the gap.
- **Integration test used a dummy `NEXT_PUBLIC_CONVEX_URL`.** The real value is empty in `.env.local` (Convex never provisioned here). The cache-replay path returns before any `ConvexHttpClient` is constructed, so a dummy URL exercises the full HTTP/stream path with zero real Convex/Fiber/OpenAI calls (and zero credit spend). The 503 guard was separately confirmed with the var unset.

## Issues Encountered
- **Buffer not a typed `BodyInit`** — `fetch({body: png})` failed typecheck; fixed by copying to `new Uint8Array(png)`.
- **Generator union narrowing** — `ev.stage` access needed `"stage" in ev` guard in `prewarm`.
- **`Record` index access** — `STAGE_TEXT[ev.stage]` is `string | undefined`; added `?? ev.stage` fallback.
- All caught immediately by per-change typecheck; none required design changes.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `scripts/smoke-live.ts` | 1 self-check (event order + cached flag + creativeId) | Cache-replay path of `runLive` — credit-free, no API keys |

> Live API paths (real Fiber/OpenAI discover→reason→render) are covered by manual/demo validation, not automated — running them spends real credits (per plan risk table). Pre-warm those via `pnpm prewarm`.

## Next Steps
- [ ] Provision Convex (`npx convex dev`) so `NEXT_PUBLIC_CONVEX_URL` is populated, then run the full live path end-to-end (`pnpm dev` → `/live` → type "Vercel").
- [ ] `pnpm prewarm` the morning of the demo to fill `.livecache/` (instant + flake-proof).
- [ ] Code review via `/code-review`
- [ ] Create PR via `/prp-pr`
