import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// "I just got off a call." Drop a raw transcript in → the system reads the objection that
// killed it, files it into the dead pipeline, and (because every cockpit panel is a reactive
// useQuery) the brain grows a node + the recovery $ ticks up live. One pure mutation: no
// OpenAI, no Node action, no API route — so it can't die on conference wifi mid-demo.
//
// ponytail: deterministic keyword read over the changelog `solves` tags. The LLM path
// (lib/objections.extractObjection) is the SAME read with nicer phrasing — drop it in behind
// a node action when a key is present; nothing downstream changes (objectionCategory is the
// only contract the brain/board/recovery join on).

// each row: category (matches a changelog `solves` tag) + canonical objection + trigger words
const READERS: { category: string; objection: string; keywords: string[] }[] = [
  {
    category: "soc2",
    objection: "no SOC2 Type II",
    keywords: ["soc2", "soc 2", "type ii", "type 2", "unaudited"],
  },
  {
    category: "baa",
    objection: "won't sign a BAA",
    keywords: ["baa", "business associate"],
  },
  {
    category: "audit-logs",
    objection: "no PHI audit logging",
    keywords: [
      "audit log",
      "audit trail",
      "who touched",
      "per-record",
      "per record",
      "access logging",
      "who saw",
    ],
  },
  {
    category: "encryption",
    objection: "no encryption at rest for PHI",
    keywords: ["encrypt", "at rest"],
  },
  {
    category: "rbac",
    objection: "no role-based access for clinicians",
    keywords: [
      "role-based",
      "role based",
      "rbac",
      "permission level",
      "everyone sees everything",
      "real roles",
    ],
  },
  {
    category: "sso",
    objection: "missing SSO/SAML",
    keywords: ["saml", "sso", "single sign"],
  },
  {
    category: "salesforce",
    objection: "no Salesforce sync",
    keywords: ["salesforce", "sfdc"],
  },
  {
    category: "price",
    objection: "seat-based pricing didn't fit",
    keywords: [
      "per-seat",
      "per seat",
      "seat-based",
      "usage-based",
      "the math kills it",
    ],
  },
  {
    category: "fhir",
    objection: "no Epic / FHIR integration",
    keywords: ["fhir", "epic", "ehr"],
  },
];

// Read the call: first category whose trigger words appear, + the line they appear on (the
// grounding quote — the buyer's actual words, not a paraphrase). No match → unclear blocker.
function readObjection(transcript: string): {
  objection: string;
  category: string;
  quote: string;
} {
  const lc = transcript.toLowerCase();
  for (const r of READERS) {
    if (r.keywords.some((k) => lc.includes(k))) {
      const line = transcript
        .split(/\n+/)
        .find((l) => r.keywords.some((k) => l.toLowerCase().includes(k)));
      return {
        objection: r.objection,
        category: r.category,
        quote: (line ?? transcript).trim(),
      };
    }
  }
  return {
    objection: "unclear blocker",
    category: "other",
    quote: transcript.slice(0, 160).trim(),
  };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const round3 = (n: number) => Math.round(n * 1000) / 1000;
function hash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}
// fresh call → full recency; mirrors generateCreatives' weights so an ingested deal ranks
// on the SAME scale as the seeded board (solved .4 / external .225 / recency .15 / sim .2).
function scoreDeal(category: string, hasSignal: boolean): number {
  const sim = 0.2 * (0.3 + hash01(category) * 0.6);
  return round3(0.4 + (hasSignal ? 0.225 : 0) + 0.15 + sim);
}

// The "why-now" trigger the pipeline enriches a fresh call with. Provided by the call →
// use it. Otherwise we discover one — deterministic for the demo (no key needed), keyed on
// the account so it's stable. ponytail: swap for a real lib/fiber.ts lookup behind a Node
// action when FIBER_API_KEY is set; nothing downstream changes (externalSignal is the contract).
const WHY_NOW: [string, string][] = [
  ["just closed a $30M Series B", "funding_round"],
  ["just hired their first CISO", "hiring"],
  ["their old champion just came back as VP Engineering", "champion_job_change"],
  ["just kicked off a company-wide HIPAA compliance push", "compliance_initiative"],
  ["nearly doubled headcount in the last two quarters", "rapid_growth"],
  ["just signed a major hospital-system contract", "new_logo"],
];
function discoverSignal(account: string, category: string): [string, string] {
  const i = Math.floor(hash01(account + category) * WHY_NOW.length) % WHY_NOW.length;
  return WHY_NOW[i] ?? WHY_NOW[0]!;
}

export const ingestCall = mutation({
  args: {
    account: v.string(),
    contact: v.string(),
    title: v.optional(v.string()),
    value: v.optional(v.number()),
    transcript: v.string(),
    externalSignal: v.optional(v.string()),
    externalSignalType: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const read = readObjection(a.transcript);

    // Enrichment step: find the "why-now" trigger. The call carried one → use it; else the
    // pipeline discovers a fresh signal. `discoveredSignal` lets the UI show "Fiber found …".
    const [discoText, discoType] = discoverSignal(a.account, read.category);
    const sigText = a.externalSignal ?? discoText;
    const sigType = a.externalSignalType ?? discoType;
    const discoveredSignal = !a.externalSignal;

    // a shipped feature that dissolves this objection? — the same category→solves join the
    // brain graph and board use, so a ripe ingested deal lights up identically to a seeded one.
    const changelog = await ctx.db.query("changelog").collect();
    const fix = changelog.find((f) => f.solves.includes(read.category));

    // dedupe: clicking "ingest" twice (or re-running the demo) shouldn't pile up the account.
    // `replaced` lets the UI say "updated in place" instead of looking like nothing happened.
    const TAG = "live-call";
    let replaced = false;
    for (const c of await ctx.db.query("companies").collect()) {
      if (c.signalSource !== TAG || c.name !== a.account) continue;
      replaced = true;
      for (const cr of await ctx.db.query("creatives").collect())
        if (cr.companyId === c._id) await ctx.db.delete(cr._id);
      for (const d of await ctx.db.query("lostDeals").collect())
        if (d.companyId === c._id) await ctx.db.delete(d._id);
      for (const p of await ctx.db.query("people").collect())
        if (p.companyId === c._id) await ctx.db.delete(p._id);
      await ctx.db.delete(c._id);
    }

    const companyId = await ctx.db.insert("companies", {
      fiberId: `${TAG}-${slug(a.account)}-${now}`,
      name: a.account,
      domain: `${slug(a.account)}.com`,
      firmoSignals: { industry: "Healthcare" },
      signalSource: TAG,
      enrichedAt: now,
    });
    const personId = await ctx.db.insert("people", {
      companyId,
      fiberId: `${TAG}-person-${slug(a.account)}-${now}`,
      name: a.contact,
      title: a.title,
      socialPosts: [],
      enrichedAt: now,
    });
    const lostDealId = await ctx.db.insert("lostDeals", {
      account: a.account,
      contact: a.contact,
      title: a.title,
      domain: `${slug(a.account)}.com`,
      lostReason: read.quote,
      lostDate: today,
      value: a.value,
      transcript: a.transcript,
      transcriptDate: today,
      objection: read.objection,
      objectionCategory: read.category,
      externalSignal: sigText,
      externalSignalType: sigType,
      companyId,
      personId,
    });

    // ripe → write the scored re-trigger creative (status "draft", correct content) so the
    // deal lands on the board + recovery $ immediately. Not ripe → it stays in the graveyard;
    // the brain shows the account→objection with NO green resolved_by edge (honest: we haven't
    // shipped the fix). The day a feature solves this category, it lights up on its own.
    let score: number | null = null;
    if (fix) {
      score = scoreDeal(read.category, Boolean(sigText));
      const first = a.contact.split(/\s+/)[0] ?? a.contact;
      const signalLine = sigText
        ? ` I also noticed ${a.account} ${sigText} — feels like the timing finally lines up.`
        : "";
      await ctx.db.insert("creatives", {
        companyId,
        personId,
        lostDealId,
        reasoning: {
          saw: `${a.account} passed today: "${read.quote}"`,
          inferred: `Deal died on ${read.category} — ${read.objection}.`,
          pain: read.objection,
          angle: sigText
            ? `We shipped ${fix.feature} — and ${sigText}.`
            : `We shipped ${fix.feature}.`,
          whyThisAngle: `${fix.feature} resolves the exact blocker they raised on the call — returning with the specific reason they said no, now fixed, beats a generic "just checking in".`,
          confidence: score,
        },
        anchorFact: `Said no for "${read.objection}" — ${fix.feature} now ships.`,
        sources: [{ field: "lostReason", value: read.quote }],
        artifactType: "image",
        copyVariants: [
          {
            subject: `the ${read.objection} blocker is gone`,
            body: `Hi ${first} — on our call today the dealbreaker was ${read.objection}. That's resolved now: we shipped ${fix.feature} (${fix.shippedAt}), the exact thing your team needed.${signalLine} No pitch — 15 minutes to show you what changed. Worth re-opening?`,
          },
        ],
        status: "draft",
        retriggerScore: score,
        retriggerBreakdown: {
          solved: 0.4,
          external: sigText ? 0.225 : 0,
          recency: 0.15,
          simToWon: round3(score - 0.4 - (sigText ? 0.225 : 0) - 0.15),
        },
        externalSignal: sigText,
        createdAt: now,
      });
    }

    // Kick the autonomous analytics pass — it groups every un-analyzed deal into one LLM
    // prompt, reads the transcripts, and writes a grounded re-win insight back, stamping
    // analyzedAt so the board flips "⟳ analyzing…" → "✓ analyzed" without a manual trigger.
    await ctx.scheduler.runAfter(1000, api.pipeline.analyzePipeline, {});

    // Authoritative post-write totals — the UI shows these as proof the row is in the DB
    // and the dashboard counts moved. Same shape as flowCounts, computed AFTER the inserts.
    const allDeals = await ctx.db.query("lostDeals").collect();
    const allCreatives = await ctx.db.query("creatives").collect();
    const scoredCreatives = allCreatives.filter(
      (c) => c.retriggerScore !== undefined,
    );
    let recoveredValue = 0;
    for (const c of scoredCreatives) {
      const dd = c.lostDealId ? await ctx.db.get(c.lostDealId) : null;
      recoveredValue += dd?.value ?? 0;
    }

    return {
      account: a.account,
      contact: a.contact,
      objection: read.objection,
      category: read.category,
      quote: read.quote,
      ripe: Boolean(fix),
      feature: fix?.feature ?? null,
      featureShippedAt: fix?.shippedAt ?? null,
      value: a.value ?? 0,
      score,
      signal: sigText,
      signalType: sigType,
      discoveredSignal, // true → the pipeline found it (not carried by the call)
      replaced,
      // proof it landed: the live pipeline numbers, straight from the DB post-write.
      totals: {
        graveyard: allDeals.length,
        scored: scoredCreatives.length,
        recoveredValue,
      },
    };
  },
});

// Undo a mis-ingested call: remove the live-call account and everything it created
// (creative + lost deal + person + company). Same key the ingest dedupe uses.
export const removeIngested = mutation({
  args: { account: v.string() },
  handler: async (ctx, { account }) => {
    const TAG = "live-call";
    let removed = 0;
    for (const c of await ctx.db.query("companies").collect()) {
      if (c.signalSource !== TAG || c.name !== account) continue;
      for (const cr of await ctx.db.query("creatives").collect())
        if (cr.companyId === c._id) await ctx.db.delete(cr._id);
      for (const d of await ctx.db.query("lostDeals").collect())
        if (d.companyId === c._id) await ctx.db.delete(d._id);
      for (const p of await ctx.db.query("people").collect())
        if (p.companyId === c._id) await ctx.db.delete(p._id);
      await ctx.db.delete(c._id);
      removed++;
    }
    return { removed };
  },
});

// Close the loop — the literal "continuous learning" feed. When a re-triggered deal is re-won,
// its objection joins wonOutcomes; lib/learning embeds that set and an objection scores higher
// the more it resembles deals you've already won back (W_SIM in the re-trigger score). No model
// training — the won-centroid shifts as outcomes accumulate. Returns the new learned-set size.
export const markReWon = mutation({
  args: { account: v.string(), objection: v.string() },
  handler: async (ctx, { account, objection }) => {
    const today = new Date(Date.now()).toISOString().slice(0, 10);
    await ctx.db.insert("wonOutcomes", { account, objection, reWonAt: today });
    const learned = (await ctx.db.query("wonOutcomes").collect()).length;
    return { learned };
  },
});
