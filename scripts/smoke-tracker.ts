import assert from "node:assert/strict";
import { FALLBACK_RULES, normalizeLiveRules } from "../convex/tracker_rules";

// Self-check for the pure signal-spine logic. Run: pnpm tsx scripts/smoke-tracker.ts

// 1. The catalog is exactly 52 triggers with one hero (job change).
assert.equal(FALLBACK_RULES.length, 52, "expected 52 fallback rules");
const heroes = FALLBACK_RULES.filter((r) => r.hero);
assert.equal(heroes.length, 1, "expected exactly one hero rule");
assert.equal(heroes[0]?.id, "champion_job_change");
assert.equal(
  new Set(FALLBACK_RULES.map((r) => r.id)).size,
  52,
  "rule ids must be unique",
);

// 2. Normalizer accepts a bare array and flags job-change as hero.
const fromArray = normalizeLiveRules([
  { id: "funding_series_a", name: "Raised a Series A", category: "Funding" },
  {
    id: "champion_job_change",
    name: "Champion changed jobs",
    category: "People",
  },
]);
assert.equal(fromArray.source, "live");
assert.equal(fromArray.rules.length, 2);
assert.equal(
  fromArray.rules.find((r) => r.id === "champion_job_change")?.hero,
  true,
);

// 3. Accepts { rules } / { data } envelopes and `key`/`title`/`group` aliases.
const fromEnvelope = normalizeLiveRules({
  rules: [{ key: "ipo_filed", title: "Filed for IPO", group: "Funding" }],
});
assert.deepEqual(fromEnvelope.rules[0], {
  id: "ipo_filed",
  name: "Filed for IPO",
  category: "Funding",
});
const fromData = normalizeLiveRules({ data: [{ id: "x", name: "X" }] });
assert.equal(fromData.rules[0]?.category, "Other");

// 4. Drops malformed entries (no id) but keeps the valid ones.
const mixed = normalizeLiveRules([{ name: "no id" }, { id: "ok", name: "Ok" }]);
assert.equal(mixed.rules.length, 1);
assert.equal(mixed.rules[0]?.id, "ok");

// 5. Empty / unrecognized payloads throw so the action falls back to the catalog.
assert.throws(() => normalizeLiveRules([]), /no tracker rules/);
assert.throws(() => normalizeLiveRules({ nope: true }));

console.log("smoke-tracker: all assertions passed ✓");
