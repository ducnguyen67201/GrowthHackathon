# Plan: Cutthrough — WAVE 1: The Core Loop (5 parallel branches)

> **Agent scope:** up to 5 agents, ONE per branch, ALL branch off `main@wave-0-done`. Mutually parallel-safe (disjoint files).
> **Prereq:** Wave 0 merged (schema + `lib/*` stubs + `convex/*` split files + seed exist). **Import contracts from Wave 0 — never redefine schema/types/signatures.**
> **Goal of the wave:** by merge, real data flows **discover → reason → artifact → approve → send → reply** = a complete, winnable demo (TIMELINE Gate 2, Sun 1am).
> Context: `sales-cyborg-cutthrough.plan.md` (why), `wave-0-foundation.plan.md` (contracts), `TIMELINE.md` (gates).

## Contracts already in the repo (from Wave 0 — import, don't recreate)
- Types: `@/lib/schemas` (`EnrichedLead`, `Reasoning`, `ReasonResult`, `CopyVariant`, `SocialPost`, `Source`) and `convex/validators` (`reasoningV`, `socialPostV`, etc.).
- DB: `convex/schema.ts` tables `companies/people/creatives/sends/replies/runs/log`; `Doc<"...">`, `Id<"...">` from `convex/_generated/dataModel`.
- Stubs to IMPLEMENT: `lib/fiber.ts`, `lib/agents.ts`, `lib/artifact.tsx`, `lib/mail.ts`, `lib/reply.ts`; Convex files `companies/people/creatives_write/creatives_read/sends/replies/tracker.ts`.
- Seed data exists (`convex/seed.ts`) — UI/send branches build against it without waiting on A/B.

## TS rules (inherited from Wave 0)
Strict TS, no `any`, no casts except at a Zod boundary. Parse all external data (Fiber/OpenAI) with Zod. Convex Node actions using satori/nodemailer/imapflow need `"use node";`. Errors thrown with context, never swallowed.

## Parallelization within the wave
| Branch | Files (disjoint) | Builds against |
|---|---|---|
| A `feat/fiber-data` | `lib/fiber.ts`, `convex/companies.ts`, `convex/people.ts`, `scripts/smoke-fiber.ts` | real Fiber API |
| B `feat/sdr-brain` | `lib/agents.ts`, `lib/artifact.tsx`, `convex/creatives_write.ts`, `scripts/smoke-brain.ts`, `app/api/artifact/[id]/route.ts` | a **mocked `EnrichedLead`** (doesn't need A) |
| C `feat/dashboard` | `app/page.tsx`, `components/*`, `convex/creatives_read.ts` | **seed data** (doesn't need A/B) |
| D `feat/send-reply` | `lib/mail.ts`, `lib/reply.ts`, `app/pixel/[id]/route.ts`, `convex/sends.ts`, `convex/replies.ts` | a seeded **approved** creative |
| H `feat/signal-spine` | `convex/tracker.ts`, `components/TriggerPanel.tsx` | Fiber `listAvailableTrackerRules` |
> Only `creatives` is split (`_read` for C, `_write` for B) so B and C never collide. Merge order is free.

---

## Branch A — `feat/fiber-data`
**JTBD:** real company/ICP → enriched lead (incl. real recent posts) → `companies`+`people` in Convex.
- **ACTION:** implement `lib/fiber.ts` bodies; add `companies.upsert` + `people.upsert` mutations; write `scripts/smoke-fiber.ts`.
- **IMPLEMENT:**
  - REST base `https://api.fiber.ai`, header `x-api-key: $FIBER_API_KEY`. Flow: `textToCompanySearch`/`companySearch` → `peopleSearch` → `profileLiveEnrich`(+`KitchenSinkProfile`) → `social-media-lookup/trigger` then poll `/polling` (timeout ~8s, degrade to `[]`) → `syncQuickContactReveal` → `getLogo`/`getScreenshot`.
  - **Parse every Fiber response with Zod**, map to `EnrichedLead`. Capture `chargeInfo` → write to `log`. `getCredits()` via `GET /v1/get-org-credits`.
- **GOTCHA:** social-lookup is async (trigger→poll); call free `companyCount`/`getCredits` before paid calls; concurrency cap 5; on social timeout proceed firmo-only.
- **VALIDATE:** `pnpm smoke:fiber "Vercel"` → a `companies`+`people` row with ≥1 `socialPost` + `chargeInfo` logged.
- **Ships alone:** ✅. **Acceptance:** one real lead w/ email + recent post in Convex.

## Branch B — `feat/sdr-brain`  ⚠️ CRITICAL (this is the product — Gate 1)
**JTBD:** `EnrichedLead` → sharp reasoning chain + crisp Satori artifact + copy → `creatives` row.
- **ACTION:** implement `lib/agents.ts` (`reason`, `writeCopy`), `lib/artifact.tsx` (`renderArtifact`), `convex/creatives_write.ts` (`create`, `setArtifact`), `app/api/artifact/[id]/route.ts` (serve PNG from storage), `scripts/smoke-brain.ts`.
- **IMPLEMENT:**
  - `reason`: OpenAI with `zodResponseFormat(ReasonResult, "reason")`. Prompt forces `saw`(cite real field/post)→`inferred`→`pain`→`angle`→`whyThisAngle`(must contrast the obvious "congrats" angle)→`confidence`. Build `sources[]` from cited fields. `confidence < 0.5` → `{skip:true}`.
  - `writeCopy`: `zodResponseFormat(z.array(CopyVariant)…)`, 2 variants, warm + specific.
  - `renderArtifact`: **Satori** (`import satori from "satori"`) → SVG with a designed template: real `logoUrl`, company name, `anchorFact`, the post quote, brand color; rasterize with `@resvg/resvg-js` → PNG `Buffer`. Store via `ctx.storage.store()` → set `artifactStorageId`, `artifactType:"image"`. 2 template variants. `gpt-image-1` ONLY for an optional backdrop.
- **GOTCHA:** **if reasoning is generic, STOP and fix the prompt before anything else** (Gate 1 — nothing downstream matters). Never let a model draw logos/text — Satori renders from real data. Satori needs the `public/fonts/Inter-*.ttf` buffers (from Wave 0). Node-only libs → `"use node";` if rendering inside a Convex action.
- **VALIDATE:** `pnpm smoke:brain` (feeds a mocked `EnrichedLead`) → a `creatives` row with reasoning traceable to sources + a PNG whose logo/text are pixel-perfect. Run on 5 real companies before declaring done.
- **Ships alone:** ✅ (mock lead). **Acceptance:** 5 sharp, slop-free cards.

## Branch C — `feat/dashboard`
**JTBD:** browse the pipeline; reasoning chain first-class; edit/pick-variant/approve.
- **ACTION:** `app/page.tsx` (RT grid via `useQuery`), `components/Card.tsx`, `components/ReasoningChain.tsx`, `components/SourcesPopover.tsx`; `convex/creatives_read.ts` (`list` query + `approve`/`editCopy`/`pickVariant` mutations).
- **IMPLEMENT:** card shows reasoning (`saw→inferred→angle→why`) prominently, the artifact (`/api/artifact/[id]` or storage url), editable copy, sources popover, variant switcher, Approve→`status:"approved"`. Filter by status. A reasoning log panel.
- **GOTCHA:** `useQuery` auto-subscribes — no polling. Reasoning is the visual hero — don't bury it in a popover. Lazy-load images.
- **VALIDATE:** seeded cards render live; approve flips status; reasoning legible in 2s.
- **Ships alone:** ✅ (seed data). **Acceptance:** browse + approve works on seed.

## Branch D — `feat/send-reply`
**JTBD:** approved creative → real email + open tracked; reply → AI-drafted follow-up.
- **ACTION:** `lib/mail.ts` (nodemailer), `lib/reply.ts` (`draftReply`), `app/pixel/[id]/route.ts`, `convex/sends.ts` (`send`, `markOpened`), `convex/replies.ts` (`record`, `setDraft`).
- **IMPLEMENT:** `sendCreative` via Gmail app password; inline the artifact + copy; embed `<img src=APP_BASE_URL/pixel/{sendId}>`. Pixel route → `sends.markOpened`. IMAP poll (imapflow) matches inbound sender → `replies.record` → `draftReply` (OpenAI, uses original reasoning+copy as context) → `replies.setDraft`. **Plus a "paste-a-reply" box/action** that triggers the same path (fallback when IMAP is flaky).
- **GOTCHA:** low volume (20–40), plain text + one image, warmed Gmail. `"use node";` for nodemailer/imapflow actions. The paste-a-reply path MUST work so the loop always demos.
- **VALIDATE:** send a seeded approved creative to your own inbox → arrives; open pixel logs; paste a reply → a contextual draft appears.
- **Ships alone:** ✅. **Acceptance:** real send + open + reply→draft.

## Branch H — `feat/signal-spine` (cheap, high-narrative)
**JTBD:** show "the 52 triggers we watch" + job-change as the hero trigger.
- **ACTION:** `convex/tracker.ts` (`listRules` action calling Fiber `listAvailableTrackerRules`, cached), `components/TriggerPanel.tsx`.
- **IMPLEMENT:** panel lists the 52 rule types; a "replay" action runs the core loop on a company that genuinely just had the event. Use `fireTrackerDummy`/`previewTrackerSignal` for the signal→action path.
- **GOTCHA:** honesty — replay real recent signals + dummy-fire; never claim a live webhook fired.
- **VALIDATE:** 52 rules render; one job-change replay → a reasoned card.
- **Ships alone:** ✅ (panel standalone; replay needs A+B for full effect).

---

## Merge = Gate 2 (Sun 1am)
Merge A+B+C+D(+H) → `main`. Real lead → reasoned card → approve → send → reply draft. **Tag `main` as `wave-1-core-done`.** This is a complete demo on its own; Wave 2 amplifies it.

## Wave-level Validation
```bash
pnpm typecheck                  # all branches green
pnpm smoke:fiber "<company>"    # A
pnpm smoke:brain                # B (mock lead) → sharp card
pnpm dev                        # C: pipeline renders + approve
# D: send seed creative to self → open + paste-reply → draft
```

## Risks
| Risk | Mitigation |
|---|---|
| B reasoning generic → reads as image tool | B is critical-path; fix prompt at Gate 1 before scaling. |
| Fiber key late | B builds on mocked `EnrichedLead`; A swaps in real when key lands. |
| B & C collide on `creatives` | already split into `_write`/`_read`. |
| Send deliverability | warmed Gmail, low volume; replies are loop-fuel not headline. |
