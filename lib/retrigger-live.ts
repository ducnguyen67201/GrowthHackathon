import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { extractObjection } from "@/lib/objections";
import {
  matchRetrigger,
  scoreRetrigger,
  buildRetriggerReasoning,
} from "@/lib/retrigger";
import { similarityToWon } from "@/lib/learning";
import { writeCopy } from "@/lib/agents";
import { renderArtifact } from "@/lib/artifact";
import {
  EnrichedLead,
  type ChangelogItem,
  type CopyVariant,
  type LostDeal,
  type Reasoning,
} from "@/lib/schemas";

// Reading-Minds re-aim — THE live beat. Name a deal you lost → watch the engine read
// why it died, check it against what you've shipped, score it, and write the re-open,
// streamed. Now at parity with scripts/retrigger.ts: it renders the card and persists a
// normal creative (a re-trigger IS a normal creative), so the same output flows into the
// Pipeline and the open-tracking loop. Mirrors lib/livegen.ts (cache + persist) so the
// demo replays instantly and survives an OpenAI flake mid-judging.

export type LiveRetriggerEvent =
  | { stage: "reading" }
  | { step: "objection"; text: string }
  | { stage: "matching" }
  | { step: "feature"; text: string }
  | { stage: "notripe"; objection: string }
  | { stage: "scoring" }
  | { step: "score"; value: number }
  | { stage: "writing" }
  | { stage: "rendering" }
  | {
      stage: "done";
      creativeId: string;
      reasoning: Reasoning;
      anchorFact: string;
      copy: CopyVariant[];
      score: number;
      feature: string;
      cached: boolean;
    }
  | { stage: "skip"; why: string }
  | { stage: "error"; message: string };

const CACHE_DIR = path.join(process.cwd(), ".livecache");
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ponytail: in-memory Map + flat-file cache, demo-scoped. No TTL/eviction; the
// creativeId points at Convex storage, so a cached run still needs Convex up (stable) but
// no OpenAI (the slow/flaky part). Warm the demo chips once before judging.
const mem = new Map<string, CachedRun>();
type CachedRun = {
  reasoning: Reasoning;
  anchorFact: string;
  copy: CopyVariant[];
  score: number;
  feature: string;
  creativeId: string;
};

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
  const jsonPath = path.join(CACHE_DIR, `rt-${key}.json`);
  if (!(await exists(jsonPath))) return null;
  const run = JSON.parse(await readFile(jsonPath, "utf8")) as CachedRun;
  mem.set(key, run);
  return run;
}

async function writeCache(key: string, run: CachedRun): Promise<void> {
  mem.set(key, run);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path.join(CACHE_DIR, `rt-${key}.json`), JSON.stringify(run));
}

function convex(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  return new ConvexHttpClient(url);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Persist lead + creative + rendered PNG → creativeId. Mirrors lib/livegen.ts persist();
// a live re-trigger is a normal creative so the whole downstream reuses unchanged.
async function persist(
  client: ConvexHttpClient,
  lead: EnrichedLead,
  reasoning: Reasoning,
  anchorFact: string,
  sources: { field: string; value: string }[],
  copy: CopyVariant[],
  png: Buffer,
): Promise<Id<"creatives">> {
  const companyId = (await client.mutation(api.companies.upsert, {
    fiberId: lead.fiberId,
    name: lead.company,
    domain: lead.domain,
    firmoSignals: lead.firmoSignals,
    logoUrl: lead.logoUrl,
    signalSource: "retrigger-live",
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
    reasoning,
    anchorFact,
    sources,
    copyVariants: copy,
  })) as Id<"creatives">;

  const uploadUrl = (await client.mutation(
    api.creatives_write.generateUploadUrl,
    {},
  )) as string;
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: { "content-type": "image/png" },
    body: new Uint8Array(png),
  });
  if (!up.ok) throw new Error(`artifact upload failed: ${up.status}`);
  const { storageId } = (await up.json()) as { storageId: Id<"_storage"> };
  await client.mutation(api.creatives_write.setArtifact, {
    creativeId,
    storageId,
  });
  return creativeId;
}

// Replay a cached run with small delays so it still feels live — no OpenAI calls.
async function* replay(run: CachedRun): AsyncGenerator<LiveRetriggerEvent> {
  yield { stage: "reading" };
  await delay(150);
  yield { step: "objection", text: run.reasoning.pain };
  yield { stage: "matching" };
  await delay(150);
  yield { step: "feature", text: run.feature };
  yield { stage: "scoring" };
  await delay(150);
  yield { step: "score", value: run.score };
  yield { stage: "writing" };
  await delay(120);
  yield {
    stage: "done",
    creativeId: run.creativeId,
    reasoning: run.reasoning,
    anchorFact: run.anchorFact,
    copy: run.copy,
    score: run.score,
    feature: run.feature,
    cached: true,
  };
}

export async function* runRetriggerLive(
  input: string,
): AsyncGenerator<LiveRetriggerEvent> {
  const key = slug(input);
  try {
    const cached = await readCache(key);
    if (cached) {
      console.info("[retrigger-live]", { input, cached: true });
      yield* replay(cached);
      return;
    }

    const client = convex();
    const [changelogRows, won] = await Promise.all([
      client.query(api.lostDeals.listChangelog, {}),
      client.query(api.lostDeals.listWon, {}),
    ]);
    const changelog: ChangelogItem[] = changelogRows.map((c) => ({
      feature: c.feature,
      description: c.description,
      shippedAt: c.shippedAt,
      solves: c.solves,
    }));
    const wonTexts = won.map((w) => w.objection);

    const account = input.split(/[—:–-]/)[0]?.trim() || "the prospect";
    // Aggregation: pull the retrieved deal + call transcript for this account (synced from the
    // source layer, or seeded). When present, the engine READS the real call — the objection,
    // its grounding quote, and the contact all come from the transcript instead of the typed
    // line. This is the "AI performs data aggregation" path; absent a match, it falls back to
    // reading the input string alone (still works for a typed-in deal).
    const dealRow = await client.query(api.lostDeals.byAccount, { account });
    const lostDeal: LostDeal = {
      id: "live",
      account,
      contact: dealRow?.contact ?? account,
      title: dealRow?.title ?? undefined,
      lostReason: dealRow?.lostReason ?? input,
      lostDate: dealRow?.lostDate ?? today(),
      transcript: dealRow?.transcript ?? undefined,
    };

    yield { stage: "reading" };
    const objRes = await extractObjection(lostDeal);
    if (objRes.skip) {
      yield { stage: "skip", why: objRes.why };
      return;
    }
    const objection = objRes.objection;
    yield { step: "objection", text: objection.objection };

    yield { stage: "matching" };
    const match = await matchRetrigger(objection, changelog);
    if (!match.matched) {
      yield { stage: "notripe", objection: objection.objection };
      return;
    }
    yield { step: "feature", text: match.feature };

    yield { stage: "scoring" };
    const simToWon = wonTexts.length
      ? await similarityToWon(objection.objection, wonTexts)
      : 0;
    const score = scoreRetrigger({
      solved: true,
      externalSignalStrength: 0,
      lostDate: lostDeal.lostDate,
      simToWon,
      now: Date.now(),
    });
    yield { step: "score", value: score.score };

    yield { stage: "writing" };
    const { reasoning, anchorFact } = buildRetriggerReasoning({
      deal: { account, contact: account, lostDate: lostDeal.lostDate },
      objection,
      match,
      score: score.score,
    });
    const lead = EnrichedLead.parse({
      fiberId: `live-${key}`,
      name: account,
      company: account,
      firmoSignals: {},
      socialPosts: [],
    });
    const copy = await writeCopy(reasoning, lead);

    yield { stage: "rendering" };
    const png = await renderArtifact({ reasoning, anchorFact, lead, variant: 0 });
    const sources = objection.quote
      ? [{ field: "lostReason", value: objection.quote }]
      : [];
    const creativeId = await persist(
      client,
      lead,
      reasoning,
      anchorFact,
      sources,
      copy,
      png,
    );

    await writeCache(key, {
      reasoning,
      anchorFact,
      copy,
      score: score.score,
      feature: match.feature,
      creativeId,
    });

    yield {
      stage: "done",
      creativeId,
      reasoning,
      anchorFact,
      copy,
      score: score.score,
      feature: match.feature,
      cached: false,
    };
  } catch (e) {
    yield {
      stage: "error",
      message: e instanceof Error ? e.message : "live re-trigger failed",
    };
  }
}
