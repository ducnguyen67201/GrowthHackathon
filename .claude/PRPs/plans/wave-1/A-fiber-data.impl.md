# Impl: Branch A — `feat/fiber-data` (the signal layer)

> **Agent:** one. **Base:** `main@wave-0-done`. **Parallel-safe with** B/C/D/H (disjoint files).
> **JTBD:** turn an ICP sentence / company name into an enriched lead (incl. real recent posts) and persist it to Convex.
> **Prereq:** `FIBER_API_KEY` in `.env.local`; `npx convex dev` running. Import contracts from Wave 0 — never redefine types/schema.

## Files
| File | Action |
|---|---|
| `lib/fiber.ts` | IMPLEMENT the stubs (pure fetch; no Convex) |
| `convex/companies.ts` | `upsert` mutation + `getByFiberId` query |
| `convex/people.ts` | `upsert` mutation |
| `convex/ingest.ts` | NEW — `ingestLead` action (fiber → upsert), ties it together |
| `scripts/smoke-fiber.ts` | IMPLEMENT the smoke test |

## Contract (from Wave 0 — import, don't redefine)
- `import { EnrichedLead, SocialPost } from "@/lib/schemas"` (Zod + inferred types).
- `lib/fiber.ts` signatures already exist (searchCompanies/findContact/enrich/socialLookup/revealEmail/getLogo/getScreenshot/getCredits/socialLookupBatch). Implement bodies; **leave `socialLookupBatch` as the stub** (branch F owns it).
- Convex: `Doc`, `Id` from `convex/_generated/dataModel`; `mutation`, `query`, `action` from `convex/_generated/server`.

## Fiber facts (already captured — don't re-research)
- Base `https://api.fiber.ai`. Auth header `x-api-key: $FIBER_API_KEY` (MCP v2 equivalent). Every charge returns `chargeInfo`. Free: `companyCount`, `peopleSearchCount`, `get-org-credits`.
- Sequence: `textToCompanySearch` (or `companySearch`) → `peopleSearch` → `profileLiveEnrich` (+`KitchenSinkProfile` for 44+ fields) → **`social-media-lookup/trigger` then poll `/polling`** (async, X/IG) → `syncQuickContactReveal` (work email) → logos/screenshot.
- Read exact request/response JSON from `api.fiber.ai/llms.txt` + the OpenAPI at `api.fiber.ai/docs`. **Parse every response with Zod at the boundary** — never trust the shape.

## `lib/fiber.ts` — implementation sketch
```ts
const BASE = "https://api.fiber.ai";
const KEY = () => {
  const k = process.env.FIBER_API_KEY;
  if (!k) throw new Error("FIBER_API_KEY not set");
  return k;
};

async function fiber<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "x-api-key": KEY(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`fiber ${path} ${res.status}: ${await res.text()}`);
  const json: unknown = await res.json();
  // chargeInfo is on the envelope — log it before parsing the payload
  if (json && typeof json === "object" && "chargeInfo" in json) {
    console.info("[fiber charge]", path, (json as Record<string, unknown>).chargeInfo);
  }
  return schema.parse(json); // Zod boundary — throws on shape drift
}
```
- `searchCompanies(q)`: POST `/v1/textToCompanySearch` → map hits to `CompanyHit[]`.
- `findContact(companyFiberId)`: POST `/v1/peopleSearch` (filter by company + seniority) → first `PersonHit`.
- `enrich(personFiberId)`: POST `/v1/profileLiveEnrich` (+ KitchenSink) → firmo + linkedin fields.
- `socialLookup(handleOrId)`: POST `/v1/social-media-lookup/trigger` → poll `/v1/social-media-lookup/polling` until done or **timeout ~8s** → map to `SocialPost[]`; on timeout return `[]` (degrade, don't throw).
- `revealEmail(personFiberId)`: POST `/v1/syncQuickContactReveal` → email string.
- `getLogo(domain)` / `getScreenshot(domain)`: Fiber logos/screenshot endpoints → url (or null).
- `getCredits()`: GET `/v1/get-org-credits?apiKey=…` → number.
- Compose a top-level `discoverAndEnrich(query): Promise<EnrichedLead>` that runs the sequence, fires `socialLookup` FIRST and `enrich` in parallel (social is the slow async one), assembles + `EnrichedLead.parse(...)`.

## Convex
```ts
// convex/companies.ts
export const getByFiberId = query({ args: { fiberId: v.string() }, handler: async (ctx, a) =>
  ctx.db.query("companies").withIndex("by_fiberId", q => q.eq("fiberId", a.fiberId)).unique() });
export const upsert = mutation({ args: { /* company fields */ }, handler: async (ctx, a) => {
  const existing = await ctx.db.query("companies").withIndex("by_fiberId", q => q.eq("fiberId", a.fiberId)).unique();
  if (existing) { await ctx.db.patch(existing._id, { ...a, enrichedAt: Date.now() }); return existing._id; }
  return ctx.db.insert("companies", { ...a, enrichedAt: Date.now() });
}});
// convex/people.ts — upsert mirroring, with socialPosts: v.array(socialPostV)
// convex/ingest.ts
export const ingestLead = action({ args: { query: v.string() }, handler: async (ctx, a) => {
  const lead = await discoverAndEnrich(a.query);          // lib/fiber (fetch ok in actions)
  const companyId = await ctx.runMutation(api.companies.upsert, { fiberId: lead.fiberId, name: lead.company, domain: lead.domain, firmoSignals: lead.firmoSignals, logoUrl: lead.logoUrl, screenshotUrl: lead.screenshotUrl, signalSource: "live" });
  await ctx.runMutation(api.people.upsert, { companyId, fiberId: lead.fiberId, name: lead.name, title: lead.title, email: lead.email, linkedin: lead.linkedin, socialPosts: lead.socialPosts });
  return { companyId, lead };
}});
```
> `import { api } from "./_generated/api"`. `fetch` works in normal Convex actions — no `"use node"` needed for fiber.

## smoke-fiber.ts
```ts
// pnpm smoke:fiber "Vercel"
const company = process.argv[2];
const lead = await discoverAndEnrich(company);
console.log(JSON.stringify(lead, null, 2));
if (!lead.email) console.warn("no email revealed");
if (lead.socialPosts.length === 0) console.warn("no social posts (timeout or none)");
```

## GOTCHAs
- Social lookup is **async** (trigger→poll). Fire it first, enrich in parallel, poll with a hard timeout, degrade to `[]`.
- Call free `getCredits()`/`companyCount` before paid searches; **concurrency cap 5** anywhere you loop.
- Zod-parse EVERY response. Fiber field names will differ from our `EnrichedLead` — map explicitly.
- Don't implement `socialLookupBatch` (branch F).

## VALIDATE / Acceptance
- `pnpm smoke:fiber "<a real company>"` → a real `EnrichedLead` with `email` + ≥1 `socialPost` + a `[fiber charge]` log.
- `npx convex run ingest:ingestLead '{"query":"Series A devtools hiring SDRs"}'` → `companies`+`people` rows in the dashboard.
- `pnpm typecheck` green (app/lib/scripts); `convex dev` reports no errors.
