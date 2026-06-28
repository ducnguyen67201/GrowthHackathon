import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Seed fake-but-realistic data so the dashboard (C) and send (D) branches can build
// WITHOUT waiting on the fiber (A) or brain (B) branches.
// Run AFTER `npx convex dev`:  npx convex run seed:run
//
// run() WIPES the demo tables first, so re-running gives a clean, predictable board
// (no duplicate cards). It seeds two leads:
//   1. Acme Devtools / Jordan Lee — a realistic prospect (fake email) for the full flow.
//   2. "Your Inbox (test)" / You — email = your own, the ONE card that reaches you.

const SELF_SEND_EMAIL = "danielbaker06072001@gmail.com";

export const run = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Wipe demo tables first (creatives + sends before people/companies).
    for (const table of ["sends", "creatives", "people", "companies"] as const) {
      for (const doc of await ctx.db.query(table).collect()) {
        await ctx.db.delete(doc._id);
      }
    }

    // ---- Lead 1: realistic prospect (fake email) — for testing the full real send ----
    const acmeId = await ctx.db.insert("companies", {
      fiberId: "seed-acme",
      name: "Acme Devtools",
      domain: "acme.dev",
      firmoSignals: {
        funding: "Series A $14M",
        headcount: 38,
        hiring: ["SDR", "DevRel"],
      },
      signalSource: "seed",
      logoUrl: undefined,
      enrichedAt: now,
    });

    const jordanId = await ctx.db.insert("people", {
      companyId: acmeId,
      fiberId: "seed-person-1",
      name: "Jordan Lee",
      title: "Head of Growth",
      email: "jordan@acme.dev",
      linkedin: "https://linkedin.com/in/jordanlee",
      socialPosts: [
        {
          platform: "x",
          text: "Hiring our first 5 SDRs. Outbound is broken — every tool sends the same gray email. There has to be a better way.",
          url: "https://x.com/jordanlee",
          postedAt: "2026-06-24",
        },
      ],
      enrichedAt: now,
    });

    const acmeBase = {
      companyId: acmeId,
      personId: jordanId,
      anchorFact:
        "Posted that outbound is broken while hiring their first 5 SDRs",
      sources: [
        { field: "socialPost", value: "outbound is broken... same gray email" },
        { field: "firmoSignals.hiring", value: "SDR x5" },
      ],
      artifactType: "image" as const,
      copyVariants: [
        {
          subject: "saw your post about outbound",
          body: "Jordan — you said every tool sends the same gray email while you're hiring 5 SDRs. That's exactly the problem we kill. 2 min?",
        },
        {
          subject: "your first 5 SDRs",
          body: "Ramping 5 SDRs on outbound that everyone ignores is brutal. We make each touch provably specific. Worth a look?",
        },
      ],
      createdAt: now,
    };

    const acmeReasoning = {
      saw: "Jordan posted (Jun 24) that outbound is broken — 'every tool sends the same gray email' — while hiring 5 SDRs.",
      inferred:
        "They're scaling outbound headcount right now and already feel the gray-text pain firsthand.",
      pain: "New SDRs will ramp slowly because their outbound looks like everyone else's.",
      angle:
        "Lead with their own words on the broken medium, not 'congrats on the raise'.",
      whyThisAngle:
        "The obvious angle is the funding round; but they literally told us their pain is the medium — meeting them there proves we read it.",
      confidence: 0.86,
    };

    await ctx.db.insert("creatives", {
      ...acmeBase,
      reasoning: acmeReasoning,
      status: "approved",
    });
    for (let i = 0; i < 3; i++) {
      await ctx.db.insert("creatives", {
        ...acmeBase,
        reasoning: acmeReasoning,
        status: "draft",
      });
    }

    // ---- Lead 2: the ONE self-send card — its email is yours, so Send reaches you ----
    const inboxId = await ctx.db.insert("companies", {
      fiberId: "seed-self-send",
      name: "Your Inbox (test)",
      domain: "gmail.com",
      firmoSignals: { note: "test lead — emails you" },
      signalSource: "seed",
      logoUrl: undefined,
      enrichedAt: now,
    });

    const youId = await ctx.db.insert("people", {
      companyId: inboxId,
      fiberId: "seed-self-person",
      name: "You (test recipient)",
      title: "Self-send",
      email: SELF_SEND_EMAIL,
      linkedin: undefined,
      socialPosts: [],
      enrichedAt: now,
    });

    await ctx.db.insert("creatives", {
      companyId: inboxId,
      personId: youId,
      anchorFact: "Test card — sending this delivers a real email to your inbox",
      sources: [{ field: "seed", value: "self-send test lead" }],
      artifactType: "image" as const,
      copyVariants: [
        {
          subject: "Cutthrough test send ✓",
          body: "This is a self-send test from the Cutthrough demo. If it landed in your inbox, the real Gmail send path works end to end.",
        },
      ],
      reasoning: {
        saw: "This is the dedicated self-send test card.",
        inferred: "Clicking Send here emails you, not a prospect.",
        pain: "You need to confirm the real send path works before demoing.",
        angle: "Send to yourself first.",
        whyThisAngle: "A real delivered email is the only proof the pipeline works.",
        confidence: 1,
      },
      status: "approved",
      createdAt: now,
    });

    return { acmeId, jordanId, inboxId, youId };
  },
});

// --- Reading-Minds re-aim: seed the DEAD PIPELINE (lost deals + changelog + re-wins) ---
// Run: npx convex run seed:seedRetrigger
// Re-runnable: wipes lost-seed companies/people, lostDeals, changelog, wonOutcomes, and
// re-trigger creatives, so the board is clean each time. Leaves the cold-path seed alone.
// Designed so ~8 of 12 deals are ripe and ~4 are deliberately NOT — the board MUST
// discriminate, or it reads as fake.

type SeedDeal = {
  account: string;
  contact: string;
  title: string;
  domain: string;
  value: number; // deal ACV ($)
  objection: string; // canonical objection
  category: string; // matches a changelog `solves` tag (so the graph can join objection→feature)
  lostDate: string;
  // transcript/lostReason/transcriptDate are optional — generated from the objection when
  // absent, so most deals stay one compact line and the dataset can grow cheaply.
  lostReason?: string;
  transcript?: string;
  transcriptDate?: string;
  externalSignal?: string;
  externalSignalType?: string; // Fiber trigger that would surface it
};

const SEED_DEALS: SeedDeal[] = [
  // Healthcare-SaaS graveyard. The HIPAA Security Rule 2026 update (lib/regulations.ts)
  // FORCES the compliance/security cohort below — including deals that said compliance
  // "wasn't a priority". The rest stay dead so the radar discriminates.

  // --- HIPAA-forced cohort: compliance & security objections ---
  { account: "Lumen Health", contact: "Priya Rao", title: "CTO", domain: "lumenhealth.com", value: 420000,
    lostReason: "We can't purchase without SOC2 Type II — compliance won't sign off.", lostDate: "2026-02-15",
    objection: "no SOC2 Type II", category: "soc2", transcriptDate: "2026-02-12",
    transcript:
      "Rep: Sounds like the eval went well — what's left to get this signed?\n" +
      "Priya Rao: The product's genuinely great, the team loves it. But we're in healthcare — compliance cannot sign off without SOC2 Type II. It's a procurement requirement, full stop.\n" +
      "Rep: Understood — is there an exception path we could use for the pilot?\n" +
      "Priya Rao: Not for anything that touches PHI. Get certified and come back — we'd genuinely want to revisit this.",
    externalSignal: "they just raised a $30M Series B", externalSignalType: "funding_round" },
  { account: "Veritas Health", contact: "Dr. Huy Ngo", title: "CISO", domain: "veritashealth.com", value: 410000,
    lostReason: "No SOC2 Type II — our board won't let us touch PHI with an unaudited vendor.", lostDate: "2026-01-22",
    objection: "no SOC2 Type II", category: "soc2", transcriptDate: "2026-01-20",
    transcript:
      "Rep: Before we talk rollout — anything that would stop security from signing off?\n" +
      "Dr. Huy Ngo: One thing, and it's a hard one. No SOC2 Type II, no deal — our board won't let us put PHI anywhere near an unaudited vendor.\n" +
      "Rep: We're SOC2 Type I today, and Type II is on the roadmap —\n" +
      "Dr. Huy Ngo: A roadmap doesn't clear procurement. Get it certified and we'll restart the eval." },
  { account: "Beacon Behavioral", contact: "Sam Cole", title: "Head of Compliance", domain: "beaconbehavioral.org", value: 260000,
    lostReason: "You can't sign a BAA — that's a legal non-starter for PHI.", lostDate: "2026-03-04",
    objection: "won't sign a BAA", category: "baa", transcriptDate: "2026-03-01",
    transcript:
      "Rep: Walk me through the security review — what would block us?\n" +
      "Sam Cole: Simple. If you can't sign a Business Associate Agreement, legal kills it on the spot. We handle PHI — there's no path forward without a BAA.\n" +
      "Rep: We sign DPAs today, and a BAA is something we could look at —\n" +
      "Sam Cole: \"Could look at\" is a no. We can't move an inch until it's in writing." },
  { account: "Cedarwood Clinics", contact: "Maria Lopez", title: "IT Director", domain: "cedarwoodclinics.com", value: 180000,
    lostReason: "No audit trail of PHI access — we'd fail our own audit.", lostDate: "2026-02-28",
    objection: "no audit logging for PHI access", category: "audit-logs", transcriptDate: "2026-02-25",
    transcript: "Maria Lopez: We need a full record of who touched which patient record. Without PHI access logging we'd fail our own audit." },
  { account: "Northstar Pediatrics", contact: "Owen Hart", title: "VP Engineering", domain: "northstarpeds.com", value: 150000,
    objection: "no encryption at rest for PHI", category: "encryption", lostDate: "2026-01-30" },
  { account: "Civic Health", contact: "Grace Obi", title: "Security Lead", domain: "civichealth.org", value: 200000,
    objection: "no role-based access for clinicians", category: "rbac", lostDate: "2026-04-12",
    externalSignal: "their first CISO just started", externalSignalType: "hiring" },
  { account: "Harbor Health Group", contact: "Aisha Khan", title: "Director of Analytics", domain: "harborhealth.org", value: 130000,
    lostReason: "Honestly, locking down compliance just wasn't a priority for us this year.", lostDate: "2025-12-10",
    objection: "compliance not a priority yet", category: "compliance-deferred", transcriptDate: "2025-12-08",
    transcript: "Aisha Khan: It's not that we don't like it — tightening compliance just isn't on the roadmap this fiscal year. Maybe next year." },
  { account: "Summit Family Care", contact: "Raj Patel", title: "Practice Director", domain: "summitfamilycare.com", value: 95000,
    objection: "no budget for a security review", category: "compliance-deferred", lostDate: "2025-11-28" },
  { account: "Riverside Oncology", contact: "Dana Pratt", title: "COO", domain: "riversideonc.org", value: 220000,
    objection: "no SOC2 Type II", category: "soc2", lostDate: "2026-03-19",
    externalSignal: "expanding to three new states", externalSignalType: "expansion" },

  // --- still dead: HIPAA doesn't force these, and nothing we shipped dissolves them ---
  { account: "Meridian Telehealth", contact: "Max Funke", title: "CFO", domain: "meridiantele.com", value: 120000,
    objection: "pricing model didn't fit", category: "pricing", lostDate: "2026-05-04" },
  { account: "Orchard Health", contact: "Devin Okoro", title: "Eng Lead", domain: "orchardhealth.com", value: 175000,
    objection: "no Epic / FHIR integration", category: "fhir", lostDate: "2026-03-14" },
  { account: "Granite Health System", contact: "Dale Boyd", title: "IT Lead", domain: "granitehealth.org", value: 300000,
    objection: "requires full on-prem", category: "on-prem", lostDate: "2025-12-20" },
  { account: "Pine Ridge Hospital", contact: "Will Reyes", title: "VP Infrastructure", domain: "pineridgehosp.org", value: 160000,
    objection: "not a priority this year", category: "timing", lostDate: "2026-01-05" },
  { account: "Coastal Care Partners", contact: "Jack Tran", title: "RevOps Lead", domain: "coastalcare.com", value: 110000,
    objection: "no Salesforce Health Cloud sync", category: "salesforce", lostDate: "2026-04-18" },
];

const SEED_CHANGELOG = [
  { feature: "SAML SSO + SCIM", description: "Enterprise single sign-on via SAML with SCIM user provisioning.", shippedAt: "2026-05-15", solves: ["auth", "sso", "security", "saml"] },
  { feature: "Snowflake Connector", description: "Native bi-directional sync with Snowflake data warehouses.", shippedAt: "2026-05-02", solves: ["integration", "snowflake", "data-warehouse"] },
  { feature: "SOC2 Type II", description: "Achieved SOC2 Type II certification with audited controls.", shippedAt: "2026-06-01", solves: ["trust", "compliance", "soc2", "security"] },
  { feature: "HIPAA BAA + Compliance Pack", description: "We now sign Business Associate Agreements and ship a HIPAA compliance pack for PHI workloads.", shippedAt: "2026-06-01", solves: ["baa", "hipaa", "phi", "compliance"] },
  { feature: "PHI Audit Logging", description: "Immutable audit trail of every PHI access — who saw which record, when.", shippedAt: "2026-05-20", solves: ["audit-logs", "audit", "phi"] },
  { feature: "Encryption at Rest", description: "AES-256 encryption at rest for all stored PHI.", shippedAt: "2026-05-12", solves: ["encryption", "phi", "security"] },
  { feature: "Usage-Based Pricing", description: "Per-event pricing that replaces seat licenses — pay for what you use.", shippedAt: "2026-05-10", solves: ["price", "pricing", "usage", "cost"] },
  { feature: "Salesforce Sync", description: "Two-way Salesforce CRM sync for accounts, contacts, and activity.", shippedAt: "2026-06-10", solves: ["integration", "salesforce", "crm"] },
  { feature: "Public REST API", description: "Full public REST API with webhooks for custom pipelines.", shippedAt: "2026-04-28", solves: ["api", "integration", "pipeline"] },
  { feature: "Role-Based Access Control", description: "Granular RBAC with custom roles and per-resource permissions.", shippedAt: "2026-05-25", solves: ["rbac", "access", "permissions"] },
  { feature: "Real-time Alerts", description: "Configurable real-time alerting on metric thresholds.", shippedAt: "2026-06-05", solves: ["alerts", "monitoring"] },
  { feature: "Dashboard Templates", description: "Prebuilt dashboard templates for common use cases.", shippedAt: "2026-04-15", solves: ["ui", "dashboards"] },
  { feature: "Mobile App", description: "Native iOS/Android app for dashboards on the go.", shippedAt: "2026-06-12", solves: ["mobile"] },
  { feature: "Okta + Azure AD SSO", description: "One-click SSO via Okta and Azure AD on top of SAML.", shippedAt: "2026-05-18", solves: ["okta", "sso", "auth"] },
  { feature: "HubSpot Sync", description: "Two-way HubSpot CRM sync for contacts and activity.", shippedAt: "2026-06-08", solves: ["hubspot", "integration", "crm"] },
  { feature: "Redshift Connector", description: "Native Amazon Redshift read/write connector.", shippedAt: "2026-05-21", solves: ["redshift", "integration", "data-warehouse"] },
  { feature: "Databricks Connector", description: "Native Databricks / Delta Lake connector.", shippedAt: "2026-06-03", solves: ["databricks", "integration"] },
  { feature: "99.9% Uptime SLA", description: "Contractual 99.9% uptime SLA with status page and credits.", shippedAt: "2026-05-30", solves: ["sla", "uptime", "reliability"] },
  { feature: "Audit Logs", description: "Immutable, exportable audit logs of every action.", shippedAt: "2026-05-12", solves: ["audit-logs", "audit", "compliance"] },
  { feature: "Outbound Webhooks", description: "Subscribe to events with signed outbound webhooks.", shippedAt: "2026-04-30", solves: ["webhooks", "integration"] },
  { feature: "Sandbox Environment", description: "Free isolated sandbox for testing and evaluation.", shippedAt: "2026-05-08", solves: ["sandbox", "testing"] },
  { feature: "GDPR DPA + Subprocessors", description: "Signable GDPR Data Processing Agreement with published subprocessors.", shippedAt: "2026-06-02", solves: ["dpa", "gdpr", "privacy"] },
  { feature: "TypeScript & Python SDKs", description: "First-party TypeScript and Python SDKs with typed clients.", shippedAt: "2026-05-06", solves: ["sdk", "developer"] },
];

const SEED_WON = [
  { account: "Atlas Freight", objection: "Needed SAML SSO before security would approve the rollout.", reWonAt: "2026-06-01" },
  { account: "Meridian Data", objection: "Required a native Snowflake connector for their data team.", reWonAt: "2026-06-08" },
  { account: "Bridge Capital", objection: "Seat-based pricing didn't fit their usage, needed usage-based.", reWonAt: "2026-06-15" },
  { account: "Orion Health", objection: "Couldn't buy without SOC2 Type II for compliance.", reWonAt: "2026-06-18" },
  { account: "Vantage CRM", objection: "Needed two-way Salesforce sync before the team would adopt.", reWonAt: "2026-06-20" },
  { account: "Helix Robotics", objection: "Required role-based access for a large analyst team.", reWonAt: "2026-06-22" },
];

// Deterministic scored re-triggers so the board + rail render WITHOUT running the paid
// orchestrator — also the demo fallback. `pnpm retrigger` overwrites these with real
// model output. Breakdown terms respect the score weights (solved≤.4 ext≤.25 rec≤.15 sim≤.2).
type SampleRetrigger = {
  score: number;
  breakdown: { solved: number; external: number; recency: number; simToWon: number };
  reasoning: { saw: string; inferred: string; pain: string; angle: string; whyThisAngle: string; confidence: number };
  anchorFact: string;
  copy: { subject: string; body: string }[];
  status: "draft" | "approved" | "sent";
};

const SAMPLE_RETRIGGERS: Record<string, SampleRetrigger> = {
  "Northwind Logistics": {
    score: 0.92,
    breakdown: { solved: 0.4, external: 0.225, recency: 0.13, simToWon: 0.165 },
    reasoning: {
      saw: 'Northwind passed on 2026-04-10: "Security blocked it — we can\'t roll out anything without SAML SSO."',
      inferred: "Deal died on auth (missing SSO/SAML).",
      pain: "missing SSO/SAML",
      angle: "We shipped SAML SSO + SCIM — and they just hired a Head of Security.",
      whyThisAngle: "SAML SSO directly resolves the security blocker. The obvious move is a generic 'just checking in' — this returns with the exact reason they said no, now resolved.",
      confidence: 0.92,
    },
    anchorFact: 'Said no for "missing SSO/SAML" — SAML SSO + SCIM now ships.',
    copy: [{ subject: "the sso blocker is gone", body: "Dana — last time, security blocked us over SAML SSO. We shipped it (SCIM too), and I saw you just brought on a Head of Security. Worth another look?" }],
    status: "approved",
  },
  "Lumen Health": {
    score: 0.88,
    breakdown: { solved: 0.4, external: 0.225, recency: 0.105, simToWon: 0.15 },
    reasoning: {
      saw: 'Lumen passed on 2026-02-15: "We can\'t purchase without SOC2 Type II — compliance won\'t sign off."',
      inferred: "Deal died on trust/compliance (SOC2).",
      pain: "no SOC2 Type II",
      angle: "We earned SOC2 Type II — and you just raised a $30M Series B.",
      whyThisAngle: "SOC2 Type II removes the exact compliance blocker. Skipping the generic 'congrats on the raise' and leading with the unblocked objection proves we remember why it stalled.",
      confidence: 0.88,
    },
    anchorFact: 'Said no for "no SOC2 Type II" — SOC2 Type II now certified.',
    copy: [{ subject: "soc2 type II — done", body: "Priya — compliance blocked us last time over SOC2 Type II. We're now certified, and congrats on the Series B. Re-open the eval?" }],
    status: "sent",
  },
  "Drift Mobility": {
    score: 0.85,
    breakdown: { solved: 0.4, external: 0.225, recency: 0.135, simToWon: 0.09 },
    reasoning: {
      saw: 'Drift passed on 2026-05-20: "No Salesforce sync — our whole team lives in SFDC."',
      inferred: "Deal died on integration (no Salesforce sync).",
      pain: "no Salesforce sync",
      angle: "We shipped two-way Salesforce sync — and Elena, your champion, just became CRO.",
      whyThisAngle: "The objection was a hard integration gap we now close; the champion's promotion makes the re-open land with the person who already wanted it.",
      confidence: 0.85,
    },
    anchorFact: 'Said no for "no Salesforce sync" — two-way SFDC sync now ships.',
    copy: [{ subject: "salesforce sync shipped", body: "Elena — the SFDC sync gap that stopped us is closed (two-way now). Congrats on CRO. Want to pick this back up?" }],
    status: "draft",
  },
  "Cobalt Finance": {
    score: 0.71,
    breakdown: { solved: 0.4, external: 0, recency: 0.13, simToWon: 0.18 },
    reasoning: {
      saw: 'Cobalt passed on 2026-05-01: "Seat-based pricing doesn\'t fit our usage pattern — it\'s too expensive at our scale."',
      inferred: "Deal died on price (seat model mismatch).",
      pain: "seat-based pricing too expensive",
      angle: "We launched usage-based pricing — you only pay for what you use now.",
      whyThisAngle: "The objection was the pricing model, not the product. Usage-based pricing removes it directly — no discount-begging, the structure they wanted now exists.",
      confidence: 0.71,
    },
    anchorFact: 'Said no for "seat-based pricing" — usage-based pricing now available.',
    copy: [{ subject: "usage-based pricing is live", body: "Marcus — you passed because seat pricing didn't fit your usage. We just launched per-event pricing. The math probably works now — worth a look?" }],
    status: "draft",
  },
  "Vertex Robotics": {
    score: 0.67,
    breakdown: { solved: 0.4, external: 0, recency: 0.1, simToWon: 0.17 },
    reasoning: {
      saw: 'Vertex passed on 2026-03-22: "No native Snowflake connector — that was a dealbreaker for our data team."',
      inferred: "Deal died on integration (Snowflake).",
      pain: "no native Snowflake connector",
      angle: "We shipped a native bi-directional Snowflake connector.",
      whyThisAngle: "It was a named dealbreaker, not a nice-to-have — leading with the exact connector that ships closes the loop their data team opened.",
      confidence: 0.67,
    },
    anchorFact: 'Said no for "no Snowflake connector" — native Snowflake sync now ships.',
    copy: [{ subject: "snowflake connector shipped", body: "Sam — the Snowflake connector your data team needed is live (bi-directional). That was the dealbreaker last time. Re-evaluate?" }],
    status: "draft",
  },
};

const LOST_SEED_SOURCE = "lost-seed";

// --- deterministic generation so EVERY ripe deal gets a scored creative (dense board +
// graph + recovered-$), not just the 5 hand-authored ones. Mirrors lib/retrigger.ts weights. ---
function recencyDecay(lostDate: string, now: number): number {
  const ms = Date.parse(lostDate);
  if (Number.isNaN(ms)) return 0;
  const ageMonths = (now - ms) / (30 * 24 * 60 * 60 * 1000);
  if (ageMonths < 0) return 0;
  return Math.exp(-ageMonths / 12);
}
function hash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function generateRetrigger(
  d: SeedDeal,
  feature: string,
  now: number,
): SampleRetrigger {
  const solved = 0.4;
  const external = d.externalSignal ? 0.225 : 0;
  const recency = round3(0.15 * recencyDecay(d.lostDate, now));
  const simToWon = round3(0.2 * (0.3 + hash01(d.category) * 0.6));
  const score = round3(solved + external + recency + simToWon);
  const angle = d.externalSignal
    ? `We shipped ${feature} — and ${d.externalSignal}.`
    : `We shipped ${feature}.`;
  return {
    score,
    breakdown: { solved, external, recency, simToWon },
    reasoning: {
      saw: `${d.account} passed on ${d.lostDate}: "${d.objection}."`,
      inferred: `Deal died on ${d.category} — ${d.objection}.`,
      pain: d.objection,
      angle,
      whyThisAngle: `${feature} resolves the exact blocker. Returning with the specific reason they said no — now fixed — beats a generic "just checking in".`,
      confidence: score,
    },
    anchorFact: `Said no for "${d.objection}" — ${feature} now ships.`,
    copy: [
      {
        subject: `${d.objection} — solved`,
        body: `${d.contact} — last time the blocker was "${d.objection}". We shipped ${feature}${d.externalSignal ? `, and ${d.externalSignal}` : ""}. Worth another look?`,
      },
    ],
    status: "draft",
  };
}

// --- dep-free mock-data generator (the "plugin"): deterministic realistic lost deals
// from word pools. No Math.random (Convex must stay deterministic) — everything is
// index/hash-seeded. Scales the board + recovered-$ + brain on demand via `extra`. ---
const G_PREFIX = ["North", "Vertex", "Halcyon", "Cobalt", "Apex", "Harbor", "Lumen", "Drift", "Quill", "Cedar", "Strata", "Pylon", "Lattice", "Bloom", "Forge", "Pulse", "Civic", "Sentinel", "Keystone", "Nordic", "Summit", "Alpine", "Orbit", "Beacon", "Granite", "Helix", "Atlas", "Meridian", "Vantage", "Orion", "Cinder", "Marlow", "Brightwall", "Tycho", "Cardinal", "Veritas", "Solstice", "Ember"];
const G_SUFFIX = ["Logistics", "Health", "Data", "Pay", "Robotics", "Media", "Retail", "Capital", "Labs", "Software", "Systems", "Analytics", "Mobility", "Networks", "Cloud", "Security", "Freight", "Bank", "Commerce", "Energy", "Bio", "Works", "Group"];
const G_FIRST = ["Dana", "Sam", "Priya", "Marcus", "Elena", "Tom", "Aisha", "Ben", "Grace", "Raj", "Kate", "Owen", "Iris", "Mara", "Leo", "Nina", "Cole", "Jack", "Rosa", "Sven", "Tara", "Max", "Ada", "Devin", "Theo", "Ravi", "Will", "Mia", "Freja", "Luca", "Noah", "Zara", "Omar", "Lena", "Hugo", "Yara"];
const G_LAST = ["Kim", "Ortiz", "Rao", "Webb", "Soto", "Becker", "Khan", "Adler", "Lin", "Patel", "Moss", "Hart", "Vance", "Lopez", "Park", "Cole", "Tran", "Mehta", "Olsson", "Singh", "Funke", "Okoro", "Marsh", "Anand", "Reyes", "Roth", "Lund", "Verdi", "Shah", "Obi", "Cho", "Diaz", "Ito", "Bauer", "Frost"];
const G_TITLE = ["VP Data", "CTO", "Head of RevOps", "CISO", "Eng Lead", "Analytics Lead", "VP Eng", "Director of Analytics", "Platform Eng", "Head of Growth", "VP Sales", "DPO", "Head of SecOps", "VP Infrastructure", "Data Engineer"];
const G_RIPE: [string, string][] = [["sso", "missing SSO/SAML"], ["okta", "no Okta SSO"], ["soc2", "no SOC2 Type II"], ["snowflake", "no Snowflake connector"], ["redshift", "no Redshift connector"], ["databricks", "no Databricks support"], ["salesforce", "no Salesforce sync"], ["hubspot", "no HubSpot integration"], ["pricing", "pricing model didn't fit"], ["api", "API too limited"], ["webhooks", "no outbound webhooks"], ["sdk", "no SDKs"], ["rbac", "no role-based access"], ["audit-logs", "no audit logs"], ["sla", "no uptime SLA"], ["sandbox", "no sandbox environment"], ["dpa", "no GDPR DPA"]];
const G_NOTRIPE: [string, string][] = [["on-prem", "requires on-prem"], ["timing", "not a priority this year"], ["competitor", "chose a competitor"], ["residency", "no EU data residency"], ["m&a", "mid-acquisition, frozen"], ["freeze", "hiring & budget freeze"]];
const G_SIGNALS: [string, string][] = [["they just hired a Head of Security", "hiring"], ["they just raised a Series B", "funding_round"], ["their champion was just promoted", "champion_job_change"], ["they're expanding into new markets", "expansion"], ["a new compliance mandate just hit their industry", "regulatory"], ["their incumbent vendor just had an outage", "competitor_signal"]];
const G_DATES = ["2025-09-14", "2025-10-02", "2025-11-19", "2025-12-08", "2026-01-11", "2026-01-27", "2026-02-09", "2026-02-23", "2026-03-06", "2026-03-21", "2026-04-04", "2026-04-19", "2026-05-02", "2026-05-16", "2026-05-29", "2026-06-10"];

const pick = <T,>(arr: T[], i: number): T => arr[((i % arr.length) + arr.length) % arr.length] as T;

function genDeals(n: number): SeedDeal[] {
  const out: SeedDeal[] = [];
  for (let i = 0; i < n; i++) {
    const h = (i * 2654435761 + 1013904223) >>> 0; // deterministic, no Math.random
    const pre = pick(G_PREFIX, h);
    const suf = pick(G_SUFFIX, h >> 3);
    const ripe = h % 100 < 78;
    const [category, objection] = ripe ? pick(G_RIPE, h >> 4) : pick(G_NOTRIPE, h >> 4);
    const hasSignal = h % 100 < 28;
    const sig = hasSignal ? pick(G_SIGNALS, h >> 9) : undefined;
    out.push({
      account: `${pre} ${suf}`,
      contact: `${pick(G_FIRST, h >> 6)} ${pick(G_LAST, h >> 11)}`,
      title: pick(G_TITLE, h >> 16),
      domain: `${(pre + suf).toLowerCase()}-${i}.com`,
      value: 50000 + ((h >> 7) % 41) * 10000, // $50k–$450k
      objection,
      category,
      lostDate: pick(G_DATES, i),
      externalSignal: sig?.[0],
      externalSignalType: sig?.[1],
    });
  }
  return out;
}

export const seedRetrigger = mutation({
  // `extra` = how many generated deals to add on top of the curated 37. Tune density:
  //   npx convex run seed:seedRetrigger '{"extra": 80}'   (board/$ scale up; brain gets busier)
  args: { extra: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    // default 0 — keep the graveyard a pure healthcare set; pass extra to pad density.
    const extra = Math.max(0, Math.min(args.extra ?? 0, 300));
    const ALL_DEALS = [...SEED_DEALS, ...genDeals(extra)];

    // wipe re-trigger creatives first, then their lost-seed companies/people + input tables
    for (const c of await ctx.db.query("creatives").collect()) {
      if (c.retriggerScore !== undefined) await ctx.db.delete(c._id);
    }
    for (const p of await ctx.db.query("people").collect()) {
      const company = await ctx.db.get(p.companyId);
      if (company?.signalSource === LOST_SEED_SOURCE) await ctx.db.delete(p._id);
    }
    for (const company of await ctx.db.query("companies").collect()) {
      if (company.signalSource === LOST_SEED_SOURCE) await ctx.db.delete(company._id);
    }
    for (const table of ["lostDeals", "changelog", "wonOutcomes"] as const) {
      for (const doc of await ctx.db.query(table).collect()) await ctx.db.delete(doc._id);
    }

    for (const c of SEED_CHANGELOG) await ctx.db.insert("changelog", c);
    for (const w of SEED_WON) await ctx.db.insert("wonOutcomes", w);

    let n = 0;
    let scoredCount = 0;
    for (const d of ALL_DEALS) {
      const companyId = await ctx.db.insert("companies", {
        fiberId: `${LOST_SEED_SOURCE}-${n}`,
        name: d.account,
        domain: d.domain,
        firmoSignals: {},
        signalSource: LOST_SEED_SOURCE,
        enrichedAt: now,
      });
      const personId = await ctx.db.insert("people", {
        companyId,
        fiberId: `${LOST_SEED_SOURCE}-person-${n}`,
        name: d.contact,
        title: d.title,
        socialPosts: [],
        enrichedAt: now,
      });
      const lostReason = d.lostReason ?? `${d.objection} — that was the blocker.`;
      const transcript =
        d.transcript ?? `${d.contact}: Honestly, ${d.objection} — that's why we couldn't move forward.`;
      const transcriptDate = d.transcriptDate ?? d.lostDate;

      const lostDealId = await ctx.db.insert("lostDeals", {
        account: d.account,
        contact: d.contact,
        title: d.title,
        domain: d.domain,
        lostReason,
        lostDate: d.lostDate,
        value: d.value,
        transcript,
        transcriptDate,
        objection: d.objection,
        objectionCategory: d.category,
        externalSignal: d.externalSignal,
        externalSignalType: d.externalSignalType,
        companyId,
        personId,
      });

      // ripe = some shipped feature's `solves` includes this objection's category.
      // hand-authored override for the demo-prominent 5; every other ripe deal is generated.
      const feature = SEED_CHANGELOG.find((f) => f.solves.includes(d.category));
      const creative =
        SAMPLE_RETRIGGERS[d.account] ?? (feature ? generateRetrigger(d, feature.feature, now) : null);
      if (creative) {
        // vary status so the Act stage isn't empty; overrides keep their own status.
        const status: "draft" | "approved" | "sent" =
          SAMPLE_RETRIGGERS[d.account]?.status ??
          (scoredCount % 6 === 0 ? "sent" : scoredCount % 3 === 0 ? "approved" : "draft");
        await ctx.db.insert("creatives", {
          companyId,
          personId,
          lostDealId,
          reasoning: creative.reasoning,
          anchorFact: creative.anchorFact,
          sources: [{ field: "lostReason", value: lostReason }],
          artifactType: "image",
          copyVariants: creative.copy,
          status,
          retriggerScore: creative.score,
          retriggerBreakdown: creative.breakdown,
          externalSignal: d.externalSignal,
          createdAt: now,
        });
        scoredCount++;
      }
      n++;
    }

    return { deals: ALL_DEALS.length, generated: extra, changelog: SEED_CHANGELOG.length, won: SEED_WON.length, scored: scoredCount };
  },
});
