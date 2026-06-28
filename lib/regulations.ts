// The regulatory ledger — the external clock that re-triggers a whole cohort at once.
// When a law takes effect, every dead deal whose objection category it now FORCES becomes
// winnable on the same day: you didn't change, they didn't change — the world did.
//
// This map (regulation → objection categories it forces) is the compounding asset: built
// once for healthcare, it re-triggers cohorts for every customer in the vertical.
// ponytail: hand-authored ledger — swap for a live regulatory feed (Federal Register /
//           eCFR / state trackers) post-demo; the cohort math below stays identical.

export type Regulation = {
  id: string;
  title: string;
  authority: string;
  effectiveDate: string; // ISO yyyy-mm-dd
  status: "in_effect" | "upcoming";
  summary: string;
  forces: string[]; // objection categories the law now mandates
};

export const HEALTHCARE_REGS: Regulation[] = [
  {
    id: "hipaa-security-2026",
    title: "HIPAA Security Rule — 2026 Update",
    authority: "HHS Office for Civil Rights",
    effectiveDate: "2026-06-01",
    status: "in_effect",
    summary:
      "Makes encryption, PHI access logging, role-based access, and signed BAAs mandatory for every system that touches PHI — and removes the “addressable” loophole that let providers defer compliance.",
    forces: [
      "soc2",
      "hipaa",
      "baa",
      "phi",
      "audit-logs",
      "encryption",
      "rbac",
      "compliance-deferred",
    ],
  },
  {
    id: "42-cfr-part-2-2026",
    title: "42 CFR Part 2 — Final Rule",
    authority: "SAMHSA / HHS",
    effectiveDate: "2026-02-16",
    status: "in_effect",
    summary:
      "Tightens handling and audit requirements for substance-use-disorder records — forcing consent tracking and PHI access logging on any system storing them.",
    forces: ["audit-logs", "phi", "consent"],
  },
  {
    id: "wa-mhmd-2026",
    title: "WA My Health My Data Act",
    authority: "Washington State",
    effectiveDate: "2026-09-01",
    status: "upcoming",
    summary:
      "Adds consumer-health-data consent and residency obligations for any vendor processing Washington residents' health data.",
    forces: ["residency", "dpa", "consent"],
  },
];

export type GraveDeal = {
  account: string;
  contact?: string;
  title?: string;
  domain?: string;
  objection?: string | null;
  objectionCategory?: string | null;
  value?: number | null;
  lostDate?: string;
};

export function catOf(deal: GraveDeal): string {
  return (deal.objectionCategory ?? deal.objection ?? "").toLowerCase();
}

// The cohort a regulation re-triggers: every dead deal whose objection it now forces.
export function cohortFor(reg: Regulation, deals: GraveDeal[]): GraveDeal[] {
  const forced = new Set(reg.forces);
  return deals.filter((d) => forced.has(catOf(d)));
}

export function regImpact(
  reg: Regulation,
  deals: GraveDeal[],
): { count: number; value: number } {
  const cohort = cohortFor(reg, deals);
  const value = cohort.reduce((sum, d) => sum + (d.value ?? 0), 0);
  return { count: cohort.length, value };
}

const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;

// Transparent re-win score for a forced deal — no black box.
//   forced (the law mandates it) + recency (warmer if they said no recently) +
//   deliverable (we shipped the fix that satisfies the mandate).
export function scoreForced(
  deal: GraveDeal,
  now: number = Date.now(),
): { score: number; breakdown: { forced: number; recency: number; deliverable: number } } {
  const forced = 0.5;
  const deliverable = 0.2;
  let recency = 0;
  if (deal.lostDate) {
    const monthsAgo = (now - Date.parse(deal.lostDate)) / MS_PER_MONTH;
    recency = Math.max(0, Math.min(0.3, 0.3 * (1 - monthsAgo / 24)));
  }
  const score = Math.min(0.99, forced + recency + deliverable);
  return { score, breakdown: { forced, recency: Math.round(recency * 1000) / 1000, deliverable } };
}

// The hero: the most recently-effective regulation (the one that "just dropped").
export function activeReg(): Regulation {
  const inEffect = HEALTHCARE_REGS.filter((r) => r.status === "in_effect");
  return (
    inEffect.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0] ??
    HEALTHCARE_REGS[0]!
  );
}
