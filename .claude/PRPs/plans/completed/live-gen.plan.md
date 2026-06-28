# Plan: Branch E — `feat/live-gen` (the verifiable WOW)

## Summary
Judge types a company name → the SDR reasoning chain **streams** onto the screen → a finished, source-grounded outreach card lands in the dashboard in ≤90s. Pre-warmed/cached inputs return instantly and survive an API flake mid-demo. This assembles the existing pieces (`discoverAndEnrich` → `reason`/`writeCopy` → `renderArtifact` → Convex persist) into one streaming orchestrator — it does **not** re-implement them.

## User Story
As a hackathon judge, I want to type any company and watch Cutthrough reason about it live, so that I can verify the product is real, not a pre-baked deck.

## Problem → Solution
Today the loop is wired only in fragments: `convex/ingest.ts` discovers+persists a lead, `scripts/smoke-brain.ts` reasons + renders a PNG to disk, and `creatives_write.ts` can store a creative — but **no single callable runs discover→reason→artifact→persist**, and nothing streams. → `lib/livegen.ts` orchestrates the full chain and emits progress events; `app/api/live/route.ts` streams them over a native `ReadableStream`; `app/live/page.tsx` renders the streamed reasoning + final card.

## Metadata
- **Complexity**: Medium (3 new files + 1 optional pre-warm script; ~350 lines; no new deps)
- **Source PRD**: `.claude/PRPs/plans/wave-2-amplifiers.plan.md`
- **PRD Phase**: Branch E — `feat/live-gen` (Gate 4)
- **Estimated Files**: 3 create (+1 optional script), 0 edits to shared files
- **Branch**: `feat/live-gen` off `main@wave-1-core-done`

---

## UX Design

### Before
```
┌──────────────────────────────────────────┐
│  /  → dashboard Pipeline (pre-seeded      │
│       cards only). No way to prove the     │
│       reasoning happens live on demand.    │
└──────────────────────────────────────────┘
```

### After
```
┌──────────────────────────────────────────┐
│  /live                                     │
│  ┌────────────────────────────────────┐   │
│  │ [ Vercel______________ ]  (Run) │   │
│  └────────────────────────────────────┘   │
│  discovering… ▸ reasoning…                 │
│   Saw       "AI made spam fluent…"   ◄ streams in
│   Inferred  "skeptical of generic…"  ◄ one
│   Pain      "his inbox proves…"      ◄ step
│   Angle     "agree with his framing" ◄ at a
│   Why       "rejects 'congrats on…'" ◄ time
│  rendering… → [ finished card PNG ]        │
│  ✓ also added to the live Pipeline ↗       │
└──────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Generate a card | Seed script / batch only | Type a name, watch it build | New `/live` route |
| Feedback during gen | None | Streamed stage + step events | NDJSON over `ReadableStream` |
| Result persistence | n/a | Creative row → appears in dashboard Pipeline realtime | Reuses `creatives_read.list` subscription |
| Demo safety | n/a | Cached inputs instant; durable backup survives restart | `.livecache/` |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `lib/fiber.ts` | 202–230 | `discoverAndEnrich(query)` — the discover step. Already fires socialLookup + enrich + logo in parallel; **do not re-implement that parallelism**. Returns `EnrichedLead`. |
| P0 | `lib/agents.ts` | 59–134 | `reason(lead)` returns `ReasonResult` (skip union); `writeCopy(reasoning, lead)` returns `CopyVariant[]`. Throws on no structured output. |
| P0 | `lib/artifact.tsx` | 267–295 | `renderArtifact({reasoning, lead, anchorFact, variant})` → `Buffer` (PNG). Node-only (reads fonts from disk). |
| P0 | `convex/creatives_write.ts` | 9–56 | `create` (needs companyId+personId, runId optional), `generateUploadUrl`, `setArtifact` — the persist + PNG-upload path. |
| P0 | `convex/ingest.ts` | 12–37 | Canonical persist sequence: `companies.upsert` → `people.upsert`. Mirror this in livegen (or call this action). |
| P1 | `app/api/artifact/[id]/route.ts` | 1–28 | The `ConvexHttpClient` + `NEXT_PUBLIC_CONVEX_URL` guard pattern a Next route uses to talk to Convex. |
| P1 | `lib/schemas.ts` | 19–60 | `EnrichedLead`, `Reasoning`, `ReasonResult`, `CopyVariant` types + Zod. |
| P1 | `components/ReasoningChain.tsx` | 1–41 | Reuse to render the finished chain. Takes a **complete** `Reasoning` + `anchorFact`. |
| P1 | `components/Card.tsx` | 1–74 | Reuse import pattern (`@/convex/validators` for `Reasoning`, `useMutation`) if the live page renders a full card. |
| P2 | `scripts/smoke-brain.ts` | 98–146 | Shows reason→writeCopy→renderArtifact called in sequence — the exact shape livegen needs, minus the Convex persist. |
| P2 | `convex/schema.ts` | 32–87 | `creatives` + `runs` table shapes. Note `runs.type` includes `"live"`; `creatives.runId` is **optional**. |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Streaming responses in App Router | Next.js Route Handlers docs | Return `new Response(readableStream)` from a `POST` handler; runs in Node by default. No SSE library needed. |
| `ReadableStream` + `TextEncoder` | MDN | `controller.enqueue(encoder.encode(line))` per event; `controller.close()` at end. NDJSON = one JSON object per `\n`. |
| Client stream read | MDN `Response.body.getReader()` | Loop `reader.read()`, decode, split on `\n`, `JSON.parse` each complete line; buffer the partial tail. |

No external research needed beyond the above — feature uses established internal patterns + native web streaming.

---

## Patterns to Mirror

### CONVEX_FROM_NEXT_ROUTE
```ts
// SOURCE: app/api/artifact/[id]/route.ts:9-22
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
// ...guard with 503 if unset...
const client = new ConvexHttpClient(convexUrl);
const url = await client.query(api.creatives_write.artifactUrl, { creativeId: id as Id<"creatives"> });
```

### PERSIST_SEQUENCE
```ts
// SOURCE: convex/ingest.ts:18-34 (run from the route via ConvexHttpClient instead of inside an action)
const companyId = await client.mutation(api.companies.upsert, {
  fiberId: lead.fiberId, name: lead.company, domain: lead.domain,
  firmoSignals: lead.firmoSignals, logoUrl: lead.logoUrl, signalSource: "live",
});
const personId = await client.mutation(api.people.upsert, {
  companyId, fiberId: lead.fiberId, name: lead.name, title: lead.title,
  email: lead.email, linkedin: lead.linkedin, socialPosts: lead.socialPosts,
});
```

### CREATE_AND_UPLOAD_ARTIFACT
```ts
// SOURCE: convex/creatives_write.ts:9-56 (the comment block at :35-37 describes this exact flow)
const creativeId = await client.mutation(api.creatives_write.create, {
  companyId, personId, reasoning: r.reasoning, anchorFact: r.anchorFact,
  sources: r.sources, copyVariants: copy, // runId omitted — see GOTCHA
});
const uploadUrl = await client.mutation(api.creatives_write.generateUploadUrl, {});
const up = await fetch(uploadUrl, { method: "POST", headers: { "content-type": "image/png" }, body: png });
const { storageId } = await up.json();
await client.mutation(api.creatives_write.setArtifact, { creativeId, storageId });
```

### REASON_RENDER_SEQUENCE
```ts
// SOURCE: scripts/smoke-brain.ts:110-133
const r = await reason(lead);            // ReasonResult (skip union)
if (r.skip) { /* degrade — emit note, don't crash */ }
const copy = await writeCopy(r.reasoning, lead);
const png = await renderArtifact({ reasoning: r.reasoning, anchorFact: r.anchorFact, lead, variant: 0 });
```

### ERROR_HANDLING
```ts
// SOURCE: lib/agents.ts:82, lib/fiber.ts:26 — throw with context; narrow unknown at the boundary
if (!parsed) throw new Error("reason: model returned no structured output");
// route boundary: catch unknown, emit {stage:"error", message}, then close the stream (never 500 mid-demo)
```

### LOGGING_PATTERN
```ts
// SOURCE: lib/fiber.ts:30 — console.info with a bracketed tag + payload
console.info("[livegen]", { query, cached, ms });
```

### CLIENT_COMPONENT_SHAPE
```tsx
// SOURCE: components/TriggerPanel.tsx:1-3,32-87 — "use client", local useState, async handler with try/catch/finally
"use client";
import { useState } from "react";
// input + button disabled while running; setError on catch; setResult on success
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `lib/livegen.ts` | CREATE | The missing orchestrator: cache-check → discover → reason → writeCopy → render → persist, yielding progress events. Pure Node, no Convex function file edits. |
| `app/api/live/route.ts` | CREATE | `POST` handler that drives `livegen` and streams its events as NDJSON over a `ReadableStream`. Node runtime (default). |
| `app/live/page.tsx` | CREATE | Client page: input + streamed reasoning steps + final card. Reuses `ReasoningChain`. |
| `app/live/live.css` | CREATE | Scoped styling for the live view (mirror `components/dashboard.css` tokens). |
| `scripts/prewarm-live.ts` | CREATE (optional) | Pre-runs `livegen` for a hardcoded judge/sponsor/famous-co list → fills `.livecache/`. Satisfies "cached backups exist". |

## NOT Building
- **No new Convex function files.** E persists by *calling* existing mutations (`companies.upsert`, `people.upsert`, `creatives_write.create/generateUploadUrl/setArtifact`) via `ConvexHttpClient`. (`convex/runs.ts` is Branch F's file — do not create it.)
- **No `runs` row for live.** `creatives.runId` is optional; skip run tracking to avoid the `convex/runs.ts` collision with F. Add later if live runs need grouping.
- **No raw OpenAI token streaming.** Stream parsed `reason()` fields progressively (demo-safe, keeps structured-output integrity). Upgrade path noted in Task 2.
- **No bespoke card UI in the live page.** Persisted creatives appear in the dashboard `Pipeline` automatically (realtime `creatives_read.list`). The live page shows the chain + the PNG; full card management stays in the dashboard.
- **No edge runtime.** satori/resvg/Fiber/OpenAI need Node.
- **No video** (Branch G) and **no batch** (Branch F).

---

## Step-by-Step Tasks

### Task 1: `lib/livegen.ts` — the streaming orchestrator
- **ACTION**: Create an async generator (or callback-emitter) that runs one lead end-to-end and yields typed progress events.
- **IMPLEMENT**:
  - Event type (discriminated union, mirror `ReasonResult` style):
    ```ts
    export type LiveEvent =
      | { stage: "discovering" }
      | { stage: "reasoning" }
      | { step: keyof Reasoning; text: string }   // saw/inferred/pain/angle/whyThisAngle
      | { stage: "rendering" }
      | { stage: "done"; creativeId: string; artifactPath: string; reasoning: Reasoning; anchorFact: string; copy: CopyVariant[]; cached: boolean }
      | { stage: "skip"; why: string }
      | { stage: "error"; message: string };
    ```
  - `export async function* runLive(query: string): AsyncGenerator<LiveEvent>`:
    1. `const key = slug(query)` (lowercase, trim, non-alnum→`-`). Check cache (Task 4). On hit: replay stored steps fast (small `await delay(120)` between, so it still *looks* live) → `done` with `cached: true`. Return.
    2. `yield { stage: "discovering" }`; `const lead = await discoverAndEnrich(query)`.
    3. `yield { stage: "reasoning" }`; `const r = await reason(lead)`.
    4. If `r.skip`: `yield { stage: "skip", why: r.why }`; still render a firmo-only card if you want a visible result, else return. (Demo: prefer rendering with `anchorFact` fallback so something always appears.)
    5. For each step in `["saw","inferred","pain","angle","whyThisAngle"]`: `yield { step, text: r.reasoning[step] }`.
    6. `const copy = await writeCopy(r.reasoning, lead)`.
    7. `yield { stage: "rendering" }`; `const png = await renderArtifact({ reasoning: r.reasoning, anchorFact: r.anchorFact, lead, variant: 0 })`.
    8. Persist via `ConvexHttpClient` (PERSIST_SEQUENCE + CREATE_AND_UPLOAD_ARTIFACT patterns) → `creativeId`.
    9. Write durable backup to `.livecache/<key>.json` (lead+r+copy) and `.livecache/<key>.png` (Task 4).
    10. `yield { stage: "done", creativeId, artifactPath, reasoning, anchorFact, copy, cached: false }`.
  - Wrap the whole body so any throw becomes `yield { stage: "error", message }` (never let the route 500).
- **MIRROR**: REASON_RENDER_SEQUENCE, PERSIST_SEQUENCE, CREATE_AND_UPLOAD_ARTIFACT, CONVEX_FROM_NEXT_ROUTE, ERROR_HANDLING.
- **IMPORTS**: `discoverAndEnrich` from `@/lib/fiber`; `reason, writeCopy` from `@/lib/agents`; `renderArtifact` from `@/lib/artifact`; types from `@/lib/schemas`; `ConvexHttpClient` from `convex/browser`; `api` from `@/convex/_generated/api`; `Id` from `@/convex/_generated/dataModel`; `node:fs/promises`, `node:path`.
- **GOTCHA**: `discoverAndEnrich` is one opaque slow await — you can only emit `discovering`/`reasoning` around it, not inside. That's fine; its internal parallelism (fiber.ts:211) already overlaps social + enrich. Do **not** pass `runId` to `create`. The PNG upload `fetch` returns `{ storageId }` JSON — parse it.
- **VALIDATE**: `pnpm typecheck` clean. Temporary node harness: `for await (const e of runLive("Vercel")) console.log(e)` prints discovering→reasoning→5 steps→rendering→done with a real `creativeId`.

### Task 2: `app/api/live/route.ts` — NDJSON stream
- **ACTION**: `POST` handler reading `{ query }`, returning a streamed `Response`.
- **IMPLEMENT**:
  ```ts
  export async function POST(req: Request) {
    if (!process.env.NEXT_PUBLIC_CONVEX_URL) return new Response("convex not configured", { status: 503 });
    const { query } = await req.json();
    if (typeof query !== "string" || !query.trim()) return new Response("query required", { status: 400 });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const ev of runLive(query.trim())) {
            controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
          }
        } catch (e) {
          controller.enqueue(encoder.encode(JSON.stringify({ stage: "error", message: e instanceof Error ? e.message : "failed" }) + "\n"));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
  }
  ```
- **MIRROR**: CONVEX_FROM_NEXT_ROUTE guard; ERROR_HANDLING.
- **IMPORTS**: `runLive` from `@/lib/livegen`.
- **GOTCHA**: Do **not** add `export const runtime = "edge"` — leave Node default. Validate `query` (trust-boundary input). Set `cache-control: no-store` or a proxy may buffer the stream.
- **VALIDATE**: `curl -N -X POST localhost:3000/api/live -H 'content-type: application/json' -d '{"query":"Vercel"}'` streams newline-delimited events ending in a `done`.
- **(Upgrade path, not now)**: real token streaming → add a streaming `reasonStream()` in `lib/agents.ts` using `client.chat.completions.create({stream:true})` and relay deltas. Skipped: partial-JSON parsing is fragile and risks an ugly demo.

### Task 3: `app/live/page.tsx` + `app/live/live.css` — the live view
- **ACTION**: Client component: input + Run button → POST `/api/live`, read the stream, render steps as they arrive, then the finished card image.
- **IMPLEMENT**:
  - `"use client"`. State: `query`, `running`, `partial: Partial<Reasoning>`, `anchorFact`, `stage`, `artifactUrl`, `error`.
  - On submit: `setRunning(true)`, `fetch("/api/live", {method:"POST", body: JSON.stringify({query})})`, then:
    ```ts
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const line of lines) if (line) handle(JSON.parse(line) as LiveEvent);
    }
    ```
  - `handle(ev)`: on `step` → `setPartial(p => ({...p, [ev.step]: ev.text}))`; on `done` → `setArtifactUrl("/api/artifact/" + ev.creativeId)`, fill full reasoning; on `error`/`skip` → show message.
  - When all 5 steps present, render `<ReasoningChain reasoning={partial as Reasoning} anchorFact={anchorFact} />`; otherwise render the streaming partial list (label + text per arrived step) so it visibly fills in.
  - Show `<img src={artifactUrl} />` once `done`. Add a link: "↗ see it in the Pipeline" → `/`.
  - CSS: reuse the dashboard token vocabulary (`components/dashboard.css`), compositor-friendly transitions only (opacity/transform) for step-in animation.
- **MIRROR**: CLIENT_COMPONENT_SHAPE (TriggerPanel); `ReasoningChain` reuse; Card.tsx import style for `Reasoning` type.
- **IMPORTS**: `useState` from `react`; `ReasoningChain` from `@/components/ReasoningChain`; `type LiveEvent` from `@/lib/livegen` (type-only import); `./live.css`.
- **GOTCHA**: `ReasoningChain` needs a **complete** `Reasoning` — guard with the 5-key check before passing, or render the partial list yourself until then. `res.body` can be null in TS — assert or guard. Don't forget `dec.decode(value, {stream:true})` for multi-byte safety.
- **VALIDATE**: `pnpm dev`, open `/live`, type "Vercel", watch steps stream and the card appear in <90s. Type a pre-warmed name → near-instant.

### Task 4: Cache + durable backup (inside `lib/livegen.ts`)
- **ACTION**: Two-layer cache: in-memory `Map` (hot) + `.livecache/` files (durable, survives restart — the demo backup).
- **IMPLEMENT**:
  - `const mem = new Map<string, CachedRun>()` at module scope.
  - `CachedRun = { lead, reasoning, anchorFact, copy, creativeId?, pngPath }`.
  - Read order: `mem.get(key)` → else read `.livecache/<key>.json` (+ confirm `.png` exists) → else miss.
  - On a fresh successful run, write both layers. PNG saved to `.livecache/<key>.png`; also keep the Convex `creativeId` so cached replays can reuse the stored artifact (or re-upload from the PNG if Convex lacks it).
  - `export async function prewarm(queries: string[])`: run `runLive` for each (drain the generator), ignoring individual failures, logging a summary. Used by Task 5.
  - `// ponytail: in-memory Map + flat-file cache. No TTL/eviction — demo-scoped. Add LRU/TTL only if the cache outlives a demo.`
- **MIRROR**: `lib/artifact.tsx:16-40` lazy-singleton pattern (`let _x = null`) for the in-memory map init; `node:fs/promises` usage from `scripts/smoke-brain.ts:126`.
- **IMPORTS**: `node:fs/promises` (`mkdir`, `readFile`, `writeFile`, `access`), `node:path`.
- **GOTCHA**: Add `.livecache/` to `.gitignore` (it holds rendered PNGs + lead data). On cache hit you still want the "live" feel — replay steps with a tiny delay, don't dump them instantly.
- **VALIDATE**: Run once for "Vercel" (slow path writes `.livecache/vercel.json` + `.png`). Delete `FIBER_API_KEY` from env, run again → cache hit, card still returned (proves API-flake survival).

### Task 5 (optional): `scripts/prewarm-live.ts`
- **ACTION**: One-shot script that calls `prewarm([...known judge/sponsor/famous companies])`.
- **IMPLEMENT**: hardcode the demo list; `await prewarm(LIST)`; `process.exit`. Add `"prewarm": "tsx scripts/prewarm-live.ts"` to package.json scripts.
- **MIRROR**: `scripts/smoke-brain.ts:148-151` (`main().catch(e => { console.error(e); process.exit(1) })`).
- **IMPORTS**: `prewarm` from `@/lib/livegen`.
- **GOTCHA**: Needs `OPENAI_API_KEY`, `FIBER_API_KEY`, `NEXT_PUBLIC_CONVEX_URL` set. Run it the night before / morning of the demo.
- **VALIDATE**: `pnpm prewarm` populates `.livecache/` with one `.json`+`.png` per name.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `slug()` normalizes | `"  Vercel Inc. "` | `"vercel-inc"` | trailing/punct |
| NDJSON line parse | `'{"a":1}\n{"b":2}\n'` (split) | two parsed objects, empty tail buffer | partial-line buffering ✓ |
| `runLive` event order | mocked deps | `discovering, reasoning, 5×step, rendering, done` | ✓ |
| `runLive` cache hit | second call same key | `done` with `cached:true`, no Fiber/OpenAI call | ✓ |
| `runLive` skip path | `reason()` → `{skip:true}` | yields `{stage:"skip"}`, no crash | low-confidence lead ✓ |
| `runLive` discover throws | `discoverAndEnrich` rejects | yields `{stage:"error"}` once, closes | API flake ✓ |

> ponytail: no test framework is installed. Add **one** runnable check — `scripts/smoke-live.ts` (mirrors `smoke-brain.ts`) that asserts event order + a cache-hit shortcut with mocked deps. That's the smallest thing that fails if the orchestrator breaks. Skip a full suite unless asked.

### Edge Cases Checklist
- [ ] Empty/whitespace query → 400 (route guard)
- [ ] `NEXT_PUBLIC_CONVEX_URL` unset → 503 (route guard)
- [ ] Fiber/OpenAI failure mid-run → `error` event, stream closes cleanly, page shows message
- [ ] Low-confidence lead (`reason` skip) → `skip` event, optional firmo-only card
- [ ] Cache hit with missing `.png` → treat as miss, regenerate
- [ ] Multi-byte chars in streamed text → `TextDecoder({stream:true})`
- [ ] Concurrent runs of same query → both work (Map write is last-wins; acceptable)

---

## Validation Commands

### Static Analysis
```bash
pnpm typecheck
```
EXPECT: Zero type errors (`convex/` is excluded from this pass — it's checked by `npx convex dev`).

### Convex codegen (if `api.*` types look loose)
```bash
npx convex dev   # regenerates convex/_generated; leave running in another shell
```
EXPECT: `api.creatives_write.create` etc. resolve precisely.

### Smoke (orchestrator)
```bash
pnpm tsx scripts/smoke-live.ts        # if Task "one runnable check" added
```
EXPECT: event order assertion passes; cache hit on 2nd call.

### Stream (route)
```bash
pnpm dev &
curl -N -X POST localhost:3000/api/live -H 'content-type: application/json' -d '{"query":"Vercel"}'
```
EXPECT: newline-delimited events ending with a `done` carrying a `creativeId`.

### Browser
```bash
pnpm dev   # open http://localhost:3000/live
```
EXPECT: type a name → reasoning streams in → card renders in <90s; pre-warmed name is near-instant; card also shows on `/` Pipeline.

### Manual Validation
- [ ] Type a known company → 5 reasoning steps appear progressively, then PNG
- [ ] Total time <90s on a cold input
- [ ] Pre-warmed input returns ~instantly
- [ ] Kill `FIBER_API_KEY` → cached input still returns a card (flake survival)
- [ ] Generated creative appears in the dashboard Pipeline in realtime

---

## Acceptance Criteria
- [ ] Live card generated from a typed company name in <90s
- [ ] Reasoning streams step-by-step (visible saw→inferred→pain→angle→why)
- [ ] Cached/pre-warmed inputs return instantly and survive an API flake
- [ ] Persisted creative shows in the dashboard Pipeline
- [ ] `pnpm typecheck` clean; no new dependencies
- [ ] No edits to shared Convex function files or `lib/fiber.ts` (no collision with F/G)

## Completion Checklist
- [ ] Reuses `discoverAndEnrich`/`reason`/`writeCopy`/`renderArtifact` — loop not forked
- [ ] Error handling matches codebase (throw-with-context; route never 500s mid-stream)
- [ ] Logging uses `[livegen]` bracketed-tag `console.info`
- [ ] `.livecache/` in `.gitignore`
- [ ] No `runId` passed to `create` (no `convex/runs.ts` dependency)
- [ ] One runnable smoke check left behind
- [ ] Self-contained — no codebase searching needed during implementation

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Fiber/OpenAI flake on stage | Med | Fatal to demo | Pre-warm + durable `.livecache/`; cached replay path is the floor |
| `discoverAndEnrich` >90s on a cold cohort | Med | Misses the wow window | Pre-warm judge/sponsor names; degrade to firmo-only if social slow (fiber.ts already returns `[]` on timeout) |
| Convex `api.*` types loose pre-codegen | Low | Type noise | Run `npx convex dev`; mirror `Id<...>` casts from artifact route |
| Stream buffered by a proxy | Low | No progressive reveal | `cache-control: no-store`; Node runtime; NDJSON flush per event |
| Collision with F on `convex/runs.ts` | Low | Merge conflict | E creates **no** Convex files and skips the runs row |

## Notes
- **The single most important finding:** the "core loop" wave-2 says to reuse is only *half-wired*. `ingest.ts` persists a lead; `smoke-brain.ts` reasons+renders to disk; **nothing** runs discover→reason→artifact→persist as one call (no `generateForLead` exists, despite ingest.ts:11 referencing it). `lib/livegen.ts` is that orchestrator — assembled from existing pieces, scoped entirely to Branch E.
- The live page deliberately does **not** rebuild card management UI — persisted creatives flow into the existing realtime `Pipeline` for free.
- Streaming fidelity decision: **progressive reveal of parsed `reason()` fields**, not raw token streaming. Demo-safe, preserves structured-output integrity, far less code. Real token streaming is a documented upgrade path, not a requirement.
