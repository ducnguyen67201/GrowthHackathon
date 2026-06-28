# Plan: Branch G — `feat/video-hero` (the gasp)

## Summary
Implement `lib/video.ts:renderHeroVideo` with Remotion (`@remotion/bundler` + `@remotion/renderer`) + OpenAI TTS, a `remotion/HeroVideo.tsx` composition where the real logo lands and `anchorFact`/post animate in, and the wiring to attach the rendered MP4 to an existing `creatives` row (`artifactType:"video"`). One whale/judge company → one personalized MP4 with an AI voiceover that names them. This is Tier-2 / gated — ship one good video + a recorded backup, or cut.

## User Story
As a demo presenter, I want one personalized hero MP4 (real logo + animated anchor fact + AI voiceover naming the company), so that a judge/whale sees a gasp-worthy, verifiably-correct artifact the loop produced.

## Problem → Solution
The loop produces static PNG cards (`lib/artifact.tsx`). → For one hand-picked, already-reasoned creative, render a short animated MP4 from the SAME real lead data, with a TTS voiceover, and attach it to the creative.

## Metadata
- **Complexity**: Medium (3–10 files, new heavy dep, mirrors existing render+upload flow)
- **Source PRD**: `.claude/PRPs/plans/wave-2-amplifiers.plan.md` (Branch G)
- **PRD Phase**: Wave 2 / Branch G `feat/video-hero`
- **Estimated Files**: 6 (`lib/video.ts` rewrite, `remotion/HeroVideo.tsx`, `remotion/Root.tsx`, `scripts/make-video.ts`, `convex/creatives_video.ts`, `package.json`)

---

## UX Design

### Before
```
Dashboard card → static PNG (logo + anchorFact + quote), artifactType:"image"
```

### After
```
pnpm video <creativeId>  →  .artifacts/hero-<company>.mp4
  ┌──────────────────────────────────────────┐
  │ [logo lands]  Acme · Jane Doe, VP Eng     │  ← real logo (or monogram)
  │                                            │
  │   "<anchorFact animates in, line by line>" │  ← brand-color accent
  │                                            │
  │   🔊 "Jane at Acme — <anchorFact>.         │  ← OpenAI TTS voiceover
  │       Worth a look?"                        │
  └──────────────────────────────────────────┘
creative.artifactStorageId set, artifactType:"video"
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Artifact render | `renderArtifact` → PNG | `renderHeroVideo` → MP4 (one chosen creative) | Static path untouched |
| `creatives.artifactType` | `"image"` | `"video"` for the rendered one | Schema already supports both |
| Dashboard playback | `<img src=/api/artifact/{id}>` | unchanged (still `<img>`) | **Out of scope** — video playback in the grid is polish, not G |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `lib/video.ts` | 1-13 | The stub you replace; signature + contract comment |
| P0 | `lib/artifact.tsx` | 42-111, 267-295 | Mirror EXACTLY: `brandColor`, logo/monogram fallback, `firstPostQuote`, `TemplateInput`, render-from-real-data discipline |
| P0 | `lib/schemas.ts` | 19-40, 55-60 | `EnrichedLead`, `Reasoning` shapes you feed the renderer |
| P0 | `convex/creatives_write.ts` | 9-66 | Upload flow to mirror: `generateUploadUrl` (reuse), `setArtifact` (clone → video), `artifactUrl` |
| P0 | `convex/schema.ts` | 32-52 | `creatives` table; `artifactType` union already has `"video"` |
| P1 | `lib/agents.ts` | 16-27 | OpenAI client singleton + env-key pattern to mirror for TTS |
| P1 | `scripts/smoke-brain.ts` | 100-151 | Script shape: build lead → render → write file → size assert → `main().catch(exit 1)` |
| P1 | `convex/creatives_read.ts` | 17-39 | How company+person+reasoning join into a card (mirror for `getForVideo`) |
| P2 | `app/api/artifact/[id]/route.ts` | 1-28 | `ConvexHttpClient` from a non-Convex context |
| P2 | `convex/sendEmail.ts` | 1-41 | `"use node"` action + `ctx.runQuery/runMutation` orchestration style |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Remotion SSR render | remotion.dev/docs/ssr | `bundle()` (entry) → `selectComposition()` → `renderMedia({serveUrl, composition, codec:"h264", outputLocation, inputProps})`. Call `ensureBrowser()` once first. |
| Remotion `<Img>`/`<Audio>` | remotion.dev/docs/img, /audio | Unlike Satori, Remotion renders in real headless Chromium → **remote image URLs work**. `<Audio src={dataUri}>` accepts base64 data URIs. |
| Remotion animation | remotion.dev/docs/interpolate, /spring | `interpolate(frame,[a,b],[0,1])` + `useCurrentFrame()` for slide/typewriter; `spring()` for the logo land. |
| OpenAI TTS | platform.openai.com/docs/guides/text-to-speech | `client.audio.speech.create({model, voice, input})` → `Buffer.from(await res.arrayBuffer())`. mp3 default. |

```
KEY_INSIGHT: Remotion runs in headless Chromium, so remote logo URLs fetch fine (no data-URI inlining needed, unlike Satori in artifact.tsx).
APPLIES_TO: remotion/HeroVideo.tsx logo rendering.
GOTCHA: still keep a monogram fallback — onError on <Img> or branch on logoUrl presence.

KEY_INSIGHT: @remotion/renderer needs a Chromium headless shell. First run downloads it (~slow). It CANNOT run inside Convex's serverless Node runtime.
APPLIES_TO: where the render executes — a tsx script, NOT a Convex action.
GOTCHA: call `await ensureBrowser()` before bundling; first invocation downloads the shell.

KEY_INSIGHT: composition duration is fixed at definition time. Voiceover length is variable.
GOTCHA: cap script to 2 sentences and fix duration to ~8s (240f @30fps); long names/facts could clip audio. ponytail ceiling — measure audio + set durationInFrames dynamically only if it actually clips.
```

---

## Patterns to Mirror

### NAMING_CONVENTION
```ts
// SOURCE: lib/artifact.tsx:42-48 — deterministic brand color from name (REUSE, don't reinvent)
function brandColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 72%, 48%)`;
}
```

### OPENAI_CLIENT (mirror for TTS)
```ts
// SOURCE: lib/agents.ts:16-27
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-2024-08-06";
let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}
```

### CONVEX_UPLOAD (mirror for video attach)
```ts
// SOURCE: convex/creatives_write.ts:38-56 — generic upload-url + setter. Clone setter for video.
export const generateUploadUrl = mutation({ args: {}, handler: async (ctx) =>
  await ctx.storage.generateUploadUrl() });           // REUSE as-is

export const setArtifact = mutation({                 // CLONE → setVideoArtifact (type:"video")
  args: { creativeId: v.id("creatives"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.creativeId, {
      artifactStorageId: args.storageId, artifactType: "image" });
  },
});
```

### CONVEX_JOIN (mirror for getForVideo query)
```ts
// SOURCE: convex/creatives_read.ts:28-37 — join company+person, resolve storage url
rows.map(async (c) => ({
  ...c,
  company: await ctx.db.get(c.companyId),
  person: await ctx.db.get(c.personId),
}))
```

### SCRIPT_STRUCTURE
```ts
// SOURCE: scripts/smoke-brain.ts:126-151
const png = await renderArtifact({ reasoning, anchorFact, lead, variant });
await writeFile(file, png);
if (png.length < 1000) throw new Error(`artifact suspiciously small`);
main().catch((e) => { console.error(e); process.exit(1); });
```

### NODE_DIRECTIVE
```ts
// SOURCE: convex/sendEmail.ts:1 — Node-lib actions need this; mutations cannot live in a "use node" file
"use node";
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `package.json` | UPDATE | Add `remotion`, `@remotion/bundler`, `@remotion/renderer`; add `"video": "tsx scripts/make-video.ts"` script |
| `remotion/Root.tsx` | CREATE | `registerRoot` + `<Composition id="HeroVideo">` (Remotion entry point) |
| `remotion/HeroVideo.tsx` | CREATE | The animated composition: logo lands, anchorFact animates in, brand color, `<Audio>` voiceover, monogram fallback |
| `lib/video.ts` | UPDATE | Replace stub: TTS → bundle → selectComposition → renderMedia → return MP4 `Buffer` |
| `convex/creatives_video.ts` | CREATE | `getForVideo` query (join → EnrichedLead-shaped) + `setVideoArtifact` mutation (artifactType:"video"). Separate file per Wave-2 risk #5 (avoids `creatives_write.ts` collision). |
| `scripts/make-video.ts` | CREATE | `tsx` driver: take `creativeId` → query → `renderHeroVideo` → write `.artifacts/*.mp4` → upload via `generateUploadUrl` → `setVideoArtifact` |

## NOT Building
- Live in-demo video generation (too slow — F/E own scale/live; G is one pre-rendered MP4).
- Sora/gpt-image-1 backdrop (the plan's *optional* item) — specifics-via-Remotion-only is the floor; skip the backdrop unless time remains.
- Dashboard `<video>` playback in the grid (polish, not G — `<img>` stays).
- A Convex `makeVideo` **action** that renders inside Convex — **deliberate deviation**: Remotion needs headless Chromium and cannot run in Convex's serverless Node. Render in a script; Convex only stores the bytes + flips the type. (See Notes.)
- Dynamic audio-length → duration measurement (fixed 8s; upgrade only if it clips).

---

## Step-by-Step Tasks

### Task 1: Add Remotion deps + script
- **ACTION**: Edit `package.json`.
- **IMPLEMENT**: deps `"remotion": "^4.0.0"`, `"@remotion/bundler": "^4.0.0"`, `"@remotion/renderer": "^4.0.0"`. Scripts: `"video": "tsx scripts/make-video.ts"`. Then `pnpm install`.
- **MIRROR**: existing `dependencies` block + `smoke:*` script entries.
- **GOTCHA**: keep all three Remotion packages on the SAME version or the renderer errors. First render downloads a Chromium shell — expected.
- **VALIDATE**: `pnpm install` succeeds; `node -e "require('@remotion/renderer')"` resolves.

### Task 2: Remotion composition + Root
- **ACTION**: Create `remotion/Root.tsx` and `remotion/HeroVideo.tsx`.
- **IMPLEMENT**:
  - `Root.tsx`: `registerRoot(RemotionRoot)`; `<Composition id="HeroVideo" component={HeroVideo} durationInFrames={240} fps={30} width={1200} height={630} defaultProps={...} />`. `calculateMetadata` optional.
  - `HeroVideo.tsx`: props `{ company, name, title?, anchorFact, accent, logoUrl?, quote?, audioDataUri? }`. Use `useCurrentFrame`/`interpolate`/`spring` (from `remotion`) for: logo `spring()` scale-in (0–20f), header fade, anchorFact slide/typewriter (20–80f), accent bar. `<Img src={logoUrl}>` with monogram `<div>` fallback when `!logoUrl`. `{audioDataUri && <Audio src={audioDataUri} />}`.
- **MIRROR**: `lib/artifact.tsx` `TemplateInput`, `brandColor`, `logoBadge` monogram, `firstPostQuote`, 1200×630 canvas, Inter/`#0c0a09` dark palette, "Cutthrough" footer.
- **IMPORTS**: `import React from "react";`, `import { Composition, registerRoot } from "remotion";` (Root), `import { AbsoluteFill, Img, Audio, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";` (HeroVideo).
- **GOTCHA**: NEVER let the model draw text/logos — every string is a real prop (same discipline as artifact.tsx). Animate `transform`/`opacity` only (compositor-friendly). `interpolate` needs `extrapolateRight:"clamp"` to avoid overshoot.
- **VALIDATE**: `npx remotion studio remotion/Root.tsx` renders the comp with defaultProps (manual eyeball).

### Task 3: Implement `renderHeroVideo`
- **ACTION**: Replace `lib/video.ts` stub.
- **IMPLEMENT**: signature `renderHeroVideo({ reasoning, lead, anchorFact? }): Promise<Buffer>` (mirror `renderArtifact` accepting `anchorFact` explicitly; fall back to `reasoning.angle`).
  1. Build `script` (≤2 sentences): `` `${lead.name} at ${lead.company} — ${fact}. Worth a look?` `` .
  2. TTS: `client().audio.speech.create({ model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts", voice: "alloy", input: script })` → `Buffer` → `data:audio/mpeg;base64,...`.
  3. `await ensureBrowser()`; `const serveUrl = await bundle({ entryPoint: path.join(process.cwd(),"remotion/Root.tsx") })`.
  4. `inputProps = { company, name, title, anchorFact: fact, accent: brandColor(lead.company), logoUrl: lead.logoUrl, quote: firstPostQuote(lead), audioDataUri }`.
  5. `const composition = await selectComposition({ serveUrl, id:"HeroVideo", inputProps })`.
  6. render to a tmp path (`os.tmpdir()`), then `readFile` → return `Buffer`. (renderMedia needs `outputLocation`; there's no buffer mode.)
- **MIRROR**: `lib/agents.ts` OpenAI client singleton; `lib/artifact.tsx` `brandColor`/`firstPostQuote` (import or copy — they're not exported, so copy the two tiny fns or export them; prefer copy to keep artifact.tsx untouched per branch-disjoint rule).
- **IMPORTS**: `"use node"` NOT needed here (plain lib, run from script/tsx). `import { bundle } from "@remotion/bundler"; import { renderMedia, selectComposition, ensureBrowser } from "@remotion/renderer"; import OpenAI from "openai"; import { readFile } from "node:fs/promises"; import os, path`.
- **GOTCHA**: `codec: "h264"`, `outputLocation` required (render to tmp, read back, clean up). TTS reuses `OPENAI_API_KEY` — no new secret. Throw with context on any step (house rule).
- **VALIDATE**: unit-free; covered by Task 5 self-check (size assert).

### Task 4: Convex video read/write
- **ACTION**: Create `convex/creatives_video.ts`.
- **IMPLEMENT**:
  - `getForVideo = query({ args:{ creativeId }, handler })`: get creative; get company+person; return `{ reasoning, anchorFact, lead: <EnrichedLead-shaped> }` where lead maps `company.name→company`, `company.domain`, `company.logoUrl`, `company.firmoSignals→firmoSignals`, `person.name`, `person.title`, `person.socialPosts`, `person.fiberId→fiberId`. Throw if creative/company/person missing.
  - `setVideoArtifact = mutation({ args:{ creativeId, storageId }, handler })`: `ctx.db.patch(creativeId, { artifactStorageId: storageId, artifactType: "video" })`.
  - REUSE `creatives_write.generateUploadUrl` (no new upload-url fn).
- **MIRROR**: `creatives_read.ts` join; `creatives_write.ts:setArtifact` (clone with `"video"`).
- **IMPORTS**: `import { query, mutation } from "./_generated/server"; import { v } from "convex/values";`
- **GOTCHA**: plain Convex (no `"use node"`) — it's queries/mutations only. `firmoSignals` is `v.any()` → cast to `Record<string,unknown>` shape when assembling lead. Separate file deliberately (Wave-2 risk #5: avoid `creatives_write.ts` collision).
- **VALIDATE**: `npx convex dev` typechecks/codegens clean.

### Task 5: Driver script + self-check
- **ACTION**: Create `scripts/make-video.ts`.
- **IMPLEMENT**: read `creativeId` from `process.argv[2]` (throw clear usage error if missing). `ConvexHttpClient(NEXT_PUBLIC_CONVEX_URL)` → `getForVideo` → `renderHeroVideo(...)` → write `.artifacts/hero-<company>.mp4` → **assert `buf.length > 50_000`** (a real MP4 is far bigger; catches a black/empty render) → `generateUploadUrl` → `fetch(url,{method:"POST",headers:{"Content-Type":"video/mp4"},body:buf})` → `{ storageId }` → `setVideoArtifact`. `main().catch(e=>{console.error(e);process.exit(1)})`.
- **MIRROR**: `scripts/smoke-brain.ts` structure + size assert; `app/api/artifact/[id]/route.ts` `ConvexHttpClient` usage.
- **IMPORTS**: `import { ConvexHttpClient } from "convex/browser"; import { api } from "@/convex/_generated/api"; import { renderHeroVideo } from "@/lib/video"; import { writeFile, mkdir } from "node:fs/promises";`
- **GOTCHA**: this is the `// ponytail: render in script, not Convex action — Remotion needs headless Chromium` decision point. Convex upload-url POST is a plain `fetch` (mirror the documented flow in creatives_write.ts comment).
- **VALIDATE**: `pnpm video <realCreativeId>` → MP4 in `.artifacts/`, logo/name/anchorFact correct on eyeball, dashboard shows the creative as `artifactType:"video"`.

### Task 6: Record backup MP4
- **ACTION**: During rehearsal, run Task 5 on the chosen whale/judge company; keep the output as the demo backup.
- **IMPLEMENT**: copy `.artifacts/hero-<company>.mp4` to a safe spot referenced in `DEMO.md` (polish branch).
- **GOTCHA**: **The backup is the floor.** If behind at Gate 2, cut live render and play the backup. No guilt.
- **VALIDATE**: backup plays standalone, logo/name/fact correct.

---

## Testing Strategy

### Self-check (ponytail: one runnable check)
| Check | Input | Expected | Where |
|---|---|---|---|
| Render produces real MP4 | a reasoned `creativeId` | `buf.length > 50_000`, file written | `scripts/make-video.ts` assert |
| Type union flips | after upload | creative `artifactType:"video"`, `artifactStorageId` set | dashboard / Convex dashboard |

### Edge Cases Checklist
- [ ] `logoUrl` absent → monogram fallback (first letter, never invented)
- [ ] No social posts → `quote` null, layout still valid
- [ ] Missing `creativeId` arg → clear usage error
- [ ] TTS/`OPENAI_API_KEY` missing → throws with context (no silent black video)
- [ ] anchorFact long → does not overflow frame (clamp/scale); audio may clip (known ceiling)
- [ ] First run downloads Chromium → not an error, just slow

---

## Validation Commands

### Static Analysis
```bash
pnpm typecheck
```
EXPECT: zero type errors (note: `convex/` is checked by `convex dev`, excluded from this pass — run `npx convex dev` once for codegen + Convex typecheck).

### Render (manual, the real test)
```bash
pnpm video <creativeId>        # → .artifacts/hero-<company>.mp4
```
EXPECT: polished MP4; logo + name + anchorFact correct; voiceover names the company; creative flips to artifactType:"video".

### Composition preview (optional)
```bash
npx remotion studio remotion/Root.tsx
```
EXPECT: HeroVideo renders with defaultProps.

### Manual Validation
- [ ] One whale/judge company rendered end-to-end
- [ ] Logo/name/fact pixel-correct (no AI-drawn text)
- [ ] Voiceover audible, names the company + situation
- [ ] Backup MP4 recorded and plays standalone

---

## Acceptance Criteria
- [ ] `renderHeroVideo` produces a real MP4 from real lead data
- [ ] One hero MP4 rendered + attached (`artifactType:"video"`)
- [ ] Backup MP4 recorded (or branch consciously cut)
- [ ] `pnpm typecheck` green; `convex dev` clean
- [ ] No new dependency beyond the 3 Remotion packages; no new secret (reuses `OPENAI_API_KEY`)

## Completion Checklist
- [ ] Mirrors `brandColor`/monogram/`firstPostQuote` discipline from `lib/artifact.tsx`
- [ ] OpenAI client mirrors `lib/agents.ts` singleton + key guard
- [ ] Upload mirrors `creatives_write.ts` generateUploadUrl→POST→setter flow
- [ ] Errors thrown with context; no silent failures
- [ ] Files disjoint from E/F (`creatives_video.ts`, not `creatives_write.ts`)
- [ ] `ponytail:` comments on the script-not-action decision + fixed-duration ceiling
- [ ] Self-contained — no codebase search needed to implement

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Remotion can't run in Convex serverless | Certain | Would block "action" approach | Render in `scripts/make-video.ts`; Convex only stores + flips type (documented deviation) |
| API flake / render time eats the slot | Med | High | Gated behind Gate 2; **recorded backup MP4 is the floor**; cut without guilt |
| Voiceover clips on long fact | Low | Low | ≤2-sentence script; fixed 8s; measure+extend only if it clips (ceiling noted) |
| Collision on `creatives_write.ts` with E/H | Low | Med | Video write-side isolated in `creatives_video.ts` (Wave-2 risk #5) |
| First-run Chromium download surprises in rehearsal | Med | Med | Run once before the demo to warm the shell |

## Notes
**Deliberate deviation from the Wave-2 spec.** The plan lists "a `creatives_write.ts:makeVideo` action". Remotion's renderer requires a headless Chromium shell that cannot run in Convex's serverless Node runtime, so the heavy render lives in a tsx script (Node context, as the plan's own GOTCHA hints: `"use node";`/script context for the renderer). Convex's role shrinks to two thin functions in `creatives_video.ts` (`getForVideo`, `setVideoArtifact`) + the existing generic `generateUploadUrl`. Same outcome (`artifactType:"video"` attached to a creative), correct execution context.

`renderHeroVideo` keeps `lib/video.ts`'s Wave-0 contract intent but widens the input to accept `anchorFact` (exactly as `renderArtifact` does), because the voiceover/overlay needs the specific hook, not just `reasoning`.
```
