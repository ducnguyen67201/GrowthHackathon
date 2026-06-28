# Implementation Report: Wave-2 Branch F — Overnight Batch

## Summary
Implemented the `pnpm coverage` overnight batch runner that pushes 50–300 real ICP companies through the existing reason→artifact pipeline into Convex as draft `creatives`. Added run checkpointing (`convex/runs.ts`), implemented the stubbed `socialLookupBatch`, and wrote the batch orchestrator (`scripts/coverage.ts`) with a stdlib concurrency pool, retry-once, idempotency, and a pre-spend credit guard.

## Assessment vs Reality
| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium |
| Confidence | 8/10 | held — only the unverifiable Fiber batch shape remains a runtime unknown (handled by lenient Zod) |
| Files Changed | 3 (+codegen) | 4 (3 source + 1 generated `api.d.ts` entry) |

## Tasks Completed
| # | Task | Status | Notes |
|---|---|---|---|
| 1 | `convex/runs.ts` — checkpointing + idempotency | ✅ Complete | `start`/`tick`/`finish`/`hasCreativeForCompany`/`logLine` |
| 2 | `lib/fiber.ts` — `socialLookupBatch` | ✅ Complete | trigger→poll mirror, lenient Zod, per-handle degrade |
| 3 | `scripts/coverage.ts` — helpers + selfcheck | ✅ Complete | `mapPool`/`withRetry`/`cap`/`parseArgs` + `--selfcheck` |
| 4 | `scripts/coverage.ts` — batch runner | ✅ Complete | cohort → credit guard → pool(5) → checkpoint; chose per-company social (verified path) per plan recommendation |

## Validation Results
| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | ✅ Pass | `pnpm typecheck` clean (2 strict-mode fixes: noUncheckedIndexedAccess guard, `Uint8Array` body) |
| Lint | ⚠️ Skipped | `next lint` is deprecated and prompts interactively; can't run headless. Prettier formatted all 3 files. |
| Unit Tests (`--selfcheck`) | ✅ Pass | mapPool concurrency cap + order + empty; withRetry success/exhaust; cap bounds |
| Build (`next build`) | ⏭️ N/A | No app/route touched; build needs live env and wouldn't exercise F. Out of scope. |
| Convex codegen (`npx convex dev`) | ⏭️ Deferred | No deployment/network here. Added the `runs` entry to `api.d.ts` manually (exactly what convex dev emits); run `npx convex dev` once to reconcile. |
| Integration (`--limit 50`) | ⏭️ Deferred | Needs `FIBER_API_KEY` + `OPENAI_API_KEY` + a Convex deployment — run before the overnight batch. |

## Files Changed
| File | Action | Lines |
|---|---|---|
| `convex/runs.ts` | CREATED | +60 |
| `scripts/coverage.ts` | REWRITTEN | +260 / -13 |
| `lib/fiber.ts` | UPDATED | +60 / -4 (replaced stub) |
| `convex/_generated/api.d.ts` | UPDATED | +2 (runs module entry) |

## Deviations from Plan
- **Per-company social over batch-warm** (Task 4 GOTCHA decision): coverage uses the verified `socialLookup` per company inside the pool. `socialLookupBatch` is implemented and ready as the documented scale optimization but not wired into the orchestrator yet — switch only if 300× trigger/poll proves too slow. Marked with a `ponytail:` comment.
- **Manual `api.d.ts` edit**: added the `runs` module entry by hand because `npx convex dev` can't run offline here. Reconcile by running convex dev once.

## Issues Encountered
- `node_modules` was missing → `pnpm install`.
- Strict TS: `noUncheckedIndexedAccess` flagged `items[i]` in `mapPool` (fixed with an `undefined` guard, no cast); `fetch` rejected `Buffer` body (fixed with `new Uint8Array(png)`).

## Tests Written
| Test | Location | Coverage |
|---|---|---|
| `--selfcheck` (assert-based, no framework) | `scripts/coverage.ts:runSelfcheck` | mapPool concurrency/order/empty, withRetry success+exhaust, cap bounds |

## Next Steps
- [ ] `npx convex dev` once to regenerate codegen and deploy `runs.ts`
- [ ] `pnpm coverage --limit 50` dry-run within credits (needs keys + deployment), confirm dashboard shows drafts and re-run skips
- [ ] Code review via `/code-review`
- [ ] Overnight `pnpm coverage` (≤300)
