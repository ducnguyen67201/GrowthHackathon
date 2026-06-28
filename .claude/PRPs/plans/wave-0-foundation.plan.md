# Plan: Cutthrough — WAVE 0: Foundation & Contracts (TypeScript end-to-end)

> **Agent scope:** ONE agent, runs FIRST and ALONE. Blocks every other wave.
> **Branch:** `main` (trunk). **Outcome:** a clean strict-TS monorepo skeleton + every shared contract (schema, types, lib interfaces, seed) so Wave 1/2 agents never conflict.
> **Self-contained:** this doc is the single source of truth for the TS setup + contracts. Read `sales-cyborg-cutthrough.plan.md` (product/why) and `TIMELINE.md` (gates) for context only.

## Job To Be Done
Stand up the app and **freeze every integration contract** — TS config, Convex schema, shared types, `lib` interfaces (typed stubs), and seed data — so the four Wave-1 agents and three Wave-2 agents fill in *disjoint* files against a stable contract.

## Expected Behavior (acceptance)
- `pnpm dev` serves an empty shell; `pnpm exec convex dev` pushes schema clean.
- `pnpm typecheck` (= `tsc --noEmit`) is green.
- `pnpm exec convex run seed:run` inserts 3–5 fake creatives visible in the Convex dashboard.
- Every `lib/*` function exists with a typed signature and `throw new Error("not impl: <name>")`.
- **No business logic implemented** — only scaffold + contracts + stubs + seed.

---

## TypeScript End-to-End Setup (the "clean" part)

### Tooling decisions (locked)
| Concern | Choice | Why |
|---|---|---|
| Package manager | **pnpm** | fast, strict node_modules; matches house hooks |
| App | **Next.js 15 (App Router, TS)** + React 19 | sponsor-free, RT-friendly |
| Backend | **Convex** (TS-native, realtime) | zero polling, file storage, types inferred from schema |
| Validation | **Zod** at external boundaries; **Convex `v` validators** for persistence | one validator → one inferred type, no drift |
| LLM | **openai** SDK + `zodResponseFormat` (structured outputs) | typed agent I/O, no brittle JSON parsing |
| Image | **satori** (HTML→SVG) + **@resvg/resvg-js** (SVG→PNG) | crisp text/logos, runs in Node |
| Video | **remotion** + **@remotion/renderer** + **@remotion/bundler** | programmatic MP4 render |
| Mail | **nodemailer** + **imapflow** | send + reply poll |
| Lint/format | **eslint** (next) + **prettier** | house style |

### Commands
```bash
git init
pnpm create next-app@latest . --ts --app --eslint --src-dir=false --import-alias "@/*" --no-tailwind
pnpm add convex zod openai satori @resvg/resvg-js nodemailer imapflow
pnpm add -D @types/nodemailer prettier remotion @remotion/cli @remotion/renderer @remotion/bundler
pnpm dlx convex dev   # creates convex/ + CONVEX_DEPLOYMENT
```
> ponytail: Tailwind is OPTIONAL — plain CSS modules + `styles/tokens.css` is enough; don't block on it. Add `--tailwind` only if the polish agent (Wave 2 / `chore`) wants it.

### `tsconfig.json` — strict (CREATE/MERGE)
```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "skipLibCheck": true,
    "paths": { "@/*": ["./*"] }
  }
}
```

### `package.json` scripts (ADD)
```jsonc
{
  "scripts": {
    "dev": "next dev",
    "convex": "convex dev",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "format": "prettier --write .",
    "smoke:fiber": "tsx scripts/smoke-fiber.ts",
    "smoke:brain": "tsx scripts/smoke-brain.ts",
    "coverage": "tsx scripts/coverage.ts"
  }
}
```
Add `tsx` as a dev dep for running TS scripts: `pnpm add -D tsx`.

### Type-flow rules (every agent follows)
1. **Persistence types** come from Convex: `import { Doc, Id } from "./_generated/dataModel"` → `Doc<"creatives">`.
2. **Domain/boundary types** come from Zod in `lib/schemas.ts` → `z.infer<typeof EnrichedLead>`. External data (Fiber, OpenAI) is **parsed with Zod at the boundary** (house rule: never trust external data).
3. **Reusable Convex validators** live in `convex/validators.ts`, used in BOTH schema and function args — infer with `Infer<typeof reasoningV>`.
4. No `any`. No `as` casts except at a Zod-validated boundary. Errors thrown as `Error` with context; never swallowed.

---

## CONTRACTS (the frozen interface — Wave 1/2 import these, never redefine)

### `convex/schema.ts` (CREATE — full schema, never edited downstream)
```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { reasoningV, socialPostV, sourceV, copyVariantV } from "./validators";

export default defineSchema({
  companies: defineTable({
    fiberId: v.string(), name: v.string(), domain: v.optional(v.string()),
    firmoSignals: v.any(), signalSource: v.optional(v.string()),
    logoUrl: v.optional(v.string()), screenshotUrl: v.optional(v.string()),
    enrichedAt: v.number(), raw: v.optional(v.any()),
  }).index("by_fiberId", ["fiberId"]),

  people: defineTable({
    companyId: v.id("companies"), fiberId: v.string(), name: v.string(),
    title: v.optional(v.string()), email: v.optional(v.string()),
    linkedin: v.optional(v.string()), socialPosts: v.array(socialPostV),
    enrichedAt: v.number(), raw: v.optional(v.any()),
  }).index("by_company", ["companyId"]),

  creatives: defineTable({
    companyId: v.id("companies"), personId: v.id("people"),
    reasoning: reasoningV, anchorFact: v.string(), sources: v.array(sourceV),
    artifactStorageId: v.optional(v.id("_storage")), artifactType: v.union(v.literal("image"), v.literal("video")),
    copyVariants: v.array(copyVariantV), chosenCopyIndex: v.optional(v.number()),
    status: v.union(v.literal("draft"), v.literal("approved"), v.literal("sent"), v.literal("failed")),
    runId: v.optional(v.id("runs")), createdAt: v.number(),
  }).index("by_status", ["status"]).index("by_company", ["companyId"]),

  sends: defineTable({
    creativeId: v.id("creatives"), to: v.string(), subject: v.string(),
    messageId: v.optional(v.string()), channel: v.string(),
    sentAt: v.number(), openedAt: v.optional(v.number()), repliedAt: v.optional(v.number()),
  }).index("by_creative", ["creativeId"]),

  replies: defineTable({
    sendId: v.id("sends"), inboundText: v.string(), receivedAt: v.number(),
    draftReply: v.optional(v.string()), intent: v.optional(v.string()),
    suggestedAction: v.optional(v.string()),
    draftStatus: v.union(v.literal("drafted"), v.literal("approved"), v.literal("sent")),
  }).index("by_send", ["sendId"]),

  runs: defineTable({
    type: v.union(v.literal("live"), v.literal("batch")), status: v.string(),
    total: v.number(), done: v.number(), failed: v.number(),
    costCredits: v.optional(v.number()), startedAt: v.number(),
  }),

  log: defineTable({
    runId: v.optional(v.id("runs")), companyId: v.optional(v.id("companies")),
    level: v.string(), message: v.string(), ts: v.number(),
  }),
});
```

### `convex/validators.ts` (CREATE)
```ts
import { v, Infer } from "convex/values";
export const socialPostV = v.object({ platform: v.string(), text: v.string(), url: v.string(), postedAt: v.optional(v.string()) });
export const sourceV = v.object({ field: v.string(), value: v.string(), url: v.optional(v.string()) });
export const reasoningV = v.object({
  saw: v.string(), inferred: v.string(), pain: v.string(),
  angle: v.string(), whyThisAngle: v.string(), confidence: v.number(),
});
export const copyVariantV = v.object({ subject: v.string(), body: v.string() });
export type SocialPost = Infer<typeof socialPostV>;
export type Source = Infer<typeof sourceV>;
export type Reasoning = Infer<typeof reasoningV>;
export type CopyVariant = Infer<typeof copyVariantV>;
```

### `lib/schemas.ts` (CREATE — Zod boundary types)
```ts
import { z } from "zod";
export const SocialPost = z.object({ platform: z.string(), text: z.string(), url: z.string(), postedAt: z.string().optional() });
export const Source = z.object({ field: z.string(), value: z.string(), url: z.string().optional() });
export const EnrichedLead = z.object({
  fiberId: z.string(), name: z.string(), company: z.string(), domain: z.string().optional(),
  title: z.string().optional(), email: z.string().optional(), linkedin: z.string().optional(),
  firmoSignals: z.record(z.unknown()), socialPosts: z.array(SocialPost),
  logoUrl: z.string().optional(), screenshotUrl: z.string().optional(),
});
export const Reasoning = z.object({
  saw: z.string(), inferred: z.string(), pain: z.string(),
  angle: z.string(), whyThisAngle: z.string(), confidence: z.number().min(0).max(1),
});
export const ReasonResult = z.union([
  z.object({ skip: z.literal(true), why: z.string() }),
  z.object({ skip: z.literal(false), reasoning: Reasoning, anchorFact: z.string(), sources: z.array(Source) }),
]);
export const CopyVariant = z.object({ subject: z.string(), body: z.string() });
export type EnrichedLead = z.infer<typeof EnrichedLead>;
export type Reasoning = z.infer<typeof Reasoning>;
export type ReasonResult = z.infer<typeof ReasonResult>;
export type CopyVariant = z.infer<typeof CopyVariant>;
export type SocialPost = z.infer<typeof SocialPost>;
export type Source = z.infer<typeof Source>;
```

### `lib/fiber.ts` (CREATE — signatures + stubs; Wave-1 A implements, Wave-2 F adds batch bodies)
```ts
import type { EnrichedLead, SocialPost } from "@/lib/schemas";
export type CompanyHit = { fiberId: string; name: string; domain?: string };
export type PersonHit = { fiberId: string; name: string; title?: string };
const ni = (n: string): never => { throw new Error(`not impl: ${n}`); };
export async function searchCompanies(_q: string): Promise<CompanyHit[]> { return ni("searchCompanies"); }
export async function findContact(_companyFiberId: string): Promise<PersonHit> { return ni("findContact"); }
export async function enrich(_personFiberId: string): Promise<EnrichedLead> { return ni("enrich"); }
export async function socialLookup(_handleOrId: string): Promise<SocialPost[]> { return ni("socialLookup"); }
export async function revealEmail(_personFiberId: string): Promise<string> { return ni("revealEmail"); }
export async function getLogo(_domain: string): Promise<string | null> { return ni("getLogo"); }
export async function getScreenshot(_domain: string): Promise<string | null> { return ni("getScreenshot"); }
export async function getCredits(): Promise<number> { return ni("getCredits"); }
// Wave-2 F (batch) — stubbed here so A and F never edit the same function body:
export async function socialLookupBatch(_handles: string[]): Promise<Record<string, SocialPost[]>> { return ni("socialLookupBatch"); }
```

### `lib/agents.ts`, `lib/artifact.tsx`, `lib/mail.ts`, `lib/reply.ts`, `lib/video.ts` (CREATE — stubs)
```ts
// lib/agents.ts
import type { EnrichedLead, ReasonResult, CopyVariant, Reasoning } from "@/lib/schemas";
export async function reason(_lead: EnrichedLead): Promise<ReasonResult> { throw new Error("not impl: reason"); }
export async function writeCopy(_r: Reasoning, _lead: EnrichedLead): Promise<CopyVariant[]> { throw new Error("not impl: writeCopy"); }

// lib/artifact.tsx
import type { EnrichedLead, Reasoning } from "@/lib/schemas";
export async function renderArtifact(_in: { reasoning: Reasoning; lead: EnrichedLead; variant: number }): Promise<Buffer> { throw new Error("not impl: renderArtifact"); }

// lib/mail.ts
export async function sendCreative(_a: { to: string; subject: string; body: string; pngUrl?: string; pixelUrl: string }): Promise<{ messageId: string }> { throw new Error("not impl: sendCreative"); }

// lib/reply.ts
export async function draftReply(_inbound: string, _ctx: { reasoning: unknown; copy: string }): Promise<{ draftReply: string; intent: string; suggestedAction: string }> { throw new Error("not impl: draftReply"); }

// lib/video.ts
import type { EnrichedLead, Reasoning } from "@/lib/schemas";
export async function renderHeroVideo(_in: { reasoning: Reasoning; lead: EnrichedLead }): Promise<Buffer> { throw new Error("not impl: renderHeroVideo"); }
```

### Convex function files (CREATE empty, split by concern — prevents cross-branch collisions)
`convex/companies.ts` · `people.ts` · `creatives_write.ts` · `creatives_read.ts` · `sends.ts` · `replies.ts` · `tracker.ts` — each exports `// implemented in Wave 1/2` placeholder.

### `convex/seed.ts` (CREATE — real impl, so UI/send agents build against data)
- **ACTION:** an `internalMutation`/`mutation` `run` that inserts 1 company + 1 person + 3–5 `creatives` with realistic fake `reasoning`, `anchorFact`, `copyVariants`, `status: "draft"` (and one `"approved"` so the send agent has a target). No artifact image needed (placeholder).
- **VALIDATE:** `pnpm exec convex run seed:run` → rows appear in dashboard.

### `.env.example` (CREATE)
```
OPENAI_API_KEY=
FIBER_API_KEY=
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=
GMAIL_USER=
GMAIL_APP_PASSWORD=
APP_BASE_URL=http://localhost:3000
```

---

## Tasks (in order)
1. `git init`; scaffold Next.js + pnpm (commands above); apply strict `tsconfig`; add scripts + `tsx`.
2. `pnpm dlx convex dev`; create `convex/validators.ts` then `convex/schema.ts`; push.
3. Create `lib/schemas.ts` (Zod) + all `lib/*` stubs.
4. Create the split `convex/*.ts` placeholders + `convex/seed.ts` (real).
5. Create `.env.example`; minimal `app/page.tsx` shell + `app/ConvexClientProvider.tsx`.
6. **VALIDATE:** `pnpm typecheck` green; `convex dev` pushes; `convex run seed:run` inserts rows.

## GOTCHAs
- Convex actions that use Node libs (satori/resvg/remotion/nodemailer/imapflow) need the `"use node";` directive at the top of the file. Keep heavy logic in `lib/*` so it's callable from scripts + Next routes too.
- Satori needs a font buffer — drop `Inter-Regular.ttf` + `Inter-Bold.ttf` in `public/fonts/` now so Wave-1 B has them.
- `NEXT_PUBLIC_CONVEX_URL` is required client-side for the provider.
- Do NOT implement Fiber/agent/mail logic here — only stubs. That's the whole point of the contract.

## Validation Commands
```bash
pnpm typecheck                    # zero errors
pnpm exec convex dev              # schema pushes clean
pnpm exec convex run seed:run     # seed rows appear
pnpm dev                          # empty shell renders
```

## Handoff
When green, tag `main` as `wave-0-done`. Wave 1 (A/B/C/D/H) and Wave 2 (E/F/G) agents branch from here and **import the contracts above — never recreate them.**
