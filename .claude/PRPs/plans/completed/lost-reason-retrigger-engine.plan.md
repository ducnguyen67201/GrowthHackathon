# Plan: Lost-Reason Re-Trigger Engine — "We read the minds of the deals you already lost"

> YC AI Growth Hackathon · Track: **Reading Minds** (Agentic Analytics, Signal Detection, Churn, Lead-Building) · Full re-aim of the existing Cutthrough machine · 24h · open-source repo · judged Sun 5pm.

## Summary
Re-aim the working Cutthrough pipeline from **cold ICP outbound** to **warm re-engagement of dead pipeline.** Ingest closed-lost deals → extract & cluster *why* each died → detect a re-trigger signal (objection now solved by a shipped feature **and/or** an external change via Fiber) → score every lost account → generate the proof-creative (image/video) → send/draft. The system re-scores continuously as outcomes accumulate. **~85% is already built; the new code is two input tables + an extract step + a match/score step.**

## User Story
As a **growth/GTM engineer (or AE)**, I want a system that watches my *dead* pipeline and tells me exactly which lost accounts became winnable again — because the thing they wanted shipped, or because their situation changed — so I re-engage the right 12 accounts with proof I remember why they said no, instead of cold-spamming 4,000 strangers who'll ignore me.

## Problem → Solution
**Now:** Cold email is dead (1% reply). Everyone builds *more* cold outbound. Meanwhile every company sits on a graveyard of closed-lost deals — people who already evaluated, already wanted it, and said "no, because X." That signal rots in the CRM. Re-qualifying it by hand is ~20 min/account, so nobody does it.
**After:** The graveyard becomes the pipeline. The system reads *why* each deal died, watches for the moment that reason dissolves (you shipped X / their champion got promoted / they raised), scores who's ripe today, and proves it remembers — "you passed on us for SSO; we shipped it, and your champion just became VP. Now?" Warm, specific, grounded, un-ignorable.

## Metadata
- **Complexity**: Medium (re-aim + thin new layer on a complete machine — NOT greenfield)
- **Source PRD**: N/A (free-form hackathon brief + judge insight session)
- **Supersedes**: `sales-cyborg-cutthrough.plan.md` (Sales Cyborgs framing — retired; code reused)
- **Estimated new/changed files**: ~10 (2 new lib, 2 new convex, 1-2 scripts, 1-2 UI, schema + seed + copy)

---

## NORTH STAR — read first (never drift)

**The wedge (defensible insight):**
> "Everyone is building faster cold outbound — into a channel that's dead. We do the opposite: we mine the deals you *already lost*. Those people already wanted it and told you exactly why they said no. We detect the moment that reason dissolves — you shipped the feature, their champion got promoted, they raised — and we re-engage with proof we remember. **Cold outbound guesses who might care. We *know* who already did.**"

**Why now:** (1) Your own closed-lost reasons are first-party gold nobody mines. (2) A company's *live* situation is now an API call (Fiber: funding, hiring, **champion_job_change**). (3) LLMs can read an objection and a changelog and judge "is this resolved?" in one call. Those crossed. That's the YC "why now."

**The chain, one breath:** *read why they died → watch for the reason to dissolve → score who's ripe → prove we remember → re-engage.* (signal detection, grounded, continuous.)

**What it IS vs IS NOT:**

| | Cold-outbound tool (NOT us) | Re-Trigger Engine (us) |
|---|---|---|
| Audience | strangers who never heard of you | people who **already evaluated and wanted it** |
| Signal | "they exist / they raised" | **the exact reason they said no + the moment it dissolved** |
| Channel posture | interrupt | **return with proof** |
| Track | Cold Outbound (crowded, "email is dead") | **Reading Minds (signal detection on churn)** |
| Learning | static | **re-scores continuously as outcomes land** |

**Locked:** Reading Minds. Signal detection on dead pipeline. Not cold discovery, not an image tool, not ad gen.

---

## THE 60-SECOND PITCH (say at judging)

> **(Problem)** "Everyone here is building cold outbound. Cold email converts at one percent — you said it yourselves, it's dead. So everyone's optimizing a dead channel.
> **(Insight)** Every company is sitting on a graveyard: the deals they already lost. Those people *already wanted it* and told you exactly *why* they said no. That signal is the most valuable lead data you own, and it rots in your CRM.
> **(What — show)** This reads every lost deal, extracts why it died, and watches for the moment that reason dissolves — you shipped the feature they needed, or [Fiber] their champion just got promoted, or they raised. Watch: [account] passed on us for SSO. We shipped SSO last month, and their champion just became VP Eng. The system scored them re-triggerable and wrote this — proof we remember why they said no.
> **(Depth)** It re-scores your whole dead pipeline every night. As deals re-close, it learns which lost accounts actually come back — it gets sharper continuously.
> **(Business)** It turns a graveyard you already paid to fill into pipeline, at zero new acquisition cost. The moat is your own outcome data compounding.
> **(Close)** Cold outbound guesses who might care. We know who already did. Name a lost deal — I'll score it."

**Competitor one-liners (Q&A):** Clay/Instantly = more cold volume, no memory · Gong = records calls, doesn't act on the graveyard · **we detect the re-trigger moment and re-engage with proof, learning from every outcome.**

---

## Expected End-to-End Flow

```
  CLOSED-LOST DEALS (seed = first-party)        PRODUCT CHANGELOG (seed)
   {account, contact, lostReason, lostDate}      {feature, shippedAt, solves[]}
        │                                              │
        ▼  extractObjection()  (NEW — mirrors reason())│
   {objection, category, quote, confidence}            │
        │                                              │
        ▼  clusterObjections() (NEW — 1 LLM call, or /graphify for the brain viz)
   objection clusters  ──────────────┐                 │
        │                            │                 │
        ▼                            ▼                 ▼
   Fiber external signal      matchRetrigger(objection × changelog × signal)   (NEW — core)
   (REUSE lib/fiber.ts:        → {matched, feature, why, score, breakdown}
    funding/hiring/                  │
    champion_job_change)             ▼  retriggerScore = w1·solved + w2·external + w3·recency + w4·sim_to_won
        │                            │
        └──────────────┬─────────────┘
                       ▼
              writeRetriggerCreative()  → creatives (status: draft, retriggerScore)   [REUSE creatives table]
                       │
        ┌──────────────┼───────────────────────────────────┐
        ▼              ▼                                    ▼
  renderArtifact   renderHeroVideo   ranked board (app)  send (nodemailer) → pixel → IMAP → draftReply()
  [REUSE]          [REUSE]           [re-aim signals UI]  [ALL REUSED UNCHANGED]
                       │
                       ▼  outcome logged → won_set grows → next nightly re-score sharper  [continuous learning]
```

---

## Mandatory Reading (before implementing)

| Priority | File | Why |
|---|---|---|
| P0 | `lib/agents.ts` | `reason()` is the exact pattern the NEW `extractObjection()` + `matchRetrigger()` must mirror (zodResponseFormat, OBJECT-root schema, skip-below-threshold, source grounding). |
| P0 | `lib/schemas.ts` | Zod boundary types. Add `LostDeal`, `Objection`, `ChangelogItem`, `RetriggerMatch` here. |
| P0 | `convex/schema.ts` | Additive-only contract. Add `lostDeals`, `changelog` tables + optional `retriggerScore`/`retriggerBreakdown` on `creatives`. |
| P0 | `convex/seed.ts` | Seed pattern (wipe-then-insert). Extend to seed lost deals + changelog. |
| P1 | `lib/livegen.ts` | The streaming orchestrator to mirror for `lib/retrigger.ts`. |
| P1 | `convex/creatives_write.ts` | How a creative (draft) is inserted — the re-trigger output reuses this. |
| P1 | `scripts/smoke-brain.ts` | Smoke-test pattern to mirror for `scripts/smoke-retrigger.ts`. |
| P2 | `app/signals/page.tsx` | The UI to re-aim into the ranked re-trigger board. |
| P2 | `lib/fiber.ts` | External-signal source for the `w2` term (already wired). |

---

## Patterns to Mirror (real codebase snippets — follow exactly)

### LLM_AGENT (mirror for extractObjection + matchRetrigger)
```ts
// SOURCE: lib/agents.ts — OBJECT-root zod schema, parse(), skip-below-threshold, grounded prompt
const ReasonResponse = z.object({ reasoning: Reasoning, anchorFact: z.string(), sources: z.array(...) });
const completion = await client().beta.chat.completions.parse({
  model: MODEL,
  messages: [{ role: "system", content: system }, { role: "user", content: leadContext(lead) }],
  response_format: zodResponseFormat(ReasonResponse, "reason"),
});
const parsed = completion.choices[0]?.message.parsed;
if (!parsed) throw new Error("reason: model returned no structured output");
if (parsed.reasoning.confidence < SKIP_BELOW) return { skip: true, why: ... };
```
Rules captured: API schema must be OBJECT root with required fields (no top-level union, `url: z.string().nullable()` not optional); map back to contract type after parse; **never invent facts — every claim cites a real field.** The objection-extract and match prompts inherit this grounding discipline.

### ZOD_BOUNDARY (mirror for new types)
```ts
// SOURCE: lib/schemas.ts — parse external data here, infer types downstream
export const Reasoning = z.object({ saw: z.string(), inferred: z.string(), pain: z.string(),
  angle: z.string(), whyThisAngle: z.string(), confidence: z.number().min(0).max(1) });
export type Reasoning = z.infer<typeof Reasoning>;
```

### CONVEX_SCHEMA (additive-only)
```ts
// SOURCE: convex/schema.ts — defineTable + .index(...); NEVER edit existing tables, only add
creatives: defineTable({ companyId: v.id("companies"), personId: v.id("people"),
  reasoning: reasoningV, status: v.union(v.literal("draft"), ...), ... })
  .index("by_status", ["status"]).index("by_company", ["companyId"]),
```

### SEED (wipe-then-insert)
```ts
// SOURCE: convex/seed.ts — run() WIPES demo tables then inserts, so re-running = clean board
for (const table of ["sends","creatives","people","companies"] as const)
  for (const doc of await ctx.db.query(table).collect()) await ctx.db.delete(doc._id);
const acmeId = await ctx.db.insert("companies", { fiberId: "seed-acme", name: "Acme Devtools", ... });
```

### SMOKE_TEST (one runnable check per new logic)
```ts
// SOURCE: scripts/smoke-brain.ts — exercise the chain on a mock, write output to .artifacts/, assert shape
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `lib/schemas.ts` | UPDATE | Add `LostDeal`, `Objection`, `ChangelogItem`, `RetriggerMatch` zod types + inferred exports. |
| `lib/objections.ts` | CREATE | `extractObjection(lostDeal)` + `clusterObjections(objections[])` — mirrors `agents.ts`. |
| `lib/retrigger.ts` | CREATE | `matchRetrigger(objection, changelog, signal)` + `scoreRetrigger(...)` + `runRetrigger()` streaming orchestrator (mirrors `livegen.ts`). The ONE core new file. |
| `lib/learning.ts` | CREATE | `embed()` + `similarityToWon(objection, wonSet)` — the `w4` continuous-learning term (OpenAI embeddings, cosine to won centroid). No model training. |
| `convex/schema.ts` | UPDATE | Add `lostDeals` + `changelog` tables; add optional `retriggerScore`, `retriggerBreakdown`, `externalSignal` to `creatives`. Additive-only. |
| `convex/lostDeals.ts` | CREATE | mutations/queries: insert lost deal, list re-triggerable creatives ordered by score. |
| `convex/seed.ts` | UPDATE | Seed ~18 lost deals (incl. ones that map to shipped features) + ~10 changelog items + 2-3 "re-won" outcomes for the learning centroid. |
| `app/signals/page.tsx` | UPDATE | Re-aim into the **ranked re-trigger board**: account · "said no for X" · "you shipped X" + external signal · score · reasoning · drafted creative. Reuse the realtime creatives grid. |
| `app/page.tsx` + `README.md` | UPDATE | Re-aim landing + README to the new thesis (graveyard → pipeline). |
| `scripts/smoke-retrigger.ts` | CREATE | Smoke the new loop end-to-end on seed data (mirrors `smoke-brain.ts`). Add `"smoke:retrigger"` to package.json. |

**Reused UNCHANGED (do not touch):** `lib/agents.ts` `writeCopy()`, `lib/artifact.tsx`, `lib/video.ts`, `lib/mail.ts`, `lib/sendgen.ts`, `lib/reply.ts`, `convex/sendEmail.ts`, `convex/sends.ts`, `convex/replies.ts`, `app/pixel/[id]/route.ts`, `remotion/*`. The re-trigger output is a normal `creative`, so the whole downstream works as-is.

## NOT Building (out of scope — protect the 24h)
- **No model training / serving.** "Continuous learning" = embedding-similarity + in-context examples + nightly re-score. (Optional kNN head only if a judge asks; not in the build.)
- **No real CRM/Gong integration.** Seed is first-party stand-in. (1-2 real deals only if ahead.)
- **No new send/reply/video infra.** All reused.
- **No vector DB.** ~18 objections × ~10 features fits in one prompt / in-memory cosine.
- **No auth, billing, multi-tenant, settings UI.**

---

## Step-by-Step Tasks (phased, hour-boxed, reuse-first)

### Phase 1 — Data spine (the input the whole thing reads)
**T1. Seed lost deals + changelog + won outcomes**
- ACTION: Extend `convex/seed.ts`; add `lostDeals` + `changelog` to `convex/schema.ts` first.
- IMPLEMENT: ~18 lost deals `{companyId?, account, contact, title, lostReason, lostDate, transcript?}`. Make ~8 map cleanly to a shipped changelog feature (the re-trigger hits), ~5 map to a Fiber external signal, ~5 genuinely not-ready (so the board shows discrimination, not "everything's a match"). ~10 changelog `{feature, description, shippedAt, solves[]}`. ~3 `wonOutcomes` (objection text of deals you re-won) for the learning centroid.
- MIRROR: SEED (wipe-then-insert).
- VALIDATE: `npx convex run seed:run` → tables populated; re-run = clean.

**T2. New zod types**
- ACTION: Add to `lib/schemas.ts`: `LostDeal`, `Objection {objection, category, quote, confidence}`, `ChangelogItem`, `RetriggerMatch {matched, feature, why, score, breakdown}`.
- MIRROR: ZOD_BOUNDARY. VALIDATE: `pnpm typecheck`.

### Phase 2 — The new brain (extract → match → score) ⚠️ this is the product
**T3. `extractObjection()`** — `lib/objections.ts`
- IMPLEMENT: LLM call, input lostReason+transcript, output `Objection`. Grounded: quote must be from the text; confidence<0.5 → skip. MIRROR: LLM_AGENT.
- VALIDATE: smoke prints objection for a seed deal; quote traces to source.

**T4. `clusterObjections()`** — `lib/objections.ts`
- IMPLEMENT: one LLM call buckets objections into named clusters (`enterprise-auth`, `price`, `missing-integration`, `not-ready`...). `// ponytail: 1 LLM call for ~18 items; /graphify is the brain-viz amplifier, not required for the score.`
- VALIDATE: clusters are sane on seed.

**T5. `matchRetrigger()` + `scoreRetrigger()`** — `lib/retrigger.ts` (CORE)
- IMPLEMENT: `matchRetrigger(objection, changelog[], fiberSignal)` → one LLM call returning `{matched, feature, why}` (does any shipped feature resolve this objection?). Then `scoreRetrigger`: `w1·solved + w2·external(fiber) + w3·recencyDecay(lostDate) + w4·similarityToWon`. Weights as named consts. MIRROR: LLM_AGENT.
- GOTCHA: keep the changelog small enough to pass whole — no retrieval needed at this scale.
- VALIDATE: seed deals rank; the 8 "hits" score high, the 5 "not-ready" score low.

**T6. `similarityToWon()`** — `lib/learning.ts`
- IMPLEMENT: OpenAI `text-embedding-3-small` on objection text; cosine to centroid of `wonOutcomes`; this is `w4`. `// ponytail: cosine to won centroid IS the "continuous learning". no training.`
- VALIDATE: re-won-like objections score higher; assert in smoke.

**T7. `runRetrigger()` orchestrator** — `lib/retrigger.ts`
- IMPLEMENT: stream: load lost deals → extract → cluster → (Fiber enrich for external signal, REUSE `lib/fiber.ts`) → match+score → for top-scoring, `writeCopy()` (REUSE) → `renderArtifact()` (REUSE) → insert `creative` (draft, with retriggerScore). MIRROR: `lib/livegen.ts`.
- VALIDATE: `scripts/smoke-retrigger.ts` runs full loop on seed, writes a draft creative + PNG to `.artifacts/`.

### Phase 3 — Surface it (reuse downstream)
**T8. Ranked re-trigger board** — `app/signals/page.tsx`
- IMPLEMENT: realtime list of re-trigger creatives ordered by `retriggerScore`; each row shows the *reasoning chain* (said-no-for-X → shipped-X → external signal → score breakdown). Reuse the existing creatives grid + sources popover. Edit/approve/send buttons already wired.
- VALIDATE: board renders seed results, sorted, legible at 10ft.

**T9. Send + reply (REUSE, verify only)**
- ACTION: confirm a re-trigger creative flows through existing send → pixel → IMAP → `draftReply()` unchanged. Self-send seed row to your own inbox.
- VALIDATE: `pnpm smoke:send`; one real email lands; a pasted reply drafts a follow-up.

**T10. Hero video (REUSE)** — render ONE re-triggered whale.
- ACTION: `pnpm video <creativeId>` on the top-scored account. `// ponytail: 1 hero video for the demo, not all accounts.`
- VALIDATE: MP4 renders; backup saved.

### Phase 4 — Continuous-learning loop + narrative
**T11. Nightly re-score (the "keeps running" beat)**
- IMPLEMENT: reuse `runs` table + a `scripts/retrigger.ts` batch (mirror `coverage.ts`) that re-scores all lost deals. Demo it as "runs every night; as deals re-close, won_set grows, scores sharpen." Manual trigger button is enough for the demo. `// ponytail: cron is a 1-liner post-hackathon; demo via manual re-run + narration.`
- VALIDATE: re-running after adding a won outcome visibly shifts a score.

**T12. Re-aim narrative** — `app/page.tsx`, `README.md`, retire `sales-cyborg-*` framing in copy.
- VALIDATE: landing + README tell the graveyard→pipeline story; track = Reading Minds.

### Phase 5 — Ship + demo
**T13. Open-source + secret check** — verify repo public; **confirm `.env` not in git history** (only `.env.example` tracked — already true); README has setup + MIT.
**T14. Rehearse the 60-sec pitch + record a backup demo video.**
**T15. (Do-things-that-don't-scale beat)** — film one tiny IRL/manual moment for the submission (judges explicitly reward this).

---

## ✅ JOBS-TO-BE-DONE — Vision Coverage Matrix (the "nothing aimed-for is missed" checklist)

Every element we discussed → where it's covered. This is the acceptance contract.

| # | Vision element discussed | Covered by | Status |
|---|---|---|---|
| V1 | Reframe: stop "search→send email", do warm re-engagement | North Star + pitch + T8 | ☐ |
| V2 | Information asymmetry / "signal nobody else has" (Vincent) | Lost-reason = first-party signal (T1, T3) | ☐ |
| V3 | Vincent's Gong lost-reason mining play, productized | T3–T5 (extract → match) | ☐ |
| V4 | "What changed since" — external trigger (champion_job_change) | Fiber `w2` term (T5, reuse `fiber.ts`) | ☐ |
| V5 | Objection clustering / the "company brain" (Danylo) | T4 (+ optional `/graphify` viz) | ☐ |
| V6 | Data-context: "which data is relevant" (Danylo) | seed=first-party + Fiber=external split (T1) | ☐ |
| V7 | Creative payoff — not just email (video/artifact) | REUSE artifact + video (T10) | ☐ |
| V8 | "Continuous learning / mind-reading per customer" | embedding-similarity + nightly re-score (T6, T11) | ☐ |
| V9 | "Keeps running" automatic system | `runs` batch re-score (T11) | ☐ |
| V10 | Retention/lifecycle = re-engagement (both judges) | whole product is re-engagement | ☐ |
| V11 | Respond-fast / carry the conversation | REUSE `draftReply()` (T9) | ☐ |
| V12 | Hearts & minds, proof you remember | reasoning chain + proof-artifact (T8) | ☐ |
| V13 | Do-things-that-don't-scale + film it | T15 | ☐ |
| V14 | Focus ONE bucket (Vincent's advice) | locked: signal-detection-on-churn only | ☐ |
| V15 | Reuse existing machine (vid-gen, email, brain) | Reuse map — ~85% | ☐ |

## ✅ Judge Pain-Point → Answer (alignment check)
- ☐ "Cold email is dead (1%)" → we don't cold-email; we re-engage warm.
- ☐ "Tool/narrative fatigue, everyone says the same" → opposite motion (graveyard, not more outbound).
- ☐ "Signals = info asymmetry" → first-party lost-reasons + the dissolve-moment.
- ☐ Danylo (judge, Lopus) data-context thesis → seed/Fiber split + brain.
- ☐ "Forward-deployed context problem" → the objection×changelog match IS the context layer.

## ✅ Hackathon-Criteria Checklist
- ☐ Track declared: **Reading Minds**.
- ☐ Built during event, single repo (Cutthrough, started at kickoff — compliant).
- ☐ **Open-sourced on GitHub for the duration** (public before judging).
- ☐ **No secrets in repo/history** (`.env` gitignored ✓; verify history before public).
- ☐ Live demo works on seed; cached/backup for the live beat.
- ☐ Backup demo video recorded (Gate 6).
- ☐ 60-sec pitch rehearsed ≥2×.
- ☐ OpenAI/Convex/Cursor sponsors acknowledged where used.

---

## Continuous-Learning Approach (what we SAY and what we SHIP)
**Say:** "It learns continuously — as lost deals re-close, it gets sharper at spotting who'll come back."
**Ship (honest, no training):** every closed outcome → (a) appended as an in-context example to the match prompt, (b) added to the `wonOutcomes` set whose embedding centroid drives the `w4` similarity term. Nightly batch re-scores the whole graveyard. The score visibly moves when an outcome is added → that's the demoable "learning." No weights, no GPU, no serving.

---

## Validation Commands
```bash
pnpm typecheck                 # EXPECT: zero errors
npx convex run seed:run        # EXPECT: lostDeals + changelog populated, clean re-run
pnpm smoke:retrigger           # EXPECT: extract→match→score→draft creative + PNG in .artifacts/
pnpm smoke:send                # EXPECT: valid escaped email HTML + pixel
pnpm dev                       # EXPECT: ranked re-trigger board renders sorted by score
pnpm video <creativeId>        # EXPECT: hero MP4 renders
```
Manual: ☐ self-send one seed row → lands in inbox · ☐ paste a reply → follow-up drafts · ☐ add a won outcome, re-run → a score shifts.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Pivot at ~hour 7 burns the working demo | Med | High | Re-aim, don't delete — downstream untouched; if new layer breaks, the cold path still runs as private fallback (full re-aim only changes *framing*, code stays). |
| Match step feels generic ("everything matches") | Med | High | Seed 5 deliberate non-matches; require cited feature + objection; tune weights so the board discriminates. This is Gate-1 quality — fix the prompt, not later. |
| Secrets leaked when going public | Low | Critical | `.env` gitignored ✓; scan history before `git push` public; rotate if exposed. |
| Time sink on graphify viz / clustering | Med | Med | Clustering = 1 LLM call (core); graphify viz is amplifier-only, behind the cut line. |
| Fiber key/endpoint flaky | Med | Med | `w2` external term degrades gracefully to 0; internal objection×changelog signal stands alone. |

## Cut-Ladder (drop in THIS order when behind)
1. Hero video (already optional)
2. `/graphify` brain viz → plain cluster list
3. Nightly re-score automation → manual re-run + narration
4. Fiber `w2` term → internal objection×changelog only
5. **Floor:** seed lost deals → extract → match → ranked board with reasoning + one drafted re-engagement creative + the thesis. *This alone beats another cold-outbound tool.*

## Demo Script (7 beats)
1. Thesis: "everyone's building cold outbound into a dead channel."
2. Show the graveyard (lost-deal board).
3. Pick one: "Acme said no for SSO."
4. Reveal the dissolve: "we shipped SSO + champion just promoted" → score.
5. Show the proof-creative (image/video) it wrote.
6. "It re-scores every night and learns from re-closes" → add an outcome, score moves.
7. "Name a lost deal." (live, cached backup ready.)

## Confidence: 8/10 single-pass — high reuse, small new surface; main risk is match-quality (Gate-1) and pivot discipline, both mitigated above.
