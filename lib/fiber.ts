import { z } from "zod";
import { EnrichedLead, type SocialPost } from "./schemas"; // relative (not @/) so Convex can bundle this from the ingest action

// Fiber client (branch A). Pure fetch — no Convex. Shapes grounded in
// api.fiber.ai/ai-docs/<op>.md. Response Zod schemas are intentionally LENIENT
// (.passthrough() + optional) because we can't run the real API in this env —
// we extract the fields we know and tolerate the rest. Verify field mappings
// against a real response once FIBER_API_KEY is wired (see ponytail notes).

const BASE = "https://api.fiber.ai";

function key(): string {
  const k = process.env.FIBER_API_KEY;
  if (!k) throw new Error("FIBER_API_KEY not set");
  return k;
}

const chargeV = z.object({ method: z.string().optional(), creditsCharged: z.number().optional() }).passthrough();

async function post<T>(path: string, body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key() },
    body: JSON.stringify({ apiKey: key(), ...body }), // Fiber accepts apiKey in body OR x-api-key header — send both
  });
  if (!res.ok) throw new Error(`fiber ${path} ${res.status}: ${await res.text()}`);
  const json: unknown = await res.json();
  if (json && typeof json === "object") {
    const charge = (json as Record<string, unknown>).chargeInfo ?? (json as { output?: Record<string, unknown> }).output?.chargeInfo;
    if (charge) console.info("[fiber charge]", path, charge);
  }
  return schema.parse(json);
}

// ---------- response schemas (lenient) ----------
const companyRow = z
  .object({
    name: z.string().optional(),
    linkedin_primary_slug: z.string().optional(),
    li_org_id: z.union([z.string(), z.number()]).optional(),
    linkedin_id: z.union([z.string(), z.number()]).optional(),
    domains: z.array(z.string()).optional(),
    latest_funding_consensus: z.unknown().optional(),
    employee_count_consensus: z.unknown().optional(),
    li_job_posts_stats: z.unknown().optional(),
    instagram_handle: z.string().optional(),
    github_handle: z.string().optional(),
  })
  .passthrough();
const companySearchResp = z.object({ output: z.object({ data: z.array(companyRow) }).passthrough(), chargeInfo: chargeV.optional() }).passthrough();

const personRow = z
  .object({
    primary_slug: z.string().optional(),
    user_id: z.string().optional(),
    name: z.string().optional(),
    headline: z.string().optional(),
    url: z.string().optional(),
  })
  .passthrough();
const peopleSearchResp = z.object({ output: z.object({ data: z.array(personRow) }).passthrough(), chargeInfo: chargeV.optional() }).passthrough();

const enrichResp = z
  .object({
    output: z
      .object({
        found: z.boolean().optional(),
        profile: z
          .object({
            name: z.string().optional(),
            headline: z.string().optional(),
            current_job: z.object({ title: z.string().optional(), company_name: z.string().optional() }).passthrough().optional(),
            url: z.string().optional(),
            primary_slug: z.string().optional(),
            user_id: z.string().optional(),
            inferred_location: z.unknown().optional(),
          })
          .passthrough()
          .optional(),
        message: z.string().optional(),
      })
      .passthrough(),
    chargeInfo: chargeV.optional(),
  })
  .passthrough();

const socialTriggerResp = z.object({ output: z.object({ socialMediaFinderRunId: z.string() }).passthrough() }).passthrough();
const socialCandidate = z
  .object({ platform: z.string().optional(), handle: z.string().optional(), profileUrl: z.string().optional(), displayName: z.string().optional(), bio: z.string().optional() })
  .passthrough();
const socialPollResp = z
  .object({
    output: z
      .object({
        status: z.string().optional(),
        data: z.array(z.object({ candidates: z.array(socialCandidate).optional() }).passthrough()).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const revealResp = z
  .object({
    output: z
      .object({
        profile: z
          .object({
            emails: z.array(z.object({ email: z.string(), type: z.string().optional(), status: z.string().optional() })).optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
    chargeInfo: chargeV.optional(),
  })
  .passthrough();

const creditsResp = z.object({ output: z.object({ available: z.number() }).passthrough() }).passthrough();

// ---------- public API ----------
export type CompanyHit = { fiberId: string; name: string; domain?: string; instagramHandle?: string };
export type PersonHit = { fiberId: string; name: string; title?: string; linkedinUrl?: string };

export async function searchCompanies(q: string): Promise<CompanyHit[]> {
  // ponytail: keyword filter is the confident path; swap to textToCompanySearch for NL once shape verified.
  const resp = await post("/v1/company-search", { searchParams: { keywords: q } }, companySearchResp);
  return resp.output.data.map((c) => {
    const fiberId = c.linkedin_primary_slug ?? String(c.li_org_id ?? c.linkedin_id ?? "");
    const domain = c.domains?.[0];
    return { fiberId, name: c.name ?? domain ?? fiberId, domain, instagramHandle: c.instagram_handle };
  });
}

export async function findContact(companyFiberIdOrName: string): Promise<PersonHit> {
  // ponytail: filtering "people at company X" — refine searchParams company filter against a real response.
  const resp = await post(
    "/v1/people-search",
    { searchParams: { keywords: companyFiberIdOrName, jobTitleV2: { term: "growth OR sales OR founder OR marketing" } } },
    peopleSearchResp,
  );
  const p = resp.output.data[0];
  if (!p) throw new Error(`no contact found for ${companyFiberIdOrName}`);
  return { fiberId: p.primary_slug ?? p.user_id ?? "", name: p.name ?? "", title: p.headline, linkedinUrl: p.url ?? p.primary_slug };
}

export async function enrich(identifier: string): Promise<{ title?: string; company?: string; linkedin?: string; firmoSignals: Record<string, unknown> }> {
  const resp = await post("/v1/linkedin-live-fetch/profile/single", { identifier, getDetailedWorkExperience: true }, enrichResp);
  const prof = resp.output.profile;
  if (resp.output.found === false || !prof) throw new Error(`enrich miss: ${resp.output.message ?? identifier}`);
  return {
    title: prof.current_job?.title ?? prof.headline,
    company: prof.current_job?.company_name,
    linkedin: prof.url ?? prof.primary_slug,
    firmoSignals: { headline: prof.headline, currentJob: prof.current_job, location: prof.inferred_location },
  };
}

export async function socialLookup(handleOrUrl: string): Promise<SocialPost[]> {
  // Trigger → poll. NOTE: this returns the person's social PROFILES (handle/bio), not post text.
  // ponytail: to get real recent POSTS, follow up with the X/IG tweet-fetch endpoint using the handle
  //           (needs the key to verify shape). For now we surface the profile+bio as a degraded signal.
  const trig = await post("/v1/social-media-lookup/trigger", { person: { linkedinUrl: handleOrUrl }, platforms: ["TWITTER", "INSTAGRAM"] }, socialTriggerResp);
  const runId = trig.output.socialMediaFinderRunId;
  const deadline = 8000;
  const start = performance.now();
  while (performance.now() - start < deadline) {
    const poll = await post("/v1/social-media-lookup/polling", { socialMediaFinderRunId: runId, pageSize: 10 }, socialPollResp);
    const status = poll.output.status;
    if (status === "completed") {
      const candidates = poll.output.data?.flatMap((d) => d.candidates ?? []) ?? [];
      return candidates
        .filter((c) => c.bio || c.profileUrl)
        .map((c) => ({ platform: c.platform ?? "social", text: c.bio ?? c.displayName ?? "", url: c.profileUrl ?? "", postedAt: undefined }));
    }
    if (status === "failed") break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  return []; // degrade gracefully — the brain proceeds firmo-only
}

export async function revealEmail(linkedinUrl: string): Promise<string | undefined> {
  const resp = await post("/v1/contact-details/single", { linkedinUrl, enrichmentType: { getWorkEmails: true, getPersonalEmails: false, getPhoneNumbers: false } }, revealResp);
  const emails = resp.output.profile?.emails ?? [];
  return (emails.find((e) => e.type === "work" && e.status === "valid") ?? emails[0])?.email;
}

export async function getLogo(domain: string): Promise<string | null> {
  // ponytail: free, reliable real logo without a Fiber logos call. Swap to Fiber /logos for hi-res if needed.
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
}

export async function getScreenshot(_domain: string): Promise<string | null> {
  return null; // ponytail: wire Fiber webpage-screenshot endpoint if the artifact wants a site backdrop.
}

export async function getCredits(): Promise<number> {
  const res = await fetch(`${BASE}/v1/get-org-credits?apiKey=${encodeURIComponent(key())}`, { headers: { "x-api-key": key() } });
  if (!res.ok) throw new Error(`fiber get-org-credits ${res.status}`);
  return creditsResp.parse(await res.json()).output.available;
}

// Orchestrator: ICP/company string → a full EnrichedLead. Fires the slow async social
// lookup first and runs enrich in parallel while it cooks.
export async function discoverAndEnrich(query: string): Promise<EnrichedLead> {
  const companies = await searchCompanies(query);
  const company = companies[0];
  if (!company) throw new Error(`no company for "${query}"`);
  const person = await findContact(company.fiberId || company.name);

  const idForEnrich = person.linkedinUrl ?? person.fiberId;
  const [enriched, socialPosts, logoUrl] = await Promise.all([
    enrich(idForEnrich),
    person.linkedinUrl ? socialLookup(person.linkedinUrl) : Promise.resolve<SocialPost[]>([]),
    company.domain ? getLogo(company.domain) : Promise.resolve(null),
  ]);
  const email = person.linkedinUrl ? await revealEmail(person.linkedinUrl) : undefined;

  return EnrichedLead.parse({
    fiberId: person.fiberId || company.fiberId,
    name: person.name,
    company: enriched.company ?? company.name,
    domain: company.domain,
    title: person.title ?? enriched.title,
    email,
    linkedin: enriched.linkedin ?? person.linkedinUrl,
    firmoSignals: enriched.firmoSignals,
    socialPosts,
    logoUrl: logoUrl ?? undefined,
  });
}

// Wave 2 / branch F owns this — keep stubbed.
export async function socialLookupBatch(_handles: string[]): Promise<Record<string, SocialPost[]>> {
  throw new Error("not impl: socialLookupBatch — implement in branch feat/overnight-batch");
}
