# Plan: Cutthrough — WAVE 2: Amplifiers + Ship (3 parallel branches + final polish)

> **Agent scope:** up to 3 agents (E/F/G), ONE per branch, ALL branch off `main@wave-1-core-done`. Mutually parallel-safe. Then ONE final `chore/polish-demo` agent runs LAST (sequential, after feature freeze).
> **Prereq:** Wave 1 merged (core loop live: discover→reason→artifact→approve→send→reply).
> **Goal:** add the WOW (live-gen, overnight scale, video hero), then polish + open-source. Maps to TIMELINE Gates 4–6.
> Context: `sales-cyborg-cutthrough.plan.md` (why), `wave-0-foundation.plan.md` (contracts), `wave-1-core-loop.plan.md` (the loop these reuse), `TIMELINE.md` (gates/freeze).

## Contracts already in the repo (import, don't recreate)
All Wave-0 types/schema + Wave-1 implementations: `lib/fiber.ts` (incl. `socialLookupBatch` stub to implement in F), `lib/agents.ts` (`reason`/`writeCopy`), `lib/artifact.tsx` (`renderArtifact`), `lib/video.ts` (`renderHeroVideo` stub), the Convex functions, and the full core loop. **Reuse them; do not fork the loop.**

## TS rules (inherited)
Strict TS, Zod at boundaries, no `any`/casts, `"use node";` for Node-lib Convex actions. Errors thrown with context.

## Parallelization within the wave
| Branch | Files (disjoint) | Depends on |
|---|---|---|
| E `feat/live-gen` | `app/api/live/route.ts`, `app/live/page.tsx` (or a box in dashboard), `lib/livegen.ts` | A+B (loop) merged |
| F `feat/overnight-batch` | `scripts/coverage.ts`, `socialLookupBatch` body in `lib/fiber.ts`, `convex/runs.ts` | A+B merged |
| G `feat/video-hero` | `remotion/HeroVideo.tsx`, `lib/video.ts`, `convex/creatives_write.ts:makeVideo` action | B merged |
> Only F touches `lib/fiber.ts` (the `socialLookupBatch` body stubbed in Wave 0) — no collision with E/G. G adds one action to `creatives_write.ts`; if E/H also touch it, coordinate or split (`creatives_video.ts`).

---

## Branch E — `feat/live-gen`  (Gate 4, Sun 8–10am) — the verifiable WOW
> **Status:** ✅ complete (branch `feat/live-gen`) → plan `.claude/PRPs/plans/completed/live-gen.plan.md`, report `.claude/PRPs/reports/live-gen-report.md`.
**JTBD:** judge types a company → reasoning **streams** on screen → finished card in ~90s.
- **ACTION:** `lib/livegen.ts` (orchestrate single-lead loop), `app/api/live/route.ts` (streaming SSE/`ReadableStream`), `app/live/page.tsx` (input + streamed reasoning + card).
- **IMPLEMENT:** fire `socialLookup` trigger FIRST, run `enrich` in parallel while it cooks; stream `saw→inferred→angle` tokens to the client as they're produced; render Satori artifact; write a `creatives` row (`runs.type:"live"`). **Pre-render + cache** likely inputs (judges'/sponsors'/famous cos) keyed by domain → instant.
- **GOTCHA:** keep a pre-rendered backup for every plausible name (API flake mid-demo is fatal). If social slow → degrade to firmo-only and say so. Reuse `lib/agents`/`lib/artifact` — don't duplicate the loop.
- **VALIDATE:** type a known company → reasoning streams → card <90s; a cached input is instant.
- **Ships alone:** ✅. **Acceptance:** live card <90s + cached backups exist.

## Branch F — `feat/overnight-batch`  (kick off Sun 1–2am, runs overnight) — the scale WOW
**JTBD:** 200–300 real ICP companies through the loop overnight → wake to a full reasoned pipeline.
- **ACTION:** implement `socialLookupBatch` in `lib/fiber.ts` (Fiber `social-media-lookup/batch/trigger`+`/batch/poll`); `scripts/coverage.ts`; `convex/runs.ts` (`start`/`tick`/`finish`).
- **IMPLEMENT:** `companyCount`→cap ≤300→`getCredits` check→batch social lookup for the cohort→enrich+`reason`+`renderArtifact` at concurrency 5, **cache by `companyId`**, retry once, **idempotent** (skip already-generated), checkpoint to `runs`, log `chargeInfo`+failures.
- **GOTCHA:** NEVER generate live in the demo. **Images only** at scale (video too slow). Don't launch a broken batch — if loop isn't solid by 2am, run a 50-co batch in the morning. Batch social is async — poll with backoff or the `social_media_lookup.completed` webhook.
- **VALIDATE:** `pnpm coverage --limit 50` dry-run within credits, resumes on crash; then the 300 run overnight.
- **Ships alone:** ✅ (a script). **Acceptance:** hundreds of reasoned cards by morning, cost within credits.

## Branch G — `feat/video-hero`  (Sun 12–2pm, GATED behind Gate 2) — the gasp
**JTBD:** one whale/judge company → personalized MP4 (logo + data animate in, AI voiceover names them).
- **ACTION:** `remotion/HeroVideo.tsx` (template), `lib/video.ts` (`renderHeroVideo` via `@remotion/bundler`+`@remotion/renderer`), a `creatives_write.ts:makeVideo` action (`artifactType:"video"`), OpenAI TTS for the voiceover track.
- **IMPLEMENT:** Remotion comp: real logo lands, `anchorFact` + post **animate in** (slide/typewriter), brand color; OpenAI `audio.speech.create` reads a 2-sentence script (name + exact situation) → audio track. *(Optional)* pre-rendered `gpt-image-1`/Sora 2 backdrop behind — specifics overlaid by Remotion ONLY.
- **GOTCHA:** specifics via Remotion overlay only (Sora/gpt-image can't render crisp logos/text). **Record a flawless backup MP4 in rehearsal.** Cut without guilt if behind at Gate 2. `"use node";`/script context for the renderer (heavy).
- **VALIDATE:** one company → polished MP4, logo/name/fact correct; backup recorded.
- **Ships alone:** ✅ (gated). **Acceptance:** one hero MP4 + backup (or consciously cut).

---

## Final — `chore/polish-demo`  (Gate 5 freeze → Gate 6 ship) — LAST, SEQUENTIAL
> Opens only AFTER feature freeze (Sun 2pm). Touches global styling → cannot run concurrently with E/F/G.
**JTBD:** look designed at 10ft; ship the repo; rehearse; record the backup demo.
- **ACTION:** `styles/tokens.css` + `global.css`, branding across `components/*`, projector legibility for the reasoning chain + pipeline + reply-inbox + live-gen views, `README.md`, `LICENSE` (MIT), a `DEMO.md` script.
- **GOTCHA:** NO new features — styling, copy, docs, rehearsal only. One strong type pairing; compositor-friendly motion only.
- **VALIDATE:** repo public; demo rehearsed ≥2×; clean backup demo recorded.
- **Acceptance (Gate 6):** public repo + README + backup video.

---

## Merge order (Wave 2)
F kicked off first (runs overnight) → E (Gate 4) → G (if ahead) → `chore/polish-demo` last. Each merge keeps `main` demoable (cut-ladder).

## Wave-level Validation
```bash
pnpm typecheck                      # all branches green
pnpm coverage --limit 50            # F dry-run
pnpm dev                            # E: live-gen <90s + cached
# G: render one HeroVideo; eyeball logo/name correctness; record backup
```

## Risks
| Risk | Mitigation |
|---|---|
| Live-gen API flake on stage | pre-rendered cached backups for every plausible name. |
| Broken batch wastes credits/night | `--limit 50` dry-run first; idempotent + checkpointed; defer to morning if loop weak. |
| Video eats time | gated behind Gate 2; cut without guilt; backup MP4 is the floor. |
| Polish started early → conflicts | opens only after Gate-5 freeze. |
| G & E/H collide on `creatives_write.ts` | split video into `creatives_video.ts` if concurrent. |
