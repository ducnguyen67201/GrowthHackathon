import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { discoverAndEnrich } from "@/lib/fiber";
import { reason, writeCopy } from "@/lib/agents";
import { renderArtifact } from "@/lib/artifact";
import type {
  EnrichedLead,
  Reasoning,
  CopyVariant,
  ReasonResult,
} from "@/lib/schemas";

type Reasoned = Extract<ReasonResult, { skip: false }>;

// Branch E (feat/live-gen). The orchestrator wave-1 never finished wiring: it
// runs discover → reason → writeCopy → renderArtifact → persist as ONE streaming
// call, reusing the existing pieces (never re-implementing the loop). Emits typed
// progress events so app/api/live can stream them. Cached/pre-warmed inputs replay
// instantly and survive an API flake mid-demo.

const STEP_KEYS = ["saw", "inferred", "pain", "angle", "whyThisAngle"] as const;

export type LiveEvent =
  | { stage: "discovering" }
  | { stage: "reasoning" }
  | { step: (typeof STEP_KEYS)[number]; text: string }
  | { stage: "rendering" }
  | {
      stage: "done";
      creativeId: string;
      artifactPath: string;
      reasoning: Reasoning;
      anchorFact: string;
      copy: CopyVariant[];
      cached: boolean;
    }
  | { stage: "skip"; why: string }
  | { stage: "notfound"; query: string }
  | { stage: "error"; message: string };

// Fiber "no data" outcomes (company/contact not found, enrich miss) are empty results,
// not system failures — surface them as a clean not-found, never a red error.
const NO_DATA_RE = /^(no company for|no contact found|enrich miss)/i;

type CachedRun = {
  lead: EnrichedLead;
  reasoning: Reasoning;
  anchorFact: string;
  copy: CopyVariant[];
  creativeId: string;
  pngPath: string;
};

const CACHE_DIR = path.join(process.cwd(), ".livecache");
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// slug a query into a stable cache key: lowercase, non-alnum runs → "-", trimmed.
function slug(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ponytail: in-memory Map + flat-file cache. No TTL/eviction — demo-scoped.
// Add LRU/TTL only if the cache outlives a demo.
const mem = new Map<string, CachedRun>();

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readCache(key: string): Promise<CachedRun | null> {
  const hot = mem.get(key);
  if (hot) return hot;
  const jsonPath = path.join(CACHE_DIR, `${key}.json`);
  if (!(await exists(jsonPath))) return null;
  const run = JSON.parse(await readFile(jsonPath, "utf8")) as CachedRun;
  if (!(await exists(run.pngPath))) return null; // png gone → treat as miss
  mem.set(key, run);
  return run;
}

async function writeCache(key: string, run: CachedRun): Promise<void> {
  mem.set(key, run);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(run));
}

function convex(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  return new ConvexHttpClient(url);
}

// Persist lead + creative + rendered PNG, returning the creativeId.
// Mirrors convex/ingest.ts (upsert sequence) + creatives_write.ts upload flow,
// driven from Node via ConvexHttpClient (same pattern as app/api/artifact route).
async function persist(
  client: ConvexHttpClient,
  lead: EnrichedLead,
  r: Reasoned,
  copy: CopyVariant[],
  png: Buffer,
): Promise<Id<"creatives">> {
  const companyId = (await client.mutation(api.companies.upsert, {
    fiberId: lead.fiberId,
    name: lead.company,
    domain: lead.domain,
    firmoSignals: lead.firmoSignals,
    logoUrl: lead.logoUrl,
    signalSource: "live",
  })) as Id<"companies">;
  const personId = (await client.mutation(api.people.upsert, {
    companyId,
    fiberId: lead.fiberId,
    name: lead.name,
    title: lead.title,
    email: lead.email,
    linkedin: lead.linkedin,
    socialPosts: lead.socialPosts,
  })) as Id<"people">;

  const creativeId = (await client.mutation(api.creatives_write.create, {
    companyId,
    personId,
    reasoning: r.reasoning,
    anchorFact: r.anchorFact,
    sources: r.sources,
    copyVariants: copy,
    // runId omitted on purpose — no convex/runs.ts (Branch F owns it).
  })) as Id<"creatives">;

  const uploadUrl = (await client.mutation(
    api.creatives_write.generateUploadUrl,
    {},
  )) as string;
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: { "content-type": "image/png" },
    body: new Uint8Array(png), // Buffer isn't a typed BodyInit; copy to a plain view
  });
  if (!up.ok) throw new Error(`artifact upload failed: ${up.status}`);
  const { storageId } = (await up.json()) as { storageId: Id<"_storage"> };
  await client.mutation(api.creatives_write.setArtifact, {
    creativeId,
    storageId,
  });
  return creativeId;
}

// Replay a cached run as if it were live (small delays keep the wow), no API calls.
async function* replay(run: CachedRun): AsyncGenerator<LiveEvent> {
  yield { stage: "reasoning" };
  for (const step of STEP_KEYS) {
    await delay(120);
    yield { step, text: run.reasoning[step] };
  }
  yield { stage: "rendering" };
  await delay(120);
  yield {
    stage: "done",
    creativeId: run.creativeId,
    artifactPath: run.pngPath,
    reasoning: run.reasoning,
    anchorFact: run.anchorFact,
    copy: run.copy,
    cached: true,
  };
}

export async function* runLive(query: string): AsyncGenerator<LiveEvent> {
  const key = slug(query);
  const started = Date.now();
  try {
    const cached = await readCache(key);
    if (cached) {
      console.info("[livegen]", { query, cached: true });
      yield* replay(cached);
      return;
    }

    yield { stage: "discovering" };
    const lead = await discoverAndEnrich(query);

    yield { stage: "reasoning" };
    const r = await reason(lead);
    if (r.skip) {
      // ponytail: don't fabricate a chain for a low-confidence lead — say so.
      // Demo on known-good companies; pre-warm fills the cache for those.
      yield { stage: "skip", why: r.why };
      return;
    }

    for (const step of STEP_KEYS) {
      yield { step, text: r.reasoning[step] };
    }

    const copy = await writeCopy(r.reasoning, lead);

    yield { stage: "rendering" };
    const png = await renderArtifact({
      reasoning: r.reasoning,
      anchorFact: r.anchorFact,
      lead,
      variant: 0,
    });

    const client = convex();
    const creativeId = await persist(client, lead, r, copy, png);

    const pngPath = path.join(CACHE_DIR, `${key}.png`);
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(pngPath, png);
    await writeCache(key, {
      lead,
      reasoning: r.reasoning,
      anchorFact: r.anchorFact,
      copy,
      creativeId,
      pngPath,
    });

    console.info("[livegen]", {
      query,
      cached: false,
      ms: Date.now() - started,
    });
    yield {
      stage: "done",
      creativeId,
      artifactPath: pngPath,
      reasoning: r.reasoning,
      anchorFact: r.anchorFact,
      copy,
      cached: false,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "live-gen failed";
    if (NO_DATA_RE.test(message)) {
      yield { stage: "notfound", query };
    } else {
      yield { stage: "error", message };
    }
  }
}

// Pre-run the loop for a known list so demo inputs are instant + flake-proof.
export async function prewarm(queries: string[]): Promise<void> {
  for (const q of queries) {
    try {
      for await (const ev of runLive(q)) {
        if ("stage" in ev && ev.stage === "error") throw new Error(ev.message);
      }
      console.info("[livegen] prewarmed", q);
    } catch (e) {
      console.error("[livegen] prewarm failed", q, e);
    }
  }
}
