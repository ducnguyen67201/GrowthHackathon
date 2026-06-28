import assert from "node:assert";
import {
  HEALTHCARE_REGS,
  cohortFor,
  regImpact,
  scoreForced,
  activeReg,
  type GraveDeal,
} from "@/lib/regulations";

// Deterministic check: the regulatory cohort math discriminates and ranks. No API key.
// Run: npx tsx scripts/smoke-regulatory.ts

const deals: GraveDeal[] = [
  { account: "Lumen Health", objectionCategory: "soc2", value: 420000, lostDate: "2026-02-15" },
  { account: "Beacon Behavioral", objectionCategory: "baa", value: 260000, lostDate: "2026-03-04" },
  { account: "Harbor Health", objectionCategory: "compliance-deferred", value: 130000, lostDate: "2025-12-10" },
  { account: "Cedarwood", objectionCategory: "audit-logs", value: 180000, lostDate: "2026-02-28" },
  { account: "Meridian Telehealth", objectionCategory: "pricing", value: 120000, lostDate: "2026-05-04" },
  { account: "Orchard Health", objectionCategory: "fhir", value: 175000, lostDate: "2026-03-14" },
];

const hipaa = HEALTHCARE_REGS.find((r) => r.id === "hipaa-security-2026")!;
const now = Date.parse("2026-06-28");

const cohort = cohortFor(hipaa, deals);
const accounts = cohort.map((d) => d.account).sort();

// forces compliance/security categories — INCLUDING the deal that said "not a priority"
assert.deepStrictEqual(accounts, ["Beacon Behavioral", "Cedarwood", "Harbor Health", "Lumen Health"]);
// excludes pricing + integration objections the law doesn't touch
assert.ok(!accounts.includes("Meridian Telehealth"), "pricing must not be forced");
assert.ok(!accounts.includes("Orchard Health"), "fhir must not be forced");

const impact = regImpact(hipaa, deals);
assert.strictEqual(impact.count, 4);
assert.strictEqual(impact.value, 420000 + 260000 + 130000 + 180000);

// recency: a more-recent loss scores higher than an older one
const recent = scoreForced({ account: "r", lostDate: "2026-06-01" }, now).score;
const stale = scoreForced({ account: "s", lostDate: "2025-01-01" }, now).score;
assert.ok(recent > stale, "recent loss should outscore stale loss");
assert.ok(recent <= 0.99 && stale >= 0.7, "score stays in band");

// the hero reg is the most-recent in-effect one
assert.strictEqual(activeReg().id, "hipaa-security-2026");

console.log(
  `✓ regulatory cohort math OK — HIPAA forces ${impact.count} deals · $${(impact.value / 1000).toFixed(0)}k · hero=${activeReg().title}`,
);
