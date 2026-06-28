import assert from "node:assert/strict";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  searchCompanies,
  findContact,
  enrich,
  socialLookup,
  revealEmail,
  getLogo,
  getCredits,
} from "@/lib/fiber";
import { reason, writeCopy } from "@/lib/agents";
import { renderArtifact } from "@/lib/artifact";
import { EnrichedLead } from "@/lib/schemas";

// Branch F (feat/overnight-batch). Runs 50–300 real ICP companies through the existing
// reason→artifact pipeline overnight, persisting draft `creatives` to Convex.
// Usage: pnpm coverage [--limit N] [--query "…"] [--dry] [--selfcheck]
// Idempotent (skips companies that already have a creative), retry-once, concurrency 5,
// checkpointed to a `runs` row, credit-guarded. NEVER run live in the demo.

const MAX_COHORT = 300;
const CONCURRENCY = 5;
// ponytail: rough per-lead credit ceiling for the pre-spend guard — tune once a real
// run shows actual cost. Conservative on purpose so we abort rather than overspend.
const EST_CREDITS_PER_LEAD = 50;
const DEFAULT_QUERY = "seed-stage devtools startups";

// ---------- pure helpers (stdlib only — no p-limit) ----------
// ponytail: index-cursor worker pool, ~15 lines, beats pulling a dependency.
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Math.min(concurrency, items.length);
  const run = async (): Promise<void> => {
    while (cursor < items.length) {
      const i = cursor++;
      const item = items[i];
      if (item === undefined) continue; // noUncheckedIndexedAccess: i<length guarantees presence
      results[i] = await fn(item, i);
    }
  };
  await Promise.all(Array.from({ length: workers }, run));
  return results;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function cap(n: number, max = MAX_COHORT): number {
  return Math.max(0, Math.min(n, max));
}

type Args = { limit: number; query: string; dry: boolean; selfcheck: boolean };
function parseArgs(argv: string[]): Args {
  const out: Args = {
    limit: MAX_COHORT,
    query: DEFAULT_QUERY,
    dry: false,
    selfcheck: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit") out.limit = cap(Number(argv[++i]));
    else if (a === "--query") out.query = argv[++i] ?? out.query;
    else if (a === "--dry") out.dry = true;
    else if (a === "--selfcheck") out.selfcheck = true;
  }
  return out;
}

// ---------- selfcheck (no network, no keys) ----------
async function runSelfcheck(): Promise<void> {
  // mapPool: never exceeds the concurrency cap, preserves input order.
  let inFlight = 0;
  let maxInFlight = 0;
  const ordered = await mapPool(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    3,
    async (x) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return x * 2;
    },
  );
  assert.ok(maxInFlight <= 3, `mapPool exceeded concurrency: ${maxInFlight}`);
  assert.deepEqual(
    ordered,
    [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    "mapPool lost order",
  );
  assert.deepEqual(
    await mapPool<number, number>([], 5, async (x) => x),
    [],
    "mapPool empty",
  );

  // withRetry: succeeds on the 2nd attempt, rethrows after exhausting.
  let tries = 0;
  const v = await withRetry(async () => {
    if (++tries < 2) throw new Error("flake");
    return "ok";
  });
  assert.equal(v, "ok");
  assert.equal(tries, 2);
  await assert.rejects(
    withRetry(async () => {
      throw new Error("always");
    }, 2),
  );

  // cap
  assert.equal(cap(500), 300);
  assert.equal(cap(50), 50);
  assert.equal(cap(0), 0);

  console.log("✓ coverage selfcheck passed");
}

// ---------- per-company pipeline ----------
type Outcome =
  | { status: "ok"; name: string; creativeId: Id<"creatives"> }
  | { status: "skip-exists"; name: string }
  | { status: "skip-conf"; name: string; why: string }
  | { status: "fail"; name: string; error: string };

async function uploadArtifact(
  client: ConvexHttpClient,
  creativeId: Id<"creatives">,
  png: Buffer,
): Promise<void> {
  const uploadUrl: string = await client.mutation(
    api.creatives_write.generateUploadUrl,
    {},
  );
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "content-type": "image/png" },
    body: new Uint8Array(png),
  });
  if (!res.ok)
    throw new Error(`artifact upload ${res.status}: ${await res.text()}`);
  const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
  await client.mutation(api.creatives_write.setArtifact, {
    creativeId,
    storageId,
  });
}

async function processCompany(
  client: ConvexHttpClient,
  runId: Id<"runs">,
  hit: { fiberId: string; name: string; domain?: string },
): Promise<Outcome> {
  // Cheap idempotency check first — skip before spending enrich credits.
  // ponytail: dedup by the company's own fiberId (stable within this script's runs).
  const existing = await client.query(api.companies.getByFiberId, {
    fiberId: hit.fiberId,
  });
  if (
    existing &&
    (await client.query(api.runs.hasCreativeForCompany, {
      companyId: existing._id,
    }))
  ) {
    return { status: "skip-exists", name: hit.name };
  }

  // Discovery — composes fiber primitives (mirrors discoverAndEnrich, on a known company).
  const person = await findContact(hit.fiberId || hit.name);
  const idForEnrich = person.linkedinUrl ?? person.fiberId;
  const [enriched, social, logoUrl] = await Promise.all([
    enrich(idForEnrich),
    // ponytail: per-company social is the verified path; socialLookupBatch is the
    //           documented scale optimization — switch to a batch-warm pass if 300×
    //           trigger/poll proves too slow or rate-limited.
    person.linkedinUrl ? socialLookup(person.linkedinUrl) : Promise.resolve([]),
    hit.domain ? getLogo(hit.domain) : Promise.resolve(null),
  ]);
  const email = person.linkedinUrl
    ? await revealEmail(person.linkedinUrl)
    : undefined;

  const lead = EnrichedLead.parse({
    fiberId: hit.fiberId,
    name: person.name,
    company: enriched.company ?? hit.name,
    domain: hit.domain,
    title: person.title ?? enriched.title,
    email,
    linkedin: enriched.linkedin ?? person.linkedinUrl,
    firmoSignals: enriched.firmoSignals,
    socialPosts: social,
    logoUrl: logoUrl ?? undefined,
  });

  const companyId: Id<"companies"> = await client.mutation(
    api.companies.upsert,
    {
      fiberId: lead.fiberId,
      name: lead.company,
      domain: lead.domain,
      firmoSignals: lead.firmoSignals,
      logoUrl: lead.logoUrl,
      signalSource: "batch",
    },
  );
  const personId: Id<"people"> = await client.mutation(api.people.upsert, {
    companyId,
    fiberId: lead.fiberId,
    name: lead.name,
    title: lead.title,
    email: lead.email,
    linkedin: lead.linkedin,
    socialPosts: lead.socialPosts,
  });

  const r = await reason(lead);
  if (r.skip) return { status: "skip-conf", name: lead.company, why: r.why };

  const copy = await writeCopy(r.reasoning, lead);
  const creativeId: Id<"creatives"> = await client.mutation(
    api.creatives_write.create,
    {
      companyId,
      personId,
      reasoning: r.reasoning,
      anchorFact: r.anchorFact,
      sources: r.sources,
      copyVariants: copy,
      runId,
    },
  );

  const png = await renderArtifact({
    reasoning: r.reasoning,
    anchorFact: r.anchorFact,
    lead,
    variant: 0,
  });
  await uploadArtifact(client, creativeId, png);

  return { status: "ok", name: lead.company, creativeId };
}

// ---------- main ----------
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfcheck) return runSelfcheck();

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  if (!process.env.FIBER_API_KEY) throw new Error("FIBER_API_KEY not set");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  const client = new ConvexHttpClient(convexUrl);

  const hits = await searchCompanies(args.query);
  const cohort = hits.slice(0, cap(args.limit));
  console.log(
    `[coverage] cohort: ${cohort.length} companies (from ${hits.length} hits, query "${args.query}")`,
  );
  if (cohort.length === 0) {
    console.log("[coverage] nothing to do.");
    return;
  }

  const creditsBefore = await getCredits();
  const est = cohort.length * EST_CREDITS_PER_LEAD;
  console.log(
    `[coverage] credits: ${creditsBefore} available, est ≤ ${est} needed`,
  );
  if (creditsBefore < est && !args.dry) {
    throw new Error(
      `insufficient credits: have ${creditsBefore}, estimate up to ${est}. Lower --limit or top up.`,
    );
  }

  const runId: Id<"runs"> = await client.mutation(api.runs.start, {
    total: cohort.length,
  });
  console.log(`[coverage] run ${runId} started${args.dry ? " (dry)" : ""}`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  await mapPool(cohort, CONCURRENCY, async (hit, i) => {
    let outcome: Outcome;
    try {
      outcome = await withRetry(() => processCompany(client, runId, hit), 2);
    } catch (e) {
      outcome = {
        status: "fail",
        name: hit.name,
        error: e instanceof Error ? e.message : String(e),
      };
    }
    const n = `${i + 1}/${cohort.length}`;
    if (outcome.status === "ok") {
      ok++;
      await client.mutation(api.runs.tick, { runId, ok: true });
      console.log(`[coverage] ${n}  ✓ ${outcome.name} (${outcome.creativeId})`);
    } else if (outcome.status === "skip-exists") {
      ok++; // already done counts as covered
      await client.mutation(api.runs.tick, { runId, ok: true });
      console.log(`[coverage] ${n}  ⤳ skip-exists ${outcome.name}`);
    } else if (outcome.status === "skip-conf") {
      skipped++;
      await client.mutation(api.runs.tick, { runId, ok: true });
      console.log(`[coverage] ${n}  ⤳ skip ${outcome.name} (${outcome.why})`);
    } else {
      failed++;
      await client.mutation(api.runs.tick, { runId, ok: false });
      await client.mutation(api.runs.logLine, {
        runId,
        level: "error",
        message: `${outcome.name}: ${outcome.error}`,
      });
      console.log(`[coverage] ${n}  ✗ fail ${outcome.name} (${outcome.error})`);
    }
  });

  const creditsAfter = await getCredits();
  const spent = creditsBefore - creditsAfter;
  await client.mutation(api.runs.finish, { runId, costCredits: spent });
  console.log(
    `[coverage] done: ${ok} drafts/covered, ${skipped} low-confidence skips, ${failed} failed — ${spent} credits spent`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
