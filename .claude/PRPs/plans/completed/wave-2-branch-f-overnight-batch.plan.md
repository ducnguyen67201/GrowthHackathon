# Plan: Wave-2 Branch F — Overnight Batch (`feat/overnight-batch`)

## Summary
A Node script (`pnpm coverage`) that runs 50–300 real ICP companies through the existing reason→artifact pipeline overnight, persisting reasoned `creatives` (status `draft`) to Convex. Concurrency 5, idempotent (skips already-generated companies), checkpointed to a `runs` row, credit-guarded. Implements the stubbed `socialLookupBatch` and a new `convex/runs.ts`.

## User Story
As the operator running Cutthrough the night before a demo, I want to kick off a batch that reasons over hundreds of real companies while I sleep, so that I wake up to a full pipeline of source-grounded cards in the dashboard — within Fiber credits and resumable if it crashes.

## Problem → Solution
Today the loop runs one lead at a time (`ingestLead` action / smoke scripts); `scripts/coverage.ts` and `socialLookupBatch` are throwing stubs and `convex/runs.ts` does not exist. → A self-contained batch runner that reuses Fiber + `reason`/`writeCopy` + `renderArtifact` + Convex mutations, with a stdlib concurrency pool, retry-once, idempotency, and run checkpointing.

## Metadata
- **Complexity**: Medium (3 files, ~250–350 lines, no new deps)
- **Source PRD**: `.claude/PRPs/plans/wave-2-amplifiers.plan.md` (Branch F)
- **PRD Phase**: Wave 2 — Branch F `feat/overnight-batch`
- **Estimated Files**: 3 (1 CREATE, 2 UPDATE)

---

## UX Design

### Before / After
Internal/CLI change — no in-app UX. Operator-facing surface is the terminal:

```
$ pnpm coverage --limit 50 --query "seed-stage devtools startups"
[coverage] cohort: 50 companies (capped from 73)
[coverage] credits: 41200 available, est ≤ 2500 needed — ok
[coverage] run rk7… started
[coverage] 12/50  ✓ Vercel    (draft creative cre_…)
[coverage] 13/50  ⤳ skip      Acme (confidence 0.41 < 0.5)
[coverage] 14/50  ↻ retry     Foo (enrich miss) → ✓
[coverage] 15/50  ✗ fail      Bar (no contact found)
…
[coverage] done: 47 drafts, 3 skipped, 0 failed — 1840 credits spent
```
The generated `creatives` then appear live in the existing dashboard grid (Branch C `creatives_read.list`).

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| `pnpm coverage` | throws "not impl" | runs the batch | `--limit N` (default 300, cap 300), `--query "…"`, `--dry`, `--selfcheck` |
| `socialLookupBatch()` | throws "not impl" | returns `Record<handle, SocialPost[]>` | one Fiber batch trigger+poll for the whole cohort |
| `runs` table | empty | one row per batch (running→done) | checkpoint: `done`/`failed`/`costCredits` |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `lib/fiber.ts` | 158-235 | `socialLookup` trigger/poll shape to mirror for `socialLookupBatch`; `discoverAndEnrich`, `getCredits`, `searchCompanies`, `findContact`, `enrich`, `revealEmail`, `getLogo` signatures to compose |
| P0 | `lib/agents.ts` | 59-134 | `reason(lead)` returns `ReasonResult` (skip union); `writeCopy(reasoning, lead)` — the brain, reuse as-is |
| P0 | `lib/artifact.tsx` | 267-295 | `renderArtifact({reasoning, lead, anchorFact, variant})` → `Buffer` |
| P0 | `convex/creatives_write.ts` | 1-66 | `create`, `generateUploadUrl`, `setArtifact` — the exact persist+upload flow to call from the script |
| P0 | `convex/schema.ts` | 32-95 | `creatives` (fields, `by_company` index), `runs`, `log` table shapes — what `runs.ts` writes |
| P1 | `convex/companies.ts` | 1-30 | `upsert` (idempotent patch by `fiberId`) returns `Id<"companies">` |
| P1 | `convex/people.ts` | 1-30 | `upsert` returns `Id<"people">` |
| P1 | `app/api/artifact/[id]/route.ts` | 1-35 | Canonical `ConvexHttpClient` usage from outside Convex (`convex/browser`, `NEXT_PUBLIC_CONVEX_URL`) |
| P1 | `lib/schemas.ts` | 1-60 | `EnrichedLead`, `SocialPost`, `ReasonResult`, `CopyVariant`, `Reasoning` types |
| P2 | `scripts/smoke-brain.ts` | 1-152 | Script conventions: `@/` imports, `main().catch(exit 1)`, key-presence branching, byte-size sanity asserts |
| P2 | `convex/ingest.ts` | 1-37 | The single-lead orchestration this batch parallelizes; note the `Id<>` annotation remedy for action type cycles |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Fiber batch social lookup | `api.fiber.ai/ai-docs/social-media-lookup/batch/*` (verify against real key) | endpoints are async: `…/batch/trigger` returns a run id → poll `…/batch/poll`; shape unverifiable in this env, so keep Zod **lenient** (`.passthrough()` + optional) exactly like `socialPollResp` |
| ConvexHttpClient | `convex/browser` (already used in repo) | `new ConvexHttpClient(url)`; `.mutation(api.x.y, args)` / `.query(...)`; for storage upload, `generateUploadUrl` mutation → `fetch(url, {method:"POST", body: png})` → `{storageId}` → `setArtifact` |

No further external research needed — everything else is established internal patterns.

---

## Patterns to Mirror

### TRIGGER_POLL (for socialLookupBatch)
```ts
// SOURCE: lib/fiber.ts:158-179
const trig = await post("/v1/social-media-lookup/trigger", { person: { linkedinUrl: handleOrUrl }, platforms: ["TWITTER", "INSTAGRAM"] }, socialTriggerResp);
const runId = trig.output.socialMediaFinderRunId;
const deadline = 8000; const start = performance.now();
while (performance.now() - start < deadline) {
  const poll = await post("/v1/social-media-lookup/polling", { socialMediaFinderRunId: runId, pageSize: 10 }, socialPollResp);
  if (poll.output.status === "completed") { /* map candidates → SocialPost[] */ }
  if (poll.output.status === "failed") break;
  await new Promise((r) => setTimeout(r, 1200));
}
return []; // degrade gracefully
```

### LENIENT_ZOD (Fiber response boundary)
```ts
// SOURCE: lib/fiber.ts:88-100
const socialCandidate = z.object({ platform: z.string().optional(), handle: z.string().optional(), profileUrl: z.string().optional(), displayName: z.string().optional(), bio: z.string().optional() }).passthrough();
const socialPollResp = z.object({ output: z.object({ status: z.string().optional(), data: z.array(z.object({ candidates: z.array(socialCandidate).optional() }).passthrough()).optional() }).passthrough() }).passthrough();
```

### CONVEX_FROM_NODE
```ts
// SOURCE: app/api/artifact/[id]/route.ts:1-31
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const url = await client.query(api.creatives_write.artifactUrl, { creativeId });
```

### PERSIST_FLOW (create → upload → attach)
```ts
// SOURCE: convex/creatives_write.ts:9-56 (create / generateUploadUrl / setArtifact)
// create() inserts a draft creative (artifactType:"image", status:"draft") and accepts runId
// generateUploadUrl() → POST png bytes → { storageId } → setArtifact({creativeId, storageId})
```

### CONVEX_MUTATION (for runs.ts — increment = read-modify-write)
```ts
// SOURCE: convex/companies.ts:14-29 (mutation + args + by-index lookup + patch)
export const upsert = mutation({ args: {...}, handler: async (ctx, a) => {
  const existing = await ctx.db.query("companies").withIndex("by_fiberId", q => q.eq("fiberId", a.fiberId)).unique();
  if (existing) { await ctx.db.patch(existing._id, {...a, enrichedAt: Date.now()}); return existing._id; }
  return ctx.db.insert("companies", {...a, enrichedAt: Date.now()});
}});
```

### SCRIPT_SHELL
```ts
// SOURCE: scripts/smoke-brain.ts:98-151
async function main() { /* … */ }
main().catch((e) => { console.error(e); process.exit(1); });
```

### ID_ANNOTATION (avoid Convex action/type cycles — also applies in the script)
```ts
// SOURCE: convex/ingest.ts:18 — annotate ids explicitly
const companyId: Id<"companies"> = await client.mutation(api.companies.upsert, {...});
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `convex/runs.ts` | CREATE | Run checkpointing: `start`/`tick`/`finish`, plus `hasCreativeForCompany` idempotency query and `logLine` for failures. F-owned, no collision. |
| `lib/fiber.ts` | UPDATE | Replace `socialLookupBatch` stub (line 233-235) with real batch trigger/poll. Only F touches this file in Wave 2. |
| `scripts/coverage.ts` | UPDATE | Replace stub with the batch runner (cohort → credit guard → batch social → pool(5) of enrich→reason→writeCopy→render→persist → checkpoint) + `--selfcheck`. |

## NOT Building
- Video at scale — **images only** (plan GOTCHA; video is too slow for 300).
- Live/in-demo generation — this is a pre-demo overnight script, never run live on stage (Branch E owns live).
- A new Convex `generateForLead` action — the script composes existing fiber/agents/artifact + mutations directly (lazy: no new server surface, mirrors `app/api/artifact` calling Convex over HTTP).
- A `p-limit`/queue dependency — stdlib `mapPool` (a few lines).
- Pagination beyond what `searchCompanies` returns — cohort = first page capped at 300; if fewer companies come back, that's the cohort. (`ponytail:` note in code; add Fiber pagination only if a single page can't reach 300.)
- The `social_media_lookup.completed` webhook path — poll-with-backoff is sufficient for a script (webhook needs a server endpoint; YAGNI here).

---

## Step-by-Step Tasks

### Task 1: `convex/runs.ts` — checkpointing + idempotency
- **ACTION**: Create `convex/runs.ts` with mutations `start`, `tick`, `finish`, `logLine`, and query `hasCreativeForCompany`.
- **IMPLEMENT**:
  - `start({ total })`: insert `runs` `{ type: "batch", status: "running", total, done: 0, failed: 0, startedAt: Date.now() }`, return the `Id<"runs">`.
  - `tick({ runId, ok })`: read run, `patch` `done`/`failed` incremented by 1 (read-modify-write per CONVEX_MUTATION).
  - `finish({ runId, costCredits })`: `patch` `{ status: "done", costCredits }`.
  - `hasCreativeForCompany({ companyId })`: `ctx.db.query("creatives").withIndex("by_company", q => q.eq("companyId", companyId)).first()` → return `boolean`. (Idempotency: skip companies that already have a creative.)
  - `logLine({ runId, companyId, level, message })`: insert into `log` `{ runId, companyId, level, message, ts: Date.now() }` — used for failures.
- **MIRROR**: CONVEX_MUTATION (companies.ts), schema `runs`/`log`/`creatives.by_company` (schema.ts:79-95, 50-52).
- **IMPORTS**: `import { mutation, query } from "./_generated/server"; import { v } from "convex/values";`
- **GOTCHA**: `runId`/`companyId` args are `v.id("runs")` / `v.id("companies")`. Do NOT edit `convex/schema.ts` — `runs` and `log` already exist there. `hasCreativeForCompany` is F-owned (a read of `creatives`, no write) so it won't collide with C's `creatives_read.ts`.
- **VALIDATE**: `npx convex dev` typechecks the file (Convex owns convex/ codegen; excluded from the Next tsc pass per tsconfig).

### Task 2: `lib/fiber.ts` — implement `socialLookupBatch`
- **ACTION**: Replace the throwing stub (lines 233-235) with a real Fiber batch lookup.
- **IMPLEMENT**:
  - Add lenient response schemas next to the existing social ones: `socialBatchTriggerResp` (a batch run id under `output`) and `socialBatchPollResp` (`output.status` + `output.data[]` each carrying an input handle/linkedinUrl and `candidates[]`). Reuse the existing `socialCandidate` schema.
  - `socialLookupBatch(handles)`: POST `…/social-media-lookup/batch/trigger` with `{ people: handles.map(h => ({ linkedinUrl: h })), platforms: ["TWITTER","INSTAGRAM"] }` → batch run id; poll `…/batch/poll` with backoff (1.2s, deadline ~30s for a cohort) until `completed`/`failed`; build `Record<handle, SocialPost[]>` mapping each input handle to its candidates → `SocialPost` (mirror the `socialLookup` candidate→SocialPost map at lib/fiber.ts:171-173). Handles with no result map to `[]` (degrade, never throw per-handle).
- **MIRROR**: TRIGGER_POLL + LENIENT_ZOD.
- **IMPORTS**: already present (`z`, `SocialPost`, `post`). Add a `// ponytail:` note that batch endpoint paths/shape are unverified — confirm against a real `FIBER_API_KEY` response (same caveat as `socialLookup`).
- **GOTCHA**: Endpoint paths are best-guess from the docs convention — keep Zod `.passthrough()` so an unexpected shape doesn't hard-fail the whole cohort. Batch is async; never assume synchronous. If trigger fails, throw with context (caller treats the run as social-less and proceeds firmo-only).
- **VALIDATE**: `pnpm typecheck`; covered end-to-end by Task 4 dry-run when a key is present.

### Task 3: `scripts/coverage.ts` — pure helpers + selfcheck (no network)
- **ACTION**: At the top of the rewritten script, add stdlib helpers and a `--selfcheck` path that asserts them with no network/keys.
- **IMPLEMENT**:
  - `mapPool<T,R>(items, concurrency, fn): Promise<R[]>` — index-cursor worker pool (N workers pull from a shared index). Preserves input order in results.
  - `withRetry<T>(fn, attempts=2): Promise<T>` — try, on throw retry up to `attempts-1` more times (retry once = attempts 2).
  - `cap(n, max=300)` and `parseArgs(argv)` → `{ limit, query, dry, selfcheck }` (stdlib `process.argv`, no commander).
  - `runSelfcheck()`: `assert` that `mapPool` runs at most `concurrency` in flight (track a counter) and returns ordered results; that `withRetry` succeeds on the 2nd attempt and rethrows after exhausting; that `cap(500)===300` and `cap(50)===50`. Print "✓ selfcheck passed".
- **MIRROR**: SCRIPT_SHELL; byte-size-style asserts from smoke-brain.ts:137-140.
- **IMPORTS**: `import assert from "node:assert/strict";`
- **GOTCHA**: `mapPool` must cap concurrency at `min(concurrency, items.length)` and not deadlock on an empty list. Don't pull a `p-limit` dependency — these are ~25 lines total (`ponytail:` comment).
- **VALIDATE**: `pnpm coverage --selfcheck` exits 0 with all asserts passing (no keys, no network).

### Task 4: `scripts/coverage.ts` — the batch runner
- **ACTION**: Implement `main()` orchestrating the overnight run.
- **IMPLEMENT** (in order):
  1. `parseArgs` → `limit` (default 300), `query` (default a sensible ICP string, overridable), `dry`.
  2. Build `ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)` (throw if unset). Require `FIBER_API_KEY` + `OPENAI_API_KEY` (throw early with context).
  3. **Cohort**: `searchCompanies(query)` → `cohort = hits.slice(0, cap(limit))`. Log capped count.
  4. **Credit guard**: `creditsBefore = await getCredits()`; `est = cohort.length * EST_CREDITS_PER_LEAD` (const, default ~50, tunable `// ponytail:`); if `creditsBefore < est` → log and **abort before spending** (unless `--dry` which still runs but logs the estimate). 
  5. `runId = await client.mutation(api.runs.start, { total: cohort.length })` (annotate `Id<"runs">`).
  6. **Batch social warm**: collect each company's contact via `findContact` (in the pool, Task below), then `socialLookupBatch(linkedinUrls)` once → `socialByHandle` map. (Or call per-company inside the pool if a contact's url isn't known until enrich — see GOTCHA.)
  7. **Pool(5)** over cohort via `mapPool(cohort, 5, processCompany)`:
     - `processCompany(c)` wrapped in `withRetry(…, 2)`:
       - `companyId = await client.mutation(api.companies.upsert, { fiberId, name, domain, firmoSignals: {}, logoUrl: await getLogo(domain), signalSource: "batch" })`.
       - **Idempotency**: if `await client.query(api.runs.hasCreativeForCompany, { companyId })` → return `{ status: "skip-exists" }` (don't regenerate; counts toward `done`).
       - `person = await findContact(c.fiberId || c.name)`; `enriched = await enrich(person.linkedinUrl ?? person.fiberId)`; `social = socialByHandle[person.linkedinUrl] ?? []`; `email = person.linkedinUrl ? await revealEmail(person.linkedinUrl) : undefined`.
       - `lead = EnrichedLead.parse({ … })` (mirror `discoverAndEnrich` assembly at lib/fiber.ts:218-229).
       - `personId = await client.mutation(api.people.upsert, { companyId, …, socialPosts: social })`.
       - `r = await reason(lead)`; if `r.skip` → `tick(ok:true)`, return `{ status: "skip-conf", why: r.why }`.
       - `copy = await writeCopy(r.reasoning, lead)`.
       - `creativeId = await client.mutation(api.creatives_write.create, { companyId, personId, reasoning: r.reasoning, anchorFact: r.anchorFact, sources: r.sources, copyVariants: copy, runId })`.
       - `png = await renderArtifact({ reasoning: r.reasoning, anchorFact: r.anchorFact, lead, variant: 0 })`; upload: `url = await client.mutation(api.creatives_write.generateUploadUrl)`; `POST png` → `{ storageId }`; `await client.mutation(api.creatives_write.setArtifact, { creativeId, storageId })`.
       - `tick(ok:true)`, return `{ status: "ok", creativeId }`.
     - On final failure (after retry): `tick(ok:false)`, `client.mutation(api.runs.logLine, { runId, companyId?, level:"error", message })`, return `{ status: "fail" }`.
  8. `creditsAfter = await getCredits()`; `await client.mutation(api.runs.finish, { runId, costCredits: creditsBefore - creditsAfter })`.
  9. Print summary: drafts / skipped / failed / credits spent.
  - **`--dry`**: still runs but with `limit` forced ≤ a small number (e.g. honor `--limit 50`) and logs everything; dry is just "small + verbose", real persistence still happens (so the dashboard shows it). *(If a true no-write dry is wanted later, gate the mutations — out of scope now.)*
- **MIRROR**: discoverAndEnrich assembly (fiber.ts:204-229), PERSIST_FLOW, CONVEX_FROM_NODE, ID_ANNOTATION.
- **IMPORTS**: `ConvexHttpClient` from `convex/browser`; `api` from `@/convex/_generated/api`; `Id` from `@/convex/_generated/dataModel`; `{ searchCompanies, findContact, enrich, revealEmail, getLogo, socialLookupBatch, getCredits }` from `@/lib/fiber`; `{ reason, writeCopy }` from `@/lib/agents`; `{ renderArtifact }` from `@/lib/artifact`; `{ EnrichedLead }` from `@/lib/schemas`.
- **GOTCHA**:
  - **Don't fork the loop.** Reuse `reason`/`writeCopy`/`renderArtifact` and the existing mutations verbatim — this script only re-orders the *discovery* fiber calls for batch efficiency; the brain + artifact + persist are untouched.
  - **Batch-social ordering**: a contact's `linkedinUrl` may only be known after `findContact`. Lazy-correct option: run a first pool pass of `findContact` to collect urls → one `socialLookupBatch` → second pass for the rest. Simpler fallback that still ships: skip the batch warm and let each `processCompany` do its own `socialLookup` (per-company) — `socialLookupBatch` stays implemented + tested as the deliverable and the documented scale path. **Pick per-company-social first for robustness; switch to batch-warm only if 300× social trigger/poll proves too slow or rate-limited.** State which you chose in a `ponytail:` comment.
  - **Idempotent + resumable**: re-running the script skips any company that already has a creative (`hasCreativeForCompany`), so a crash mid-run is recovered by simply re-running — the `runs` row records progress; a fresh run is started on resume (don't try to resume the same `runs` row — YAGNI).
  - **Never generate live in the demo.** This is the pre-demo script only.
  - `firmoSignals` for `companies.upsert` should be the lead's real `firmoSignals` (from `enrich`), not `{}` — set it after enrich, or upsert twice (once to get id for idempotency check, patch later). Lazy: do the idempotency check by `fiberId` via `companies.getByFiberId` BEFORE upsert to avoid a half-written company, then upsert with full signals.
- **VALIDATE**: `pnpm coverage --limit 50` completes within credits, writes ~drafts to Convex, dashboard grid (`creatives_read.list`) shows them; re-run skips them.

---

## Testing Strategy

### Unit (assert-based `--selfcheck`, no framework)
| Test | Input | Expected | Edge? |
|---|---|---|---|
| `mapPool` concurrency cap | 20 items, conc 5, counter-tracking fn | max in-flight ≤ 5 | yes |
| `mapPool` order + empty | `[]` and `[a,b,c]` | `[]`; results in input order | yes |
| `withRetry` succeeds on 2nd | fn that throws once | resolves | no |
| `withRetry` exhausts | fn always throws | rethrows after 2 attempts | yes |
| `cap` | 500, 50, 0 | 300, 50, 0 | yes |

### Edge Cases Checklist
- [x] Empty cohort (`searchCompanies` returns 0) → finish run with 0 done, no crash
- [x] Credits below estimate → abort before spending
- [x] `enrich`/`findContact` miss → retry once → on fail `tick(ok:false)` + `logLine`, continue
- [x] Social lookup empty/failed → proceed firmo-only (`socialPosts: []`)
- [x] `reason` returns `skip` → no creative, counted as done, reason logged
- [x] Re-run after crash → already-generated companies skipped (idempotent)
- [x] Missing `NEXT_PUBLIC_CONVEX_URL` / `FIBER_API_KEY` / `OPENAI_API_KEY` → throw early with context

---

## Validation Commands

### Static Analysis
```bash
pnpm typecheck            # app/lib/scripts pass (convex/ excluded; codegen'd separately)
npx convex dev            # typechecks convex/runs.ts against schema (run once / leave running)
```
EXPECT: zero type errors.

### Selfcheck (pure, no keys)
```bash
pnpm coverage --selfcheck
```
EXPECT: "✓ selfcheck passed", exit 0.

### Dry run (within credits)
```bash
pnpm coverage --limit 50 --query "seed-stage devtools startups"
```
EXPECT: ~drafts created, summary prints credits spent < available; a second identical run reports all-skipped.

### Browser validation
```bash
pnpm dev                  # open dashboard → grid shows the batch's draft cards
```
EXPECT: reasoned cards with real logos/anchor facts visible.

### Manual
- [ ] Re-run `--limit 50` → all skipped (idempotency holds)
- [ ] Kill mid-run (Ctrl-C), re-run → only the remainder is processed
- [ ] `runs` row shows `done + failed == total`, `costCredits` ≈ credit delta

---

## Acceptance Criteria
- [ ] `pnpm coverage --selfcheck` passes
- [ ] `pnpm coverage --limit 50` produces draft creatives within credits, resumes after crash
- [ ] Overnight `pnpm coverage` (≤300) → hundreds of reasoned cards by morning, cost within credits
- [ ] `socialLookupBatch` no longer throws; returns `Record<handle, SocialPost[]>`
- [ ] `convex/runs.ts` provides `start`/`tick`/`finish`/`hasCreativeForCompany`/`logLine`
- [ ] `pnpm typecheck` green; no new dependencies added

## Completion Checklist
- [ ] Reuses `reason`/`writeCopy`/`renderArtifact` + existing mutations (loop not forked)
- [ ] Fiber boundary Zod stays lenient (`.passthrough()`)
- [ ] Errors thrown with context; per-company failures logged, not swallowed
- [ ] `chargeInfo` logged (inherited from `post()`); `costCredits` checkpointed
- [ ] No hardcoded secrets; keys read from env with early validation
- [ ] `ponytail:` comments mark the per-company-vs-batch-social choice, cost estimate constant, and stdlib pool
- [ ] Self-contained — no codebase search needed during implementation

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Broken batch burns credits/night | Med | High | `--limit 50` dry-run first; credit guard aborts before spending; idempotent + checkpointed; defer to a morning 50-co run if the loop is weak by 2am |
| Fiber batch endpoint shape differs from guess | High | Med | lenient Zod; per-handle degrade to `[]`; fall back to per-company `socialLookup` (already verified path) |
| Social trigger/poll too slow at 300 | Med | Med | concurrency 5 + per-company social is the safe default; batch-warm is the optimization, switch only if needed |
| Convex action/script type cycle | Low | Low | explicit `Id<…>` annotations (ingest.ts remedy) |
| 300× LLM calls cost/time | Med | Med | images only (no video); `confidence<0.5` skips thin leads early (no `writeCopy`/render spent) |

## Notes
- Merge order (per Wave-2 plan): **F kicks off first / runs overnight**, then E, then G, then polish. F ships alone (it's a script + one Convex file + one fiber method) and keeps `main` demoable.
- Disjoint files confirmed: only F touches `lib/fiber.ts` in Wave 2; `convex/runs.ts` is new; `scripts/coverage.ts` is F-only. `hasCreativeForCompany` lives in `runs.ts` (not C's `creatives_read.ts`) to avoid collision.
- The biggest open decision is **per-company social vs. batch-warm social** (Task 4 GOTCHA). Recommendation: ship per-company first (robust, reuses verified `socialLookup`), keep `socialLookupBatch` implemented + selfcheck-covered as the documented scale path, switch the orchestration to batch-warm only if the overnight 300-run is too slow.
```