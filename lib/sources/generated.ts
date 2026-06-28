import type {
  DealSource,
  TranscriptSource,
  SourceDeal,
  SourceTranscript,
} from "./types";

// The demo provider. Stands in for a real CRM + call-recording stack so the system can show
// the full retrieve → aggregate → render loop with no keys. Output is deterministic (index/
// hash-seeded, no Math.random) so a demo replays identically. Every field is the shape a real
// Salesforce/Gong adapter would return — the only thing that changes when you wire a vendor is
// this file's replacement, not the interface or anything downstream.
// ponytail: deterministic templates, not an LLM. Add an LLM variant only if the canned
//           transcripts start to feel samey in the demo — the seam already supports it.

// Objection archetypes: each is a believable closed-lost reason + the call that produced it.
// `category` matches changelog.solves tags so ripe deals join their shipped fix. `death` is the
// buyer turn the deal died on (kept natural — DealMoment marks it by keyword overlap, not an
// exact-string match, so the objection need not appear verbatim).
type Archetype = {
  objection: string;
  category: string;
  reason: string; // the one-line CRM "lost reason"
  open: string; // rep's opening question
  death: string; // buyer's blocker (the turn it died on)
  rep2: string; // rep's fumble
  close: string; // buyer shuts the door
  signal?: [string, string]; // [externalSignal, externalSignalType] — sometimes attached
};

const ARCHETYPES: Archetype[] = [
  {
    objection: "no SOC2 Type II",
    category: "soc2",
    reason: "Can't purchase without SOC2 Type II — compliance won't sign off.",
    open: "Before we talk rollout — anything that would stop security from signing off?",
    death: "One thing, and it's a hard one. No SOC2 Type II, no deal — our board won't put PHI anywhere near an unaudited vendor.",
    rep2: "We're SOC2 Type I today, and Type II is on the roadmap —",
    close: "A roadmap doesn't clear procurement. Get it certified and we'll restart the eval.",
    signal: ["they just raised a $30M Series B", "funding_round"],
  },
  {
    objection: "won't sign a BAA",
    category: "baa",
    reason: "Legal non-starter — vendor can't sign a BAA for PHI.",
    open: "Walk me through the security review — what would block us?",
    death: "Simple. If you can't sign a Business Associate Agreement, legal kills it on the spot. We handle PHI — there's no path without a BAA.",
    rep2: "We sign DPAs today, and a BAA is something we could look at —",
    close: "\"Could look at\" is a no. We can't move an inch until it's in writing.",
  },
  {
    objection: "no PHI audit logging",
    category: "audit-logs",
    reason: "No audit trail of PHI access — we'd fail our own audit.",
    open: "On the compliance side — what does your audit team need to see?",
    death: "We need a record of who touched which patient record, when. Without PHI access logging we fail our own audit.",
    rep2: "We log at the account level today —",
    close: "Account level isn't record level. Auditors want per-record. That's the gap.",
  },
  {
    objection: "no encryption at rest for PHI",
    category: "encryption",
    reason: "PHI isn't encrypted at rest — security blocked it.",
    open: "Anything our security questionnaire flagged?",
    death: "Yeah — PHI has to be encrypted at rest, full stop. You don't do it, so we can't store anything sensitive with you.",
    rep2: "It's encrypted in transit, and at rest is planned —",
    close: "Planned doesn't pass our review. Come back when it ships.",
  },
  {
    objection: "no role-based access for clinicians",
    category: "rbac",
    reason: "No role-based access — every user sees everything.",
    open: "How are you thinking about access for the clinical team?",
    death: "Clinicians can only see their own patients. You've got one permission level — everyone sees everything. That's a HIPAA problem for us.",
    rep2: "You could split it across separate workspaces —",
    close: "Twelve workspaces isn't a fix. We need real roles. Without RBAC it's a no.",
    signal: ["their first CISO just started", "hiring"],
  },
  {
    objection: "missing SSO/SAML",
    category: "sso",
    reason: "Security blocked rollout without SAML SSO.",
    open: "What's standing between us and a signed order form?",
    death: "Security won't roll out anything without SAML SSO. No SSO, no company-wide deployment — that's policy.",
    rep2: "We support Google login today —",
    close: "Google login isn't SSO. We need SAML with our IdP. Hard requirement.",
    signal: ["they just hired a Head of Security", "hiring"],
  },
  {
    objection: "no Salesforce sync",
    category: "salesforce",
    reason: "No two-way Salesforce sync — the team lives in SFDC.",
    open: "Where does your team actually work day to day?",
    death: "Everyone lives in Salesforce. If it doesn't sync two-way with SFDC, adoption dies in week one. We've seen it.",
    rep2: "You can export CSVs and import —",
    close: "Nobody's doing manual CSVs. No native sync, no deal.",
    signal: ["their champion was just promoted to CRO", "champion_job_change"],
  },
  {
    objection: "seat-based pricing didn't fit",
    category: "pricing",
    reason: "Seat pricing too expensive at their scale.",
    open: "How did the pricing land with your finance team?",
    death: "Per-seat just doesn't work at our scale — we'd pay for 400 seats to have 30 active. The math kills it.",
    rep2: "We could discount the seats —",
    close: "A discount on the wrong model is still the wrong model. We need usage-based.",
  },
  // Deliberately NOT ripe — nothing shipped solves FHIR. Keeps the demo honest: the radar
  // must discriminate or it reads as fake.
  {
    objection: "no Epic / FHIR integration",
    category: "fhir",
    reason: "No Epic/FHIR integration — can't fit our EHR.",
    open: "What would this need to plug into on your side?",
    death: "Everything routes through Epic. Without a real FHIR integration it's an island, and an island doesn't get bought here.",
    rep2: "We have a generic REST API —",
    close: "Generic REST isn't FHIR. Our integration team won't take it on.",
  },
];

// Distinct from the seed's account names on purpose — synced deals show up as NEW accounts in
// the pipeline, so it's visibly "the CRM sync pulled these," not the static demo set.
const PREFIX = ["Brightwall", "Tycho", "Cardinal", "Juniper", "Marwick", "Foxglove", "Heartland", "Silvercrest", "Everwell", "Maplebrook", "Ridgeline", "Caldera", "Wexford", "Lakeshore", "Thornfield", "Galen", "Northwind", "Oakvale", "Sterling", "Birchwood", "Crestview", "Pinecrest", "Fairmont", "Westgate", "Ashford"];
const SUFFIX = ["Health", "Care", "Clinics", "Medical", "Behavioral", "Pediatrics", "Oncology", "Telehealth", "Health Group", "Health System", "Family Care", "Diagnostics"];
const FIRST = ["Dana", "Sam", "Priya", "Marcus", "Elena", "Aisha", "Grace", "Raj", "Owen", "Maria", "Will", "Dana", "Lena", "Hugo", "Yara", "Devin", "Jack", "Nina", "Theo", "Mara"];
const LAST = ["Rao", "Cole", "Webb", "Khan", "Hart", "Lopez", "Obi", "Patel", "Pratt", "Ngo", "Reyes", "Funke", "Okoro", "Boyd", "Tran", "Lin", "Adler"];
const TITLE = ["CTO", "CISO", "Head of Compliance", "IT Director", "VP Engineering", "Security Lead", "Director of Analytics", "COO", "Practice Director"];
const LOST_DATES = ["2025-11-28", "2025-12-10", "2026-01-05", "2026-01-22", "2026-02-15", "2026-02-28", "2026-03-04", "2026-03-19", "2026-04-12", "2026-04-18", "2026-05-04"];

const pick = <T,>(arr: T[], i: number): T =>
  arr[((i % arr.length) + arr.length) % arr.length] as T;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// minus N days from a base "today" for the transcript date (call happened just before close).
function daysBefore(iso: string, n: number): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms - n * 86400000).toISOString().slice(0, 10);
}

export class GeneratedDealSource implements DealSource {
  readonly id = "generated";
  readonly label = "Demo CRM (generated)";

  async listClosedLost(opts?: { count?: number }): Promise<SourceDeal[]> {
    const count = Math.max(1, Math.min(opts?.count ?? 12, 100));
    const out: SourceDeal[] = [];
    for (let i = 0; i < count; i++) {
      const h = (i * 2654435761 + 1013904223) >>> 0;
      // Unsigned shifts throughout: a signed `>>` on a hash ≥ 2^31 goes negative, which would
      // produce a negative ACV below (pick() normalizes negatives, but value math doesn't).
      const arc = pick(ARCHETYPES, h >>> 4);
      const account = `${pick(PREFIX, h)} ${pick(SUFFIX, h >>> 3)}`;
      const contact = `${pick(FIRST, h >>> 6)} ${pick(LAST, h >>> 11)}`;
      const attachSignal = h % 100 < 35; // ~1/3 carry a "why now" trigger
      out.push({
        externalId: `OPP-${1000 + i}`,
        account,
        contact,
        title: pick(TITLE, h >>> 16),
        domain: `${account.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`,
        value: 90000 + ((h >>> 7) % 36) * 10000, // $90k–$450k
        lostReason: arc.reason,
        lostDate: pick(LOST_DATES, i),
        objection: arc.objection,
        category: arc.category,
        externalSignal: attachSignal ? arc.signal?.[0] : undefined,
        externalSignalType: attachSignal ? arc.signal?.[1] : undefined,
        // company context for the card. A real Fiber enrich overrides this when keyed; for the
        // generated demo it's deterministic so the artifact shows "Healthcare · ~N · Stage".
        firmoSignals: {
          industry: "Healthcare",
          employees: 50 + ((h >>> 9) % 56) * 10, // ~50–600
          stage: pick(["Series A", "Series B", "Series C", "PE-backed", "Bootstrapped"], h >>> 13),
        },
      });
    }
    return out;
  }
}

export class GeneratedTranscriptSource implements TranscriptSource {
  readonly id = "generated";
  readonly label = "Demo calls (generated)";

  async getForDeal(deal: SourceDeal): Promise<SourceTranscript | null> {
    const arc =
      ARCHETYPES.find((a) => a.category === deal.category) ?? ARCHETYPES[0]!;
    const transcript = [
      `Rep: ${arc.open}`,
      `${deal.contact}: ${arc.death}`,
      `Rep: ${arc.rep2}`,
      `${deal.contact}: ${arc.close}`,
    ].join("\n");
    // call landed a few days before the deal was marked lost — deterministic offset.
    const transcriptDate = daysBefore(deal.lostDate, 2 + (hash(deal.externalId) % 4));
    return { transcript, transcriptDate };
  }
}
