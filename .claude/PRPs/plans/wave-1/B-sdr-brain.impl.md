# Impl: Branch B — `feat/sdr-brain` ⚠️ THE PRODUCT (Gate 1)

> **Agent:** one (your best). **Base:** `main@wave-0-done`. **Parallel-safe with** A/C/D/H.
> **JTBD:** `EnrichedLead` → a sharp, non-obvious reasoning chain + a crisp Satori artifact + copy → a `creatives` row.
> **THE RULE:** if the reasoning reads generic ("congrats on the raise"), STOP and fix the prompt before anything else. Nothing downstream matters until the judgment is sharp. This branch is the whole pitch.
> **Prereq:** `OPENAI_API_KEY` in `.env.local`; `public/fonts/Inter-Regular.ttf` + `Inter-Bold.ttf` present; `npx convex dev` running.

## Files
| File | Action |
|---|---|
| `lib/agents.ts` | IMPLEMENT `reason`, `writeCopy` (OpenAI structured outputs) |
| `lib/artifact.tsx` | IMPLEMENT `renderArtifact` (Satori → PNG) |
| `convex/creatives_write.ts` | `create` mutation + `generateForLead` action |
| `scripts/smoke-brain.ts` | mock `EnrichedLead` → reason → render → write PNG + print chain |

## Contract (from Wave 0)
- `import { EnrichedLead, Reasoning, ReasonResult, CopyVariant, Source } from "@/lib/schemas"`.
- `lib/agents.ts` / `lib/artifact.tsx` signatures exist — implement bodies, keep signatures.
- Model: use the **strongest reasoning model that supports structured outputs** (`gpt-4o` / `gpt-4.1`). The brain quality IS the product — do not cheap out. Put the id in a constant `const BRAIN_MODEL = "gpt-4o"`.

## ⚠️ Structured-output gotcha (read first)
OpenAI strict structured outputs require the **root to be an object** and **every key present** (optionals must be **nullable**, not omitted). So do NOT pass the `ReasonResult` discriminated union as the response schema. Define a flat output schema, then map to `ReasonResult`:
```ts
import { z } from "zod";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

const ReasonOutput = z.object({
  skip: z.boolean(),
  why: z.string().nullable(),                 // reason for skipping, else null
  saw: z.string().nullable(),
  inferred: z.string().nullable(),
  pain: z.string().nullable(),
  angle: z.string().nullable(),
  whyThisAngle: z.string().nullable(),
  confidence: z.number(),                      // 0..1
  anchorFact: z.string().nullable(),
  sources: z.array(z.object({ field: z.string(), value: z.string(), url: z.string().nullable() })),
});
```

## `lib/agents.ts` — `reason()`
```ts
const openai = new OpenAI();

export async function reason(lead: EnrichedLead): Promise<ReasonResult> {
  const completion = await openai.beta.chat.completions.parse({
    model: BRAIN_MODEL,
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(leadForPrompt(lead)) },
    ],
    response_format: zodResponseFormat(ReasonOutput, "reason"),
  });
  const out = completion.choices[0]?.message.parsed;
  if (!out) throw new Error("brain: no parsed output");
  if (out.skip || out.confidence < 0.5 || !out.saw || !out.angle) {
    return { skip: true, why: out.why ?? "low confidence / no specific signal" };
  }
  return {
    skip: false,
    reasoning: { saw: out.saw, inferred: out.inferred!, pain: out.pain!, angle: out.angle, whyThisAngle: out.whyThisAngle!, confidence: out.confidence },
    anchorFact: out.anchorFact ?? out.saw,
    sources: out.sources.map(s => ({ field: s.field, value: s.value, url: s.url ?? undefined })),
  };
}
```
`leadForPrompt(lead)` = a compact JSON of ONLY the real fields: name, title, company, firmoSignals, and the socialPosts (text + url). This is what the model is allowed to cite.

### SYSTEM_PROMPT (the crux — tune this in H0/at Gate 1)
```
You are the best SDR on earth. You read ONE prospect and decide the single sharpest
way to open — the way a senior rep who did 20 minutes of homework would.

You are given ONLY real, fetched facts about a person (their title, company,
firmographic signals like funding/hiring, and their ACTUAL recent social posts).

Produce a reasoning chain:
- saw:        the ONE most specific, recent, TRUE fact you'll anchor on. Prefer
              something they personally said/posted over a generic firmographic.
- inferred:   what that implies about their situation RIGHT NOW.
- pain:       the concrete pain that creates, that our product (cut-through outbound)
              relieves.
- angle:      the opening angle — specific, warm, never a roast.
- whyThisAngle: explicitly contrast with the OBVIOUS angle (e.g. "congrats on the
              raise") and say why yours beats it. If your angle IS the obvious one,
              you haven't tried hard enough.
- confidence: 0..1. Low if the only signal is generic firmographics.
- anchorFact: one quotable sentence a human would recognize as "they really know me."
- sources:    every claim mapped to a field name or a post url. NO invented facts.

Hard rules: Only use provided facts. If there is no specific, recent, true hook,
set skip=true with why. Public professional info only. Warm, specific, human — never
creepy, never a roast.
```

## `lib/agents.ts` — `writeCopy()`
```ts
const Copy = z.object({ variants: z.array(z.object({ subject: z.string(), body: z.string() })).length(2) });
export async function writeCopy(r: Reasoning, lead: EnrichedLead): Promise<CopyVariant[]> {
  const c = await openai.beta.chat.completions.parse({
    model: BRAIN_MODEL, temperature: 0.7,
    messages: [
      { role: "system", content: "Write 2 cold-email variants. 2 short lines + a soft ask. Open on the angle, not a greeting. Warm, specific, no fluff, no 'I hope this finds you well'." },
      { role: "user", content: JSON.stringify({ reasoning: r, name: lead.name, company: lead.company }) },
    ],
    response_format: zodResponseFormat(Copy, "copy"),
  });
  return c.choices[0]?.message.parsed?.variants ?? [];
}
```

## `lib/artifact.tsx` — `renderArtifact()` (Satori → PNG)
```ts
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFile } from "node:fs/promises";

async function fonts() {
  const [reg, bold] = await Promise.all([
    readFile("public/fonts/Inter-Regular.ttf"),
    readFile("public/fonts/Inter-Bold.ttf"),
  ]);
  return [
    { name: "Inter", data: reg, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
  ];
}

async function logoDataUri(url?: string): Promise<string | null> {
  if (!url) return null;
  const r = await fetch(url); if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const mime = r.headers.get("content-type") ?? "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function renderArtifact({ reasoning, lead, variant }: { reasoning: Reasoning; lead: EnrichedLead; variant: number }): Promise<Buffer> {
  const logo = await logoDataUri(lead.logoUrl);
  // DESIGNED template — real logo + real text. NEVER let a model draw these.
  const el = (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%",
                  background: variant === 0 ? "#13161c" : "#0f1a17", color: "#f3f5f4",
                  padding: 64, fontFamily: "Inter", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {logo ? <img src={logo} width={56} height={56} style={{ borderRadius: 12 }} /> : null}
        <span style={{ fontSize: 30, fontWeight: 700 }}>{lead.company}</span>
      </div>
      <div style={{ display: "flex", fontSize: 52, fontWeight: 700, lineHeight: 1.1 }}>
        {reasoning.angle}
      </div>
      <div style={{ display: "flex", fontSize: 24, color: "#22c08a" }}>
        {lead.name} · {lead.title ?? ""}
      </div>
    </div>
  );
  const svg = await satori(el, { width: 1200, height: 630, fonts: await fonts() });
  return Buffer.from(new Resvg(svg).render().asPng());
}
```
> Satori needs `display: flex` on every div with children. `<img src>` must be a data URI (fetch the real logo → base64). `gpt-image-1` is OPTIONAL backdrop only — not in scope for Gate 1.

## `convex/creatives_write.ts`
```ts
"use node"; // satori + resvg are Node libs
import { action, mutation, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { reasoningV, sourceV, copyVariantV } from "./validators";

export const create = mutation({
  args: { companyId: v.id("companies"), personId: v.id("people"), reasoning: reasoningV,
          anchorFact: v.string(), sources: v.array(sourceV), copyVariants: v.array(copyVariantV),
          artifactStorageId: v.optional(v.id("_storage")) },
  handler: async (ctx, a) => ctx.db.insert("creatives", { ...a, artifactType: "image", status: "draft", createdAt: Date.now() }),
});

// Ties reason→writeCopy→renderArtifact→store→create. Used by live-gen (E) + batch (F).
export const generateForLead = action({
  args: { companyId: v.id("companies"), personId: v.id("people"), lead: v.any() },
  handler: async (ctx, { companyId, personId, lead }) => {
    const r = await reason(lead);
    if (r.skip) { /* log + return null */ return null; }
    const [copy, png] = await Promise.all([writeCopy(r.reasoning, lead), renderArtifact({ reasoning: r.reasoning, lead, variant: 0 })]);
    const storageId = await ctx.storage.store(new Blob([png], { type: "image/png" }));
    return ctx.runMutation(api.creatives_write.create, { companyId, personId, reasoning: r.reasoning, anchorFact: r.anchorFact, sources: r.sources, copyVariants: copy, artifactStorageId: storageId });
  },
});
```
> `"use node"` is required because satori/resvg are Node libs. `ctx.storage.store(Blob)` returns a storage id; the dashboard reads its URL via `ctx.storage.getUrl(id)` (branch C).

## `scripts/smoke-brain.ts` (standalone — no Convex, no Fiber)
```ts
const mockLead: EnrichedLead = EnrichedLead.parse({
  fiberId: "mock", name: "Jordan Lee", company: "Acme Devtools", domain: "acme.dev",
  title: "Head of Growth", firmoSignals: { funding: "Series A $14M", hiring: ["SDR x5"] },
  socialPosts: [{ platform: "x", text: "Hiring 5 SDRs. Outbound is broken — every tool sends the same gray email.", url: "https://x.com/j/1", postedAt: "2026-06-24" }],
  logoUrl: undefined,
});
const r = await reason(mockLead);
console.log(JSON.stringify(r, null, 2));
if (r.skip) throw new Error("brain skipped the mock lead — prompt too strict");
const png = await renderArtifact({ reasoning: r.reasoning, lead: mockLead, variant: 0 });
await writeFile("out/smoke.png", png);
console.log("wrote out/smoke.png — EYEBALL IT: logo/text crisp? angle non-obvious?");
```

## GOTCHAs
- Structured output: root object, nullable (not optional) fields, all keys present. Map to `ReasonResult` after.
- Satori: `display:flex` everywhere, fonts loaded, logo as data URI. resvg returns PNG bytes.
- `"use node"` on the convex action file that imports satori/resvg.
- **Gate 1:** run `reason` on 5 real (or hand-mocked) companies. If the angle is the obvious one or cites no specific post, tune SYSTEM_PROMPT. Don't proceed to scale until 5/5 are sharp.

## VALIDATE / Acceptance
- `pnpm smoke:brain` → a non-skip chain whose `whyThisAngle` contrasts the obvious angle + `out/smoke.png` with crisp logo/text.
- `npx convex run creatives_write:generateForLead` (with seed ids + lead) → a `creatives` row with an `artifactStorageId`.
- 5/5 real companies produce sharp, traceable reasoning (Gate 1).
