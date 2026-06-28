import assert from "node:assert/strict";
import { getDealSource, getTranscriptSource } from "@/lib/sources";
import {
  GeneratedDealSource,
  GeneratedTranscriptSource,
} from "@/lib/sources/generated";
import type { SourceDeal } from "@/lib/sources";

// Data-source layer smoke (Gate 1 for lib/sources). The generated provider is PURE and
// deterministic — assert it with NO keys, NO Convex. Locks the contract a real Salesforce/
// Gong adapter must also satisfy: stable output, clamped count, complete deal shape, a real
// multi-turn transcript dated before close, ripe AND not-ripe coverage, and net-new names so
// synced deals are visibly distinct from the seed. Registry: default → generated, unwired
// vendors fail loud with an actionable message.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Seed account prefixes — generated names MUST avoid these (synced ≠ seeded, visibly).
const SEED_PREFIXES =
  /^(Veritas|Lumen|Beacon|Cedarwood|Northstar|Civic|Harbor|Summit|Riverside|Meridian|Orchard|Granite|Pine Ridge|Coastal) /;

function assertDealShape(d: SourceDeal): void {
  assert.ok(d.externalId, "externalId present");
  assert.ok(d.account && d.contact && d.title, "account/contact/title present");
  assert.match(d.domain, /\.com$/, "domain looks like a domain");
  assert.ok(d.value > 0, "value is positive ACV");
  assert.ok(d.lostReason.length > 5, "lostReason is a real sentence");
  assert.match(d.lostDate, ISO, "lostDate is ISO yyyy-mm-dd");
  assert.ok(d.objection && d.category, "objection + category present");
}

async function testDeterministic(): Promise<void> {
  const a = await new GeneratedDealSource().listClosedLost({ count: 12 });
  const b = await new GeneratedDealSource().listClosedLost({ count: 12 });
  assert.deepEqual(a, b, "same seed → identical deals (replayable demo)");
  assert.equal(a.length, 12, "returns the requested count");
}

async function testCountClamp(): Promise<void> {
  const src = new GeneratedDealSource();
  assert.equal((await src.listClosedLost({ count: 0 })).length, 1, "count<1 clamps up to 1");
  assert.equal((await src.listClosedLost({ count: 500 })).length, 100, "count>100 clamps to 100");
  assert.ok((await src.listClosedLost()).length >= 1, "default count is non-empty");
}

async function testDealShape(): Promise<void> {
  const deals = await new GeneratedDealSource().listClosedLost({ count: 100 });
  for (const d of deals) assertDealShape(d);
  // unique external ids (a CRM opportunity id is unique per deal)
  const ids = new Set(deals.map((d) => d.externalId));
  assert.equal(ids.size, deals.length, "externalId is unique per deal");
}

async function testRipeAndNotRipeCoverage(): Promise<void> {
  const deals = await new GeneratedDealSource().listClosedLost({ count: 100 });
  const cats = new Set(deals.map((d) => d.category));
  assert.ok(cats.size >= 5, `expect varied objections, got ${cats.size}`);
  assert.ok(cats.has("soc2"), "a ripe category (soc2) must appear");
  // 'fhir' has no shipped fix in the changelog — the radar MUST be able to surface a dead one,
  // or the demo reads as everything-is-winnable theater.
  assert.ok(cats.has("fhir"), "a not-ripe category (fhir) must appear");
}

async function testDistinctFromSeed(): Promise<void> {
  const deals = await new GeneratedDealSource().listClosedLost({ count: 100 });
  for (const d of deals) {
    assert.ok(!SEED_PREFIXES.test(`${d.account} `), `synced name collides with seed: ${d.account}`);
  }
}

async function testTranscript(): Promise<void> {
  const txSrc = new GeneratedTranscriptSource();
  const [deal] = await new GeneratedDealSource().listClosedLost({ count: 1 });
  assert.ok(deal, "have a deal");
  const tx = await txSrc.getForDeal(deal!);
  assert.ok(tx, "transcript returned");
  const lines = tx!.transcript.split("\n").filter(Boolean);
  assert.ok(lines.length >= 3, "transcript is multi-turn");
  assert.ok(
    lines.some((l) => l.startsWith(`${deal!.contact}:`)),
    "the buyer speaks in their own name",
  );
  assert.ok(lines.some((l) => l.startsWith("Rep:")), "the rep speaks too");
  assert.match(tx!.transcriptDate, ISO, "transcriptDate is ISO");
  assert.ok(
    Date.parse(tx!.transcriptDate) < Date.parse(deal!.lostDate),
    "the call happened before the deal was marked lost",
  );
}

function testRegistryDefaults(): void {
  const prevD = process.env.DEAL_SOURCE;
  const prevT = process.env.TRANSCRIPT_SOURCE;
  delete process.env.DEAL_SOURCE;
  delete process.env.TRANSCRIPT_SOURCE;
  try {
    assert.ok(getDealSource() instanceof GeneratedDealSource, "default deal source = generated");
    assert.ok(
      getTranscriptSource() instanceof GeneratedTranscriptSource,
      "default transcript source = generated",
    );
    assert.equal(getDealSource().id, "generated", "id reports the active provider");
  } finally {
    if (prevD === undefined) delete process.env.DEAL_SOURCE;
    else process.env.DEAL_SOURCE = prevD;
    if (prevT === undefined) delete process.env.TRANSCRIPT_SOURCE;
    else process.env.TRANSCRIPT_SOURCE = prevT;
  }
}

function testRegistryUnwiredFailsLoud(): void {
  const prev = process.env.DEAL_SOURCE;
  const prevT = process.env.TRANSCRIPT_SOURCE;
  try {
    process.env.DEAL_SOURCE = "salesforce";
    assert.throws(
      () => getDealSource(),
      // a misconfig must name the exact next step, not silently fall back
      /salesforce\.ts.*DEAL_SOURCE|DEAL_SOURCE.*salesforce\.ts/s,
      "unwired vendor throws an actionable message",
    );
    process.env.DEAL_SOURCE = "wat";
    assert.throws(() => getDealSource(), /unknown DEAL_SOURCE/, "unknown mode throws");

    process.env.TRANSCRIPT_SOURCE = "gong";
    assert.throws(() => getTranscriptSource(), /gong\.ts/, "unwired transcript vendor throws");
  } finally {
    if (prev === undefined) delete process.env.DEAL_SOURCE;
    else process.env.DEAL_SOURCE = prev;
    if (prevT === undefined) delete process.env.TRANSCRIPT_SOURCE;
    else process.env.TRANSCRIPT_SOURCE = prevT;
  }
}

async function main(): Promise<void> {
  await testDeterministic();
  await testCountClamp();
  await testDealShape();
  await testRipeAndNotRipeCoverage();
  await testDistinctFromSeed();
  await testTranscript();
  testRegistryDefaults();
  testRegistryUnwiredFailsLoud();
  console.log("✓ smoke:sources — all source-layer assertions passed");
}

main().catch((e) => {
  console.error("✗ smoke:sources failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
