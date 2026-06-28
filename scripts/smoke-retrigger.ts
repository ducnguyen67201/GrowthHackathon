import assert from "node:assert/strict";
import {
  scoreRetrigger,
  recencyDecay,
  buildRetriggerReasoning,
  W_SOLVED,
} from "@/lib/retrigger";
import { cosine, centroid } from "@/lib/learning";
import { Reasoning, type Objection, type RetriggerMatch } from "@/lib/schemas";

// Reading-Minds re-aim smoke (Gate 1 for the engine). The SCORING is the money-path and
// it's PURE — so this asserts it deterministically with NO API key, NO Convex. The LLM
// extract/match calls are exercised separately (scripts/retrigger.ts) against live env.

const NOW = Date.parse("2026-06-27");

function testScoringDiscriminates() {
  // a deal whose objection is solved + recent + resembles a past win should outrank a
  // deal that's unsolved, old, and unfamiliar. The board MUST discriminate or it's fake.
  const hot = scoreRetrigger({
    solved: true,
    externalSignalStrength: 0.9,
    lostDate: "2026-05-01",
    simToWon: 0.8,
    now: NOW,
  });
  const cold = scoreRetrigger({
    solved: false,
    externalSignalStrength: 0.0,
    lostDate: "2023-01-01",
    simToWon: 0.1,
    now: NOW,
  });
  assert.ok(hot.score > cold.score, "solved+recent+familiar must outrank unsolved+old");
  assert.ok(hot.score <= 1 && cold.score >= 0, "score stays in [0,1]");
  // "we shipped it" is the dominant term: solved alone must beat every non-solved signal.
  const solvedOnly = scoreRetrigger({ solved: true, externalSignalStrength: 0, lostDate: "2000-01-01", simToWon: 0, now: NOW });
  const unsolvedMax = scoreRetrigger({ solved: false, externalSignalStrength: 1, lostDate: "2026-06-27", simToWon: 1, now: NOW });
  assert.ok(solvedOnly.breakdown.solved === W_SOLVED, "solved term = W_SOLVED");
  assert.ok(unsolvedMax.breakdown.solved === 0, "unsolved → solved term 0");
  console.log(`  hot=${hot.score.toFixed(3)} cold=${cold.score.toFixed(3)} ✓ discriminates`);
}

function testRecencyMonotonic() {
  const recent = recencyDecay("2026-06-01", NOW);
  const old = recencyDecay("2022-06-01", NOW);
  const future = recencyDecay("2099-01-01", NOW);
  assert.ok(recent > old, "newer loss → higher recency");
  assert.ok(recent <= 1 && old >= 0, "recency in [0,1]");
  assert.equal(future, 0, "future/invalid date → 0");
  assert.equal(recencyDecay("not-a-date", NOW), 0, "unparseable date → 0");
  console.log(`  recent=${recent.toFixed(3)} old=${old.toFixed(3)} ✓ monotonic`);
}

function testEmbeddingMath() {
  assert.equal(cosine([1, 0], [1, 0]), 1, "identical vectors → 1");
  assert.equal(cosine([1, 0], [0, 1]), 0, "orthogonal → 0");
  assert.equal(cosine([1, 0], [-1, 0]), 0, "opposite floored at 0");
  assert.equal(cosine([], []), 0, "empty → 0");
  assert.deepEqual(centroid([[2, 0], [0, 2]]), [1, 1], "centroid averages");
  assert.deepEqual(centroid([]), [], "empty centroid → []");
  console.log("  cosine + centroid ✓");
}

function testReasoningBridge() {
  const objection: Objection = {
    objection: "missing SSO/SAML",
    category: "auth",
    quote: "security blocked it, no SSO",
    confidence: 0.9,
  };
  const match: RetriggerMatch = {
    matched: true,
    feature: "SAML SSO + SCIM",
    why: "SAML SSO directly resolves the security/SSO blocker.",
  };
  const { reasoning, anchorFact } = buildRetriggerReasoning({
    deal: { account: "Acme", contact: "Jordan Lee", lostDate: "2026-05-01" },
    objection,
    match,
    externalSignal: "their champion just became VP Eng",
    score: 0.82,
  });
  // the bridge MUST produce a valid Reasoning — that's what makes the whole downstream
  // (writeCopy → renderArtifact → send) reuse unchanged.
  Reasoning.parse(reasoning);
  assert.ok(reasoning.angle.includes("SAML SSO + SCIM"), "angle names the shipped feature");
  assert.ok(reasoning.angle.includes("VP Eng"), "angle folds in the external signal");
  assert.ok(reasoning.saw.includes("security blocked it"), "saw quotes their real words");
  assert.equal(reasoning.confidence, 0.82, "confidence carries the score");
  assert.ok(anchorFact.includes("SAML SSO + SCIM"), "anchor names the feature");
  console.log("  buildRetriggerReasoning → valid Reasoning ✓");
}

console.log("smoke:retrigger — pure scoring/ranking (no API needed)");
testScoringDiscriminates();
testRecencyMonotonic();
testEmbeddingMath();
testReasoningBridge();
console.log("\n✓ smoke:retrigger passed — the signal-detection math is sound.");
