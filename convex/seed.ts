import { mutation } from "./_generated/server";

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
          subject: "Tombstone test send ✓",
          body: "This is a self-send test from the Tombstone demo. If it landed in your inbox, the real Gmail send path works end to end.",
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

// --- Reading-Minds re-aim: seed ONLY the INITIAL GROUND TRUTH for the dead pipeline ---
// Run: npx convex run seed:seedRetrigger
//
// What this seeds is exactly what a real CRM + call-recorder would hand you: the lost
// customers and their call transcripts, plus the changelog (what we've shipped) and the
// re-won outcomes. It does NOT seed re-trigger creatives — those are GENERATED by the engine
// (lostDeals.generateCreatives, run automatically by sources:sync). Demo data volume comes
// from the source layer (sources:sync), so the seed stays a small, real, transcript-rich set.
//
// Typical setup:  seed:run → seed:seedRetrigger → sources:sync   (sync generates every card)

type SeedDeal = {
  account: string;
  contact: string;
  title: string;
  domain: string;
  value: number; // deal ACV ($)
  objection: string; // canonical objection
  category: string; // matches a changelog `solves` tag (so the graph can join objection→feature)
  lostDate: string;
  lostReason: string;
  transcript: string; // the call where it died — multi-turn "Speaker: line\n…"
  transcriptDate: string;
  firmoSignals?: Record<string, unknown>; // company context for the card (Fiber overrides when keyed)
  externalSignal?: string;
  externalSignalType?: string; // Fiber trigger that would surface it
};

// The curated customers — each a real lost deal with a real call transcript. Four are ripe
// (a shipped feature now dissolves the objection); Harbor stays dead so the radar discriminates.
// Everything else (volume, variety) is retrieved live via sources:sync.
const SEED_DEALS: SeedDeal[] = [
  { account: "Lumen Health", contact: "Priya Rao", title: "CTO", domain: "lumenhealth.com", value: 420000,
    lostReason: "We can't purchase without SOC2 Type II — compliance won't sign off.", lostDate: "2026-02-15",
    objection: "no SOC2 Type II", category: "soc2", transcriptDate: "2026-02-12",
    firmoSignals: { industry: "Digital Health", employees: 180, stage: "Series B" },
    transcript:
      "Rep: Sounds like the eval went well — what's left to get this signed?\n" +
      "Priya Rao: The product's genuinely great, the team loves it. But we're in healthcare — compliance cannot sign off without SOC2 Type II. It's a procurement requirement, full stop.\n" +
      "Rep: Understood — is there an exception path we could use for the pilot?\n" +
      "Priya Rao: Not for anything that touches PHI. Get certified and come back — we'd genuinely want to revisit this.",
    externalSignal: "they just raised a $30M Series B", externalSignalType: "funding_round" },
  { account: "Veritas Health", contact: "Dr. Huy Ngo", title: "CISO", domain: "veritashealth.com", value: 410000,
    lostReason: "No SOC2 Type II — our board won't let us touch PHI with an unaudited vendor.", lostDate: "2026-01-22",
    objection: "no SOC2 Type II", category: "soc2", transcriptDate: "2026-01-20",
    firmoSignals: { industry: "Healthcare", employees: 60, stage: "Series A" },
    transcript:
      "Rep: Before we talk rollout — anything that would stop security from signing off?\n" +
      "Dr. Huy Ngo: One thing, and it's a hard one. No SOC2 Type II, no deal — our board won't let us put PHI anywhere near an unaudited vendor.\n" +
      "Rep: We're SOC2 Type I today, and Type II is on the roadmap —\n" +
      "Dr. Huy Ngo: A roadmap doesn't clear procurement. Get it certified and we'll restart the eval." },
  { account: "Beacon Behavioral", contact: "Sam Cole", title: "Head of Compliance", domain: "beaconbehavioral.org", value: 260000,
    lostReason: "You can't sign a BAA — that's a legal non-starter for PHI.", lostDate: "2026-03-04",
    objection: "won't sign a BAA", category: "baa", transcriptDate: "2026-03-01",
    firmoSignals: { industry: "Behavioral Health", employees: 90, stage: "Series B" },
    transcript:
      "Rep: Walk me through the security review — what would block us?\n" +
      "Sam Cole: Simple. If you can't sign a Business Associate Agreement, legal kills it on the spot. We handle PHI — there's no path forward without a BAA.\n" +
      "Rep: We sign DPAs today, and a BAA is something we could look at —\n" +
      "Sam Cole: \"Could look at\" is a no. We can't move an inch until it's in writing." },
  { account: "Cedarwood Clinics", contact: "Maria Lopez", title: "IT Director", domain: "cedarwoodclinics.com", value: 180000,
    lostReason: "No audit trail of PHI access — we'd fail our own audit.", lostDate: "2026-02-28",
    objection: "no PHI audit logging", category: "audit-logs", transcriptDate: "2026-02-25",
    firmoSignals: { industry: "Healthcare", employees: 120, stage: "PE-backed" },
    transcript:
      "Rep: What does your audit team need to see before they'll approve us?\n" +
      "Maria Lopez: A full record of who touched which patient record, and when. You don't have PHI access logging, so we'd fail our own audit.\n" +
      "Rep: We log at the account level today —\n" +
      "Maria Lopez: Account level isn't record level. Auditors want per-record. That's the gap, and it's a hard stop." },
  // Deliberately NOT ripe — nothing shipped dissolves "not a priority". Keeps the radar honest.
  { account: "Harbor Health Group", contact: "Aisha Khan", title: "Director of Analytics", domain: "harborhealth.org", value: 130000,
    lostReason: "Honestly, locking down compliance just wasn't a priority for us this year.", lostDate: "2025-12-10",
    objection: "compliance not a priority yet", category: "compliance-deferred", transcriptDate: "2025-12-08",
    firmoSignals: { industry: "Healthcare Analytics", employees: 75, stage: "Series A" },
    transcript:
      "Rep: Is there a path to getting the security review prioritized this quarter?\n" +
      "Aisha Khan: It's not that we don't like the product — tightening compliance just isn't on the roadmap this fiscal year.\n" +
      "Aisha Khan: Maybe next year. Check back when budgets reset." },
];

// What we've shipped — the "internal trigger" an objection can dissolve against. The system
// matches a lost deal's objection category to a feature's `solves` tags to decide re-winnability.
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

const LOST_SEED_SOURCE = "lost-seed";

export const seedRetrigger = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // wipe prior re-trigger creatives + lost-seed companies/people + the input tables (the
    // cold-path `run` seed, tagged signalSource:"seed", is left alone).
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
    for (const d of SEED_DEALS) {
      const companyId = await ctx.db.insert("companies", {
        fiberId: `${LOST_SEED_SOURCE}-${n}`,
        name: d.account,
        domain: d.domain,
        firmoSignals: d.firmoSignals ?? {},
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
      await ctx.db.insert("lostDeals", {
        account: d.account,
        contact: d.contact,
        title: d.title,
        domain: d.domain,
        lostReason: d.lostReason,
        lostDate: d.lostDate,
        value: d.value,
        transcript: d.transcript,
        transcriptDate: d.transcriptDate,
        objection: d.objection,
        objectionCategory: d.category,
        externalSignal: d.externalSignal,
        externalSignalType: d.externalSignalType,
        companyId,
        personId,
      });
      n++;
    }

    // creatives are NOT seeded — the engine generates them. Run it now so just seeding (without
    // sources:sync) still yields a populated board; sources:sync regenerates over the full set.
    return { deals: SEED_DEALS.length, changelog: SEED_CHANGELOG.length, won: SEED_WON.length };
  },
});
