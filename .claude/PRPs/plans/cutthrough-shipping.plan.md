# Plan: Cutthrough — Multi-Branch Shipping Plan (24h solo)

## Summary
Phase-by-phase shipping plan for **Cutthrough — an AI SDR** that discovers prospects, reasons like a senior rep over their freshest signal (incl. their real social posts), proves it understood with a Satori-rendered artifact, lets a human approve, sends, and carries the reply. This doc turns the build into **independently shippable git branches** with explicit dependencies, a "what-can-ship-together" matrix, and the conflict-avoidance contract that makes parallel branches safe for a solo dev (or multiple agents/worktrees).

> Strategy & "why" live in `sales-cyborg-cutthrough.plan.md`. Hour-by-hour deadlines live in `TIMELINE.md`. **This doc is the *how-to-ship* layer over both.**

## User Story
As the solo builder, I want each piece of Cutthrough scoped as an independent branch with a clear JTBD and acceptance test, so that I can build/merge in any order, never block on a half-done branch, and always have a working demo to fall back to.

## Problem → Solution
One giant 24h branch that only works at the end (all-or-nothing, merge hell, no fallback) → **a trunk that locks all contracts up front, then 9 mostly-independent feature branches**, each shippable alone, each leaving a working demo.

## Metadata
- **Complexity**: Large (greenfield, external integrations, real-time UI, batch). Split into 10 branches.
- **Source docs**: `sales-cyborg-cutthrough.plan.md`, `TIMELINE.md`
- **Repo state**: NOT a git repo yet — `git init` is the first action (P0).
- **Estimated surface**: ~18–22 files across 10 branches.

---

## Mandatory Reading (before any branch)
| Priority | File | Why |
|---|---|---|
| P0 | `sales-cyborg-cutthrough.plan.md` | Thesis, component responsibilities, data model, artifact stack (Satori/Remotion), the locked scope. |
| P0 | `TIMELINE.md` | The 6 hard gates + feature-freeze + cut-ladder. Maps each branch to a clock deadline. |
| P1 | Fiber: `api.fiber.ai/llms.txt` + `ai-docs/index.md` | Canonical endpoint list, credit costs, async social-lookup pattern. |

External research: already captured in the source plan's "External Documentation" + GOTCHA log. **No further research needed before coding.**

---

## THE SHIPPING STRATEGY (read this first — it's what makes branches safe)

Multi-branch only works if branches don't fight over the same files. Four rules make that true:

1. **Lock ALL contracts in the trunk (P0), never in feature branches.**
   - `convex/schema.ts` — the full schema (every table) is defined once in P0. **Feature branches never edit schema** (additive-only, coordinated if truly needed). The schema is the integration contract: every branch reads/writes it without touching it.
   - `lib/fiber.ts` and `lib/agents.ts` — committed in P0 as **typed signatures + `throw "not impl"` stubs**. Branches *implement* against a stable interface that already exists.

2. **One Convex function file per concern** (so two branches rarely open the same file):
   `convex/companies.ts` · `people.ts` · `creatives_write.ts` · `creatives_read.ts` · `sends.ts` · `replies.ts` · `tracker.ts` · `seed.ts`.
   (Splitting `creatives` into read/write is deliberate — it's the one file the brain-branch and the dashboard-branch would otherwise collide on.)

3. **Seed data in P0** (`convex/seed.ts` inserts 3–5 fake creatives). The dashboard and send branches build against the seed, so they don't wait on the data/brain branches.

4. **Global styling/polish is its own branch, merged LAST** (after feature freeze). It touches everything, so it can't run concurrently with feature work.

> Net effect: after P0, branches A/B/C/D touch disjoint files → merge in any order. Wave-2 branches E/F/G/H likewise. The only coordinated file is `lib/fiber.ts` (batch fns) — handled by stubbing in P0.

---

## Dependency DAG

```
                          ┌─────────────────────────────┐
                          │  P0  trunk: scaffold +       │   SEQUENTIAL — blocks all
                          │  schema + stubs + seed       │
                          └───────────────┬─────────────┘
                ┌──────────────┬──────────┼───────────┬──────────────┐
                ▼              ▼           ▼           ▼              ▼
        ┌───────────┐  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
WAVE 1  │ A  fiber  │  │ B  brain  │ │ C  dash  │ │ D send+  │ │ H signal │   ALL PARALLEL
(any    │  -data    │  │ +artifact │ │ -board   │ │  reply   │ │  -spine  │   (disjoint files)
order)  └─────┬─────┘  └─────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
              └──────┬───────┘            │            │            │
                     ▼                    │            │            │
            ┌──────────────────┐          │            │            │
            │ MERGE: core loop │◀─────────┴────────────┴────────────┘
            │ live (real data  │     = GATE 2 (Sun 1am): complete mini-demo
            │ → reason → card  │
            │ → approve → send │
            │ → reply)         │
            └───────┬──────────┘
        ┌───────────┼───────────────┬───────────────┐
        ▼           ▼               ▼               ▼
  ┌──────────┐ ┌──────────┐  ┌──────────┐    ┌──────────┐
WAVE 2  │ E live-  │ │ F batch  │  │ G video  │    │ (H if    │   PARALLEL
        │  gen     │ │ overnight│  │  hero    │    │  not yet)│   (all need A+B)
        └────┬─────┘ └────┬─────┘  └────┬─────┘    └────┬─────┘
             └────────────┴─────────────┴───────────────┘
                                 ▼
                       ┌──────────────────┐
                       │ I  polish + ship │   LAST, SEQUENTIAL (touches everything)
                       │ (branding/README │   after FEATURE FREEZE (Gate 5, Sun 2pm)
                       │  /open-source)   │
                       └──────────────────┘
```

---

## The branches (phase by phase)

### Legend
- **Ships alone?** = can be merged to main and demoed on its own (the priority-ladder principle).
- **Parallel-safe with** = branches it shares no files with (merge in any order).

---

### P0 — `main` (trunk): Foundation & Contracts  ·  ⏰ Sat 6–7pm (H1)
- **JTBD:** stand up the app and lock every integration contract so feature branches never conflict.
- **Files (CREATE):** `package.json`, Next.js App-Router skeleton, `convex/schema.ts` (ALL tables from the data model), `convex/seed.ts`, `lib/fiber.ts` (signatures + stubs), `lib/agents.ts` (signatures + stubs), `convex/{companies,people,creatives_write,creatives_read,sends,replies,tracker}.ts` (empty exports/stubs), `.env.example`, `README.md` (skeleton).
- **Expected behavior:** `npx convex dev` pushes schema clean; `npm run dev` serves an empty shell; `seed` inserts fake creatives visible in the Convex dashboard; `npx tsc --noEmit` is green.
- **Ships alone?** N/A (it's the trunk).
- **Acceptance:** schema pushes; seed rows appear; type-check passes; `.env.example` complete.
- **GOTCHA:** Do NOT implement real logic here — only signatures + stubs + schema. Resist building features in the trunk; that's what the branches are for.

---

### WAVE 1 — branch off `main` after P0. A · B · C · D · H are mutually parallel-safe.

### A — `feat/fiber-data`: Signal layer  ·  ⏰ folded into H1–2
- **JTBD:** turn one ICP sentence / company into an enriched lead (incl. real recent posts) written to Convex.
- **Files:** implement `lib/fiber.ts` (`searchCompanies`, `findContact`, `enrich`, `socialLookup`, `revealEmail`, `getCredits`, logo/screenshot helpers); fill `convex/companies.ts` + `people.ts` mutations; `scripts/smoke-fiber.ts`.
- **Depends on:** P0 (schema + fiber stub interface). **Independent of B/C/D/H.**
- **Expected behavior:** real company name → `companies`+`people` rows incl. `socialPosts[]`; every call logs `chargeInfo`; `getCredits()` works.
- **Ships alone?** ✅ verify via `node scripts/smoke-fiber.ts` + Convex dashboard.
- **Acceptance:** one real lead with email + ≥1 recent post + chargeInfo in Convex.
- **GOTCHA:** social-lookup is **async** (trigger→poll w/ timeout); free `companyCount`/`getCredits` before paid calls; concurrency cap 5.

### B — `feat/sdr-brain`: Reasoning + Satori artifact + copy  ·  ⏰ Sat 7–9pm (H2–4) ⚠️ CRITICAL
- **JTBD:** enriched lead → sharp reasoning chain + crisp on-brand Satori artifact + 2-line copy → `creatives` row. **This is the product.**
- **Files:** implement `lib/agents.ts` (`reason`, `writeCopy`); `lib/artifact.tsx` (Satori template, real logo/name/fact/post slots); `convex/creatives_write.ts`; `scripts/smoke-brain.ts`.
- **Depends on:** P0 (schema + agents interface + the enriched-lead *shape*). **Can build against a hand-mocked enriched object — does NOT need A merged.** Parallel-safe with A/C/D/H.
- **Expected behavior:** enriched lead (mock or real) → `creatives` row with `reasoning{saw,inferred,pain,angle,whyThisAngle,confidence}` + `sources[]` + a PNG whose **logo/text are pixel-perfect** (real, not generated) + copy variants.
- **Ships alone?** ✅ verify via `node scripts/smoke-brain.ts`.
- **Acceptance:** 5 real companies → 5 sharp reasoning chains traceable to real fields/posts; artifacts look designed, no slop.
- **GOTCHA:** if reasoning is generic ("congrats on the raise") **stop and fix the prompt — nothing else matters until this is sharp** (Gate 1). Never let a model draw logos/text — Satori renders from real data. `gpt-image-1` = backdrop only.

### C — `feat/dashboard`: Cyborg review UI  ·  ⏰ Sat 9–11pm (H4–6)
- **JTBD:** browse the pipeline, read the reasoning chain first-class, edit/pick-variant/approve.
- **Files:** `app/page.tsx`, `components/Card.tsx`, `components/ReasoningChain.tsx`, `components/SourcesPopover.tsx`; `convex/creatives_read.ts` (queries + `approve` mutation).
- **Depends on:** P0 (schema + **seed data**). **Does NOT need A or B merged — builds against seed.** Parallel-safe with A/B/D/H (uses `creatives_read.ts`, not `_write.ts`).
- **Expected behavior:** cards stream live (Convex `useQuery`); reasoning legible in 2s; edit copy + approve flips `status` to `approved`; filter by status.
- **Ships alone?** ✅ with seed data.
- **Acceptance:** seeded cards render; approve works; reasoning is the visual focus (not buried in a popover).
- **GOTCHA:** `useQuery` auto-subscribes — no polling. Lazy-load images.

### D — `feat/send-reply`: Send + tracking + Reply Cyborg  ·  ⏰ Sat 11pm–1am (H6–8)
- **JTBD:** approved creative → real email sent + open tracked; inbound reply → AI-drafted follow-up.
- **Files:** `lib/mail.ts` (nodemailer), `lib/reply.ts` (reply cyborg), `app/pixel/[id]/route.ts`, `convex/sends.ts`, `convex/replies.ts`.
- **Depends on:** P0 (schema + an approved creative via seed). **Independent of A/B/C/H.**
- **Expected behavior:** seeded approved creative → real email arrives; pixel logs `openedAt`; a reply (IMAP poll **or** "paste-a-reply" box) → `replies` row with a contextual `draftReply`.
- **Ships alone?** ✅ tested against a seed creative.
- **Acceptance:** real email lands; open registers; a reply produces a follow-up you'd actually send.
- **GOTCHA:** low volume (20–40), plain text + one image, warmed Gmail. Reply poll flaky → the **paste-a-reply box** must always trigger the cyborg so the loop demos regardless.

### H — `feat/signal-spine`: "the 52 triggers we watch"  ·  ⏰ fold into H4–6 (cheap)
- **JTBD:** make the growth-engine narrative real — show the trigger taxonomy + job-change as the hero trigger.
- **Files:** `convex/tracker.ts` (`listAvailableTrackerRules` call + cache), `components/TriggerPanel.tsx`.
- **Depends on:** P0; lightly on C for where the panel renders. Parallel-safe with A/B/D.
- **Expected behavior:** a panel lists the 52 signal types; a "replay this trigger" action runs the loop on a company that genuinely just had the event (funding/hire/job-change).
- **Ships alone?** ✅ (panel works standalone; replay needs A+B for the full effect).
- **Acceptance:** 52 rules display; one job-change replay produces a reasoned card.
- **GOTCHA:** demo by **replaying real recent signals** + `fireTrackerDummy` — never claim a live webhook fired if it didn't (honesty guard).

---

### MERGE POINT — `main`: "core loop live"  ·  ⏰ Sun 1am = GATE 2
Merge A + B + C + D (+ H). Now real data flows discover→reason→artifact→approve→send→reply. **This is a complete, winnable demo on its own.** Everything after is amplification.

---

### WAVE 2 — branch off `main` after the core-loop merge. E · F · G are mutually parallel-safe (all need A+B).

### F — `feat/overnight-batch`: coverage at scale  ·  ⏰ Sun 1–2am kickoff (H8–9), runs overnight
- **JTBD:** push 200–300 real ICP companies through the loop overnight → wake to a full reasoned pipeline.
- **Files:** `scripts/coverage.ts`; additive batch helpers in `lib/fiber.ts` (social `batch/trigger`+`poll`).
- **Depends on:** A + B merged. Parallel-safe with E/G (different files, except additive fiber batch fns — stub these in P0 to avoid the one possible collision).
- **Expected behavior:** `companyCount`→cap≤300→credit check→enrich+reason+render at concurrency 5, cached by `companyId`, retry once, idempotent, checkpointed; `chargeInfo`+failures logged to `runs`/`log`.
- **Ships alone?** ✅ (a script; verify cost within credits).
- **Acceptance:** pipeline fills to hundreds of reasoned cards by morning; a crash resumes from checkpoint.
- **GOTCHA:** NEVER generate live in the demo. Images only at scale (video too slow). Don't launch a broken batch — if the loop isn't solid by 2am, sleep and run a 50-co batch in the morning.

### E — `feat/live-gen`: "name any company" (reasoning streamed)  ·  ⏰ Sun 8–10am (H15–17) = GATE 4
- **JTBD:** judge names a company → reasoning streams on screen → finished card in ~90s. The verifiable WOW.
- **Files:** `app/api/live/route.ts` (SSE/stream), `app/live/page.tsx` or a box on the dashboard.
- **Depends on:** A + B merged. Parallel-safe with F/G.
- **Expected behavior:** type name → fire social-lookup first + enrich in parallel → stream `saw→inferred→angle` → card <90s; pre-rendered/cached inputs (judges'/sponsors'/famous cos) instant.
- **Ships alone?** ✅ once core merged.
- **Acceptance:** live card under ~90s; cached backups exist for every plausible name; degrades to firmo-only if social is slow.
- **GOTCHA:** keep a pre-rendered backup for every likely input — API flake mid-demo is fatal otherwise.

### G — `feat/video-hero`: Remotion + TTS gasp beat (Tier-2)  ·  ⏰ Sun 12–2pm (H19–21), gated
- **JTBD:** one whale/judge company → personalized MP4 (logo + data animate in, AI voiceover names them + their situation).
- **Files:** `remotion/HeroVideo.tsx`, `lib/video.ts`, a "make video" Convex action.
- **Depends on:** B merged (reasoning + assets). Parallel-safe with E/F.
- **Expected behavior:** one company → polished MP4, logo/name/fact **correct** (Remotion overlay); optional pre-rendered Sora/gpt-image backdrop behind.
- **Ships alone?** ✅ but **gated behind Gate 2** — only build if the core demo is already solid.
- **Acceptance:** one flawless MP4 + a recorded backup MP4.
- **GOTCHA:** specifics via Remotion overlay ONLY (Sora/gpt-image can't render crisp logos/text). Record the backup in rehearsal. **Cut without guilt if behind.**

---

### I — `chore/polish-demo`: projector polish + open-source  ·  ⏰ Sun 10am–12pm + 2–4pm (H17–19, H21–23)
- **JTBD:** make it look designed at 10ft; ship the repo; rehearse; record the backup demo.
- **Files:** `styles/*`, `tokens.css`, branding across components, `README.md`, `LICENSE`, demo-script doc. **Touches many files.**
- **Depends on:** all feature branches merged. **MUST be last + sequential** — global styling conflicts with everything, so it can't run concurrently with feature work.
- **Expected behavior:** reasoning chain beautiful + legible; pipeline + reply-inbox + live-gen views polished; repo public (MIT) with README; clean backup demo recorded.
- **Ships alone?** N/A (it's the finishing pass).
- **Acceptance:** Gate 6 — repo public, demo rehearsed ≥2×, backup video exists.
- **GOTCHA:** this branch opens after **FEATURE FREEZE (Gate 5, Sun 2pm)**. No new features here — styling, copy, docs, rehearsal only.

---

## WHAT CAN SHIP TOGETHER vs WHAT CANNOT

### ✅ Can ship together (parallel branches — merge in any order, no shared files)
| Group | Branches | Why safe |
|---|---|---|
| Wave 1 | **A · B · C · D · H** | Disjoint files. Contracts (schema, lib stubs) fixed in P0; `creatives` split into `_read`/`_write`; UI/send build on seed. |
| Wave 2 | **E · F · G** | Disjoint files; all consume the merged core (A+B) read-only-ish. (F's fiber-batch fns stubbed in P0 to avoid collision.) |

### ⛔ Cannot ship together (must be sequential — hard dependency or global conflict)
| Must come before | Branch | Reason |
|---|---|---|
| **P0** | everything | Schema + interfaces + seed are the contract all branches bind to. |
| **A + B (merged)** | E, F, G | Live-gen, batch, and video all reuse the discover→reason→artifact loop. |
| **a seed/approved creative** | C, D | Dashboard needs creatives to render; send needs an approved one. (P0 seed satisfies this.) |
| **feature freeze (Gate 5)** | I (polish) | Global styling/branding touches every component — conflicts with any concurrent feature work. |

### The one coordinated file
`lib/fiber.ts` — A implements it; F adds batch fns. **Mitigation:** P0 commits the batch-fn signatures as stubs, so A and F edit different function bodies, not the same lines.

---

## Recommended merge order (solo, maps to TIMELINE gates)
1. `main` P0 (H1) →
2. `feat/sdr-brain` B + `feat/fiber-data` A (H2–4) — *brain first, it's the product* →
3. `feat/dashboard` C (H4–6) + `feat/signal-spine` H →
4. `feat/send-reply` D (H6–8) → **MERGE = Gate 2 (Sun 1am)** →
5. `feat/overnight-batch` F (kick off H8–9, runs overnight) →
6. `feat/live-gen` E (H15–17 = Gate 4) →
7. `feat/video-hero` G (H19–21, if ahead) →
8. `chore/polish-demo` I (H17–19 styling, H21–23 ship = Gate 6).

Each merge to `main` must keep `main` demoable (cut-ladder fallback).

---

## NOT Building (scope guard — same as source plan)
- Auth, multi-tenant, billing, settings UI, CRM/Slack sync.
- Real A/B framework, multi-armed bandit.
- Per-lead video (only the ONE hero clip; images for the wall).
- Shiny off-thesis Fiber endpoints (TikTok/Reddit/YouTube/real-estate/etc.).
- Anything not on screen during the 7-beat demo.

---

## Validation Commands (per branch)
```bash
npx tsc --noEmit                       # every branch: zero type errors
npx convex dev                         # P0: schema pushes clean
node scripts/smoke-fiber.ts            # A: real lead + post + chargeInfo
node scripts/smoke-brain.ts            # B: sharp reasoning + crisp artifact
npm run dev                            # C/E: dashboard renders, cards stream, live-gen works
# D: send a seed creative to your own inbox; confirm open pixel + paste-a-reply → draft
node scripts/coverage.ts --limit 50    # F: dry-run small before the 300 overnight run
# G: render one HeroVideo, eyeball logo/name correctness
```

## Acceptance Criteria (whole product)
- [ ] P0 schema + stubs + seed merged; `main` always demoable thereafter.
- [ ] A: real enriched lead w/ social posts in Convex.
- [ ] B: sharp, traceable reasoning + slop-free Satori artifact (Gate 1).
- [ ] C: live pipeline, reasoning first-class, approve works.
- [ ] D: real send + open + reply→draft (paste-a-reply fallback works).
- [ ] Core loop merged by **Gate 2 (Sun 1am)**.
- [ ] F: overnight pipeline full, cost within credits.
- [ ] E: live-gen <90s + cached backups (Gate 4).
- [ ] G: one hero MP4 + backup (or consciously cut).
- [ ] I: repo public + rehearsed + backup demo recorded (Gate 6).

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Schema churn mid-build breaks branches | Med | High | Lock full schema in P0; additive-only after; coordinate the rare change. |
| Two branches edit `lib/fiber.ts` | Med | Med | Stub batch fns in P0 so A and F touch different bodies. |
| Brain reasoning generic → whole thing reads as image tool | Med | Critical | B is critical-path; Gate 1 says fix the prompt before scaling. |
| Polish started too early → merge conflicts everywhere | Med | Med | `I` opens only after feature freeze (Gate 5). |
| Solo runs out of time mid-branch | High | Med | Every branch ships alone; cut-ladder keeps `main` demoable. |
| Fiber key arrives late | Med | High | B builds on mocked enriched object; swap to real (A) when key lands. |

## Notes
- `git init` is part of P0. Branch naming: `feat/*` for features, `chore/*` for polish.
- "Parallel" for a solo dev = independent mergeability + safe to hand any branch to a separate agent/worktree. Build order is still one-at-a-time per the merge order above.
- This plan is the *shipping* layer; behavior/why per component lives in `sales-cyborg-cutthrough.plan.md`, deadlines in `TIMELINE.md`. Keep all three in sync.
