# Implementation Report: Branch A — `feat/fiber-data`

## Summary
Implemented the Fiber signal layer: a pure-fetch client (`lib/fiber.ts`) grounded in the real `api.fiber.ai/ai-docs` endpoint shapes, Convex persistence (`companies`/`people` upsert), an `ingestLead` action that ties discovery→enrich→social→reveal→persist, and a smoke test. **Static validation (tsc) passes; runtime + Convex validation is GATED on `FIBER_API_KEY` + `npx convex dev`** (neither available in this environment).

## Assessment vs Reality
| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium |
| Files | 5 | 5 (4 modified, 1 new) |
| Runtime-validatable here? | needs key | No — key + convex auth absent |

## Tasks Completed
| # | Task | Status | Notes |
|---|---|---|---|
| 1 | `lib/fiber.ts` (client + orchestrator) | ✅ Complete | tsc green; grounded in real ai-docs shapes |
| 2 | `convex/companies.ts` upsert/getByFiberId | ✅ Written | validated under `convex dev` (deferred) |
| 3 | `convex/people.ts` upsert | ✅ Written | validated under `convex dev` (deferred) |
| 4 | `convex/ingest.ts` ingestLead action | ✅ Written | `"use node"`; validated under `convex dev` (deferred) |
| 5 | `scripts/smoke-fiber.ts` | ✅ Complete | harness runs; stops at key check as designed |

## Validation Results
| Level | Status | Notes |
|---|---|---|
| Static Analysis (tsc) | ✅ Pass | 0 errors (lib + scripts; convex excluded by design) |
| Lint | ⚪ Skipped | no eslint config wired yet |
| Unit/Smoke | 🟡 Partial | harness runs to the key check; real Fiber call PENDING `FIBER_API_KEY` |
| Build | ✅ Unaffected | no app-facing changes; tsc green (lib/fiber not in app bundle) |
| Convex codegen/push | ⏳ Pending | needs `npx convex dev` (user auth) |
| Integration (ingest) | ⏳ Pending | needs key in Convex env + `convex dev` |

## Files Changed
| File | Action | Lines (approx) |
|---|---|---|
| `lib/fiber.ts` | IMPLEMENTED | ~210 |
| `convex/companies.ts` | IMPLEMENTED | ~30 |
| `convex/people.ts` | IMPLEMENTED | ~30 |
| `convex/ingest.ts` | CREATED | ~40 |
| `scripts/smoke-fiber.ts` | IMPLEMENTED | ~30 |

## Deviations from Plan (WHAT / WHY)
1. **social-media-lookup returns social *profiles/handles*, not post text.** `socialLookup` returns the discovered profile + bio as a degraded `SocialPost`. **WHY:** that's the real API shape (polling `data[].candidates[]` = profiles). **Follow-up:** to get real recent POST text (the insight edge), add a tweet/post-fetch call (X/IG) using the handle — needs the key to verify its shape. Marked with a `ponytail:` note in code.
2. **`getLogo` uses the Google favicon service** (`s2/favicons`) instead of a Fiber logos endpoint. **WHY:** reliable real logo with no unverified Fiber call; swap to Fiber `/logos` for hi-res later.
3. **Lenient `.passthrough()` Zod schemas** rather than strict. **WHY:** can't verify exact nested response shapes without the key; strict parsing would hard-fail on the first real call. **Tighten** once a real response is captured.
4. **`searchCompanies` uses `companySearch` (keyword filter)**, not `textToCompanySearch` (NL). **WHY:** the `textToCompanySearch` ai-doc 404'd; only `companySearch` shape is confirmed. NL search can swap in once verified.
5. **`convex/ingest.ts` is `"use node"`.** **WHY:** `lib/fiber` uses `setTimeout`/`performance` (social poll loop) not available in Convex's default action runtime.

## Issues Encountered
- No `FIBER_API_KEY` and `convex dev` not run in this environment → runtime + codegen validation deferred. Code written to documented patterns; the user validates on their machine.
- `@/lib/schemas` alias → switched `lib/fiber.ts` to a **relative** `./schemas` import so Convex can bundle it from the action (alias may not resolve in Convex's bundler).

## How to finish validation (user steps)
```bash
# 1. key in BOTH places
echo 'FIBER_API_KEY=...' >> .env.local
npx convex env set FIBER_API_KEY ...     # Convex actions read env from the deployment, not .env.local
# 2. codegen + push
npx convex dev
# 3. validate
pnpm smoke:fiber "Series A devtools hiring SDRs"          # real lead + [fiber charge] log
npx convex run ingest:ingestLead '{"query":"Series A devtools hiring SDRs"}'  # rows in dashboard
```
Then confirm field mappings against the real response and tighten the Zod schemas (deviation #3) + wire real post-fetch (deviation #1).

## Next Steps
- [ ] User: add key + `convex dev`, run the two validate commands above.
- [ ] Tighten Zod + wire X/IG post-fetch for real post text.
- [ ] `/code-review` then `/prp-commit` / `/prp-pr`.
