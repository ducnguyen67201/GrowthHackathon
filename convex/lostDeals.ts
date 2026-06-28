import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { reasoningV, sourceV, copyVariantV } from "./validators";

// Reading-Minds re-aim — read/write side of the dead-pipeline tables. The orchestrator
// (scripts/retrigger.ts) reads lost deals + changelog + won outcomes, scores each, and
// writes a re-trigger creative. The board (app/signals) reads them back ranked.

export const listLostDeals = query({
  args: {},
  handler: async (ctx) => ctx.db.query("lostDeals").collect(),
});

// Live counts + recovered-pipeline $ for the Signal Flow rail. Realtime via useQuery.
export const flowCounts = query({
  args: {},
  handler: async (ctx) => {
    const lostDeals = await ctx.db.query("lostDeals").collect();
    const creatives = await ctx.db.query("creatives").collect();
    const scored = creatives.filter((c) => c.retriggerScore !== undefined);

    // recovered pipeline = the ACV of the dead deals we scored re-triggerable
    let recoveredValue = 0;
    for (const c of scored) {
      const deal = c.lostDealId ? await ctx.db.get(c.lostDealId) : null;
      recoveredValue += deal?.value ?? 0;
    }
    const graveyardValue = lostDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);

    return {
      graveyard: lostDeals.length,
      scored: scored.length,
      sent: scored.filter((c) => c.status === "sent").length,
      recoveredValue,
      graveyardValue,
    };
  },
});

// Pull the ACTUAL call where a deal died — the transcript moment behind a /live re-trigger.
// Matched by account name (exact, then loose contains either way). Joins the shipped fix
// (same objection-category → feature.solves edge the board/brainGraph use) so the "moment"
// card carries both the wound (their words, that day) and the heal (what we shipped since).
// Seeded today; swap the transcript field for real call-recording reads later — the shape
// here doesn't change.
export const byAccount = query({
  args: { account: v.string() },
  handler: async (ctx, { account }) => {
    const target = account.trim().toLowerCase();
    if (!target) return null;
    const deals = await ctx.db.query("lostDeals").collect();
    const deal =
      deals.find((d) => d.account.toLowerCase() === target) ??
      deals.find(
        (d) =>
          d.account.toLowerCase().includes(target) ||
          target.includes(d.account.toLowerCase()),
      );
    if (!deal) return null;

    const cat = deal.objectionCategory;
    const fix = cat
      ? (await ctx.db.query("changelog").collect()).find((f) =>
          f.solves.includes(cat),
        )
      : undefined;

    return {
      account: deal.account,
      contact: deal.contact,
      title: deal.title ?? null,
      value: deal.value ?? null,
      lostDate: deal.lostDate,
      objection: deal.objection ?? null,
      objectionCategory: deal.objectionCategory ?? null,
      lostReason: deal.lostReason,
      transcript: deal.transcript ?? null,
      transcriptDate: deal.transcriptDate ?? null,
      externalSignal: deal.externalSignal ?? null,
      fixFeature: fix?.feature ?? null,
      fixShippedAt: fix?.shippedAt ?? null,
      fixDescription: fix?.description ?? null,
    };
  },
});

// The money story — "how we actually win this deal / $ back". Aggregates the dead pipeline into
// dead $, re-winnable $, and an expected-recovery $ (each ripe deal's value weighted by its
// re-win score), plus the top deals as a Discover→Insight→Signal→Re-open win path. One query
// powers the cockpit Recovery band. Deterministic; realtime via useQuery.
export const recoveryDashboard = query({
  args: {},
  handler: async (ctx) => {
    const [lostDeals, creatives, changelog] = await Promise.all([
      ctx.db.query("lostDeals").collect(),
      ctx.db.query("creatives").collect(),
      ctx.db.query("changelog").collect(),
    ]);

    // best (highest-score) re-trigger creative per lost deal
    const byDeal = new Map<string, (typeof creatives)[number]>();
    for (const c of creatives) {
      if (c.retriggerScore === undefined || !c.lostDealId) continue;
      const k = String(c.lostDealId);
      const prev = byDeal.get(k);
      if (!prev || (c.retriggerScore ?? 0) > (prev.retriggerScore ?? 0)) byDeal.set(k, c);
    }

    let deadValue = 0;
    let reWinnableValue = 0;
    let projected = 0;
    let sentValue = 0;
    let sent = 0;
    const rows: Array<{
      account: string;
      contact: string;
      value: number;
      score: number;
      objection: string | null;
      lostReason: string;
      externalSignal: string | null;
      fixFeature: string | null;
      fixShippedAt: string | null;
      lostDate: string;
      status: string;
      expected: number;
    }> = [];

    for (const d of lostDeals) {
      const value = d.value ?? 0;
      deadValue += value;
      const c = byDeal.get(String(d._id));
      if (!c) continue; // not winnable yet — stays in the graveyard
      const score = c.retriggerScore ?? 0;
      reWinnableValue += value;
      const expected = value * score;
      projected += expected;
      if (c.status === "sent") {
        sentValue += value;
        sent++;
      }
      const cat = d.objectionCategory;
      const fix = cat ? changelog.find((f) => f.solves.includes(cat)) : undefined;
      rows.push({
        account: d.account,
        contact: d.contact,
        value,
        score,
        objection: d.objection ?? null,
        lostReason: d.lostReason,
        externalSignal: d.externalSignal ?? null,
        fixFeature: fix?.feature ?? null,
        fixShippedAt: fix?.shippedAt ?? null,
        lostDate: d.lostDate,
        status: c.status,
        expected,
      });
    }

    rows.sort((a, b) => b.expected - a.expected); // rank by expected $ recovered

    return {
      deadValue,
      reWinnableValue,
      projected: Math.round(projected),
      sentValue,
      graveyard: lostDeals.length,
      reWinnable: rows.length,
      sent,
      topDeals: rows.slice(0, 6),
    };
  },
});

export const listChangelog = query({
  args: {},
  handler: async (ctx) => ctx.db.query("changelog").collect(),
});

export const listWon = query({
  args: {},
  handler: async (ctx) => ctx.db.query("wonOutcomes").collect(),
});

// The "company brain" graph — Obsidian-style: accounts ↔ objections ↔ features, plus
// Fiber signals. resolved_by edges (objection → shipped feature) ARE the re-trigger logic
// made visual. Derived from seed, no LLM. Powers /brain.
type BrainNode = { id: string; type: string; label: string; meta: Record<string, unknown> };
type BrainEdge = { source: string; target: string; kind: string };

const titleCase = (s: string) =>
  s.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

export const brainGraph = query({
  args: {},
  handler: async (ctx) => {
    const deals = await ctx.db.query("lostDeals").collect();
    const changelog = await ctx.db.query("changelog").collect();

    const nodes: BrainNode[] = [];
    const edges: BrainEdge[] = [];
    const seen = new Set<string>();
    const add = (n: BrainNode) => {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        nodes.push(n);
      }
    };

    for (const f of changelog) {
      add({ id: `feat:${f.feature}`, type: "feature", label: f.feature, meta: { shippedAt: f.shippedAt, solves: f.solves } });
    }

    for (const d of deals) {
      const accId = `acc:${d.account}`;
      add({ id: accId, type: "account", label: d.account, meta: { value: d.value ?? 0, contact: d.contact } });

      const cat = d.objectionCategory ?? d.objection;
      if (cat) {
        const objId = `obj:${cat}`;
        add({ id: objId, type: "objection", label: titleCase(cat), meta: { example: d.objection ?? "" } });
        edges.push({ source: accId, target: objId, kind: "said_no" });

        const feat = d.objectionCategory
          ? changelog.find((f) => f.solves.includes(d.objectionCategory as string))
          : undefined;
        if (feat) edges.push({ source: objId, target: `feat:${feat.feature}`, kind: "resolved_by" });
      }

      if (d.externalSignal) {
        const sigId = `sig:${d.account}`;
        add({ id: sigId, type: "signal", label: d.externalSignal, meta: { fiberTrigger: d.externalSignalType ?? "fiber" } });
        edges.push({ source: accId, target: sigId, kind: "fiber" });
      }
    }

    return { nodes, edges };
  },
});

// Aggregation sink: write deals (+ their transcripts) retrieved from the source layer
// (lib/sources) into the dead-pipeline tables. Re-runnable — wipes prior synced rows first
// (tagged on the company, like the seed does) so the demo stays clean. The /live autopsy popup
// reads these back via byAccount with no change: a synced deal looks identical to a seeded one,
// which is the whole point of the source seam — swap the vendor, the UI never moves.
const SYNC_TAG = "synced-crm";

export const importSynced = mutation({
  args: {
    source: v.string(), // human label of the provider combo, for the return/log
    rows: v.array(
      v.object({
        externalId: v.string(),
        account: v.string(),
        contact: v.string(),
        title: v.string(),
        domain: v.string(),
        value: v.number(),
        lostReason: v.string(),
        lostDate: v.string(),
        objection: v.string(),
        category: v.string(),
        externalSignal: v.optional(v.string()),
        externalSignalType: v.optional(v.string()),
        firmoSignals: v.optional(v.any()),
        transcript: v.optional(v.string()),
        transcriptDate: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { source, rows }) => {
    const now = Date.now();

    // wipe prior synced companies + their people/lostDeals (leave seeded data alone).
    const companies = await ctx.db.query("companies").collect();
    const syncedCompanyIds = new Set(
      companies.filter((c) => c.signalSource === SYNC_TAG).map((c) => c._id),
    );
    // creatives first: any creative tied to a synced company would otherwise dangle a stale
    // lostDealId after the wipe and render as a ghost card on the board. None exist today
    // (sync writes no creatives), but keep the wipe complete so a future board-join is safe.
    for (const c of await ctx.db.query("creatives").collect()) {
      if (syncedCompanyIds.has(c.companyId)) await ctx.db.delete(c._id);
    }
    for (const d of await ctx.db.query("lostDeals").collect()) {
      if (d.companyId && syncedCompanyIds.has(d.companyId)) await ctx.db.delete(d._id);
    }
    for (const p of await ctx.db.query("people").collect()) {
      if (syncedCompanyIds.has(p.companyId)) await ctx.db.delete(p._id);
    }
    for (const id of syncedCompanyIds) await ctx.db.delete(id);

    let imported = 0;
    for (const d of rows) {
      const companyId = await ctx.db.insert("companies", {
        fiberId: `${SYNC_TAG}-${d.externalId}`,
        name: d.account,
        domain: d.domain,
        firmoSignals: d.firmoSignals ?? {},
        signalSource: SYNC_TAG,
        enrichedAt: now,
      });
      const personId = await ctx.db.insert("people", {
        companyId,
        fiberId: `${SYNC_TAG}-person-${d.externalId}`,
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
      imported++;
    }
    return { imported, source };
  },
});

// "The system running": generate a scored re-trigger creative for every ripe lost deal that
// doesn't have one yet — the objection is already on the row (the read), so: match a shipped
// fix by category → score → reasoning → copy. Deterministic + key-free so the wall populates
// today; `scripts/retrigger.ts` overwrites with real LLM output when OPENAI_API_KEY is set.
// This is what unifies the views: seed/sync provide the raw deal+transcript, the engine makes
// the card, so the Recent-re-triggers wall and the /live autopsy are always the SAME deal.
const RT_W = { solved: 0.4, external: 0.225, recency: 0.15, sim: 0.2 };
function rtRecency(lostDate: string, now: number): number {
  const ms = Date.parse(lostDate);
  if (Number.isNaN(ms)) return 0;
  const ageMonths = (now - ms) / (30 * 24 * 60 * 60 * 1000);
  return ageMonths < 0 ? 0 : Math.exp(-ageMonths / 12);
}
function rtHash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}
const rtRound3 = (n: number) => Math.round(n * 1000) / 1000;

// First name only, honorific stripped ("Dr. Huy Ngo" → "Huy") — emails open on a first name.
function rtFirstName(name: string): string {
  const parts = name.split(/\s+/).filter((w) => !/^(dr|mr|mrs|ms|prof)\.?$/i.test(w));
  return parts[0] ?? name;
}
function rtMonth(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
// Reframe a third-person signal ("they just raised…") to name the company, so the email reads
// like the rep actually noticed it — not a mail-merge token.
function rtSignalLine(company: string, signal: string | undefined): string {
  if (!signal) return "";
  const s = signal
    .replace(/^they\b/i, company)
    .replace(/^their\b/i, `${company}'s`);
  return ` I also noticed ${s} — feels like the timing finally lines up.`;
}

export const generateCreatives = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const [lostDeals, changelog, creatives] = await Promise.all([
      ctx.db.query("lostDeals").collect(),
      ctx.db.query("changelog").collect(),
      ctx.db.query("creatives").collect(),
    ]);
    const hasCreative = new Set(
      creatives.filter((c) => c.lostDealId).map((c) => String(c.lostDealId)),
    );

    let generated = 0;
    for (const d of lostDeals) {
      if (hasCreative.has(String(d._id))) continue;
      const cat = d.objectionCategory;
      // ripe = some shipped feature's `solves` includes this objection's category.
      const fix = cat ? changelog.find((f) => f.solves.includes(cat)) : undefined;
      if (!fix || !d.companyId || !d.personId) continue; // not winnable yet → stays dead

      const objection = d.objection ?? "the blocker";
      const external = d.externalSignal ? RT_W.external : 0;
      const recency = rtRound3(RT_W.recency * rtRecency(d.lostDate, now));
      const sim = rtRound3(RT_W.sim * (0.3 + rtHash01(cat ?? objection) * 0.6));
      const score = rtRound3(RT_W.solved + external + recency + sim);
      const angle = d.externalSignal
        ? `We shipped ${fix.feature} — and ${d.externalSignal}.`
        : `We shipped ${fix.feature}.`;

      // Personalized, specific copy (two angles for the editor's V1/V2). First name, the exact
      // blocker in their words, the shipped fix + when, and the "why now" signal reframed.
      const first = rtFirstName(d.contact);
      const shipped = ` (${rtMonth(fix.shippedAt)})`;
      const signalLine = rtSignalLine(d.account, d.externalSignal ?? undefined);
      const copyVariants = [
        {
          subject: `the ${objection} blocker is gone`,
          body: `Hi ${first} — when ${d.account} last evaluated us, the dealbreaker was ${objection}. That's resolved now: we shipped ${fix.feature}${shipped}, the exact thing your team needed.${signalLine} No pitch — I'd just love 15 minutes to show you what changed. Worth re-opening?`,
        },
        {
          subject: `re-opening ${d.account}? ${fix.feature} just shipped`,
          body: `${first} — I know we stalled on ${objection}, so I wanted to close the loop honestly: ${fix.feature} is live${shipped}, which removes the precise blocker you raised.${signalLine} Happy to send proof first, or grab a quick call — whichever's easier. Open to another look?`,
        },
      ];

      // vary status so the downstream Act stage isn't all one bucket
      const status: "draft" | "approved" | "sent" =
        generated % 6 === 0 ? "sent" : generated % 3 === 0 ? "approved" : "draft";

      await ctx.db.insert("creatives", {
        companyId: d.companyId,
        personId: d.personId,
        lostDealId: d._id,
        reasoning: {
          saw: `${d.account} passed on ${d.lostDate}: "${objection}."`,
          inferred: `Deal died on ${cat ?? "a hard requirement"} — ${objection}.`,
          pain: objection,
          angle,
          whyThisAngle: `${fix.feature} resolves the exact blocker. Returning with the specific reason they said no — now fixed — beats a generic "just checking in".`,
          confidence: score,
        },
        anchorFact: `Said no for "${objection}" — ${fix.feature} now ships.`,
        sources: [{ field: "lostReason", value: d.lostReason }],
        artifactType: "image",
        copyVariants,
        status,
        retriggerScore: score,
        retriggerBreakdown: { solved: RT_W.solved, external, recency, simToWon: sim },
        externalSignal: d.externalSignal,
        createdAt: now,
      });
      generated++;
    }
    return { generated };
  },
});

// patch a lost deal with what extractObjection() read (so the board shows the read)
export const setObjection = mutation({
  args: {
    lostDealId: v.id("lostDeals"),
    objection: v.string(),
    objectionCategory: v.string(),
    objectionCluster: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.lostDealId, {
      objection: args.objection,
      objectionCategory: args.objectionCategory,
      objectionCluster: args.objectionCluster,
    });
  },
});

// insert a re-trigger creative — mirrors creatives_write.create() but carries the score
// + breakdown + external signal so the board can rank dead-pipeline accounts.
export const createRetrigger = mutation({
  args: {
    companyId: v.id("companies"),
    personId: v.id("people"),
    lostDealId: v.id("lostDeals"),
    reasoning: reasoningV,
    anchorFact: v.string(),
    sources: v.array(sourceV),
    copyVariants: v.array(copyVariantV),
    retriggerScore: v.number(),
    retriggerBreakdown: v.any(),
    externalSignal: v.optional(v.string()),
    runId: v.optional(v.id("runs")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("creatives", {
      companyId: args.companyId,
      personId: args.personId,
      lostDealId: args.lostDealId,
      reasoning: args.reasoning,
      anchorFact: args.anchorFact,
      sources: args.sources,
      copyVariants: args.copyVariants,
      artifactType: "image",
      status: "draft",
      retriggerScore: args.retriggerScore,
      retriggerBreakdown: args.retriggerBreakdown,
      externalSignal: args.externalSignal,
      runId: args.runId,
      createdAt: Date.now(),
    });
  },
});

// the ranked board: re-trigger creatives (have a score) joined to company/person/deal,
// highest score first. Reuses the creatives table the dashboard already renders.
export const board = query({
  args: {},
  handler: async (ctx) => {
    const creatives = await ctx.db.query("creatives").collect();
    const changelog = await ctx.db.query("changelog").collect();
    const retriggers = creatives.filter((c) => c.retriggerScore !== undefined);
    retriggers.sort((a, b) => (b.retriggerScore ?? 0) - (a.retriggerScore ?? 0));
    return Promise.all(
      retriggers.map(async (c) => {
        const company = await ctx.db.get(c.companyId);
        const person = await ctx.db.get(c.personId);
        const deal = c.lostDealId ? await ctx.db.get(c.lostDealId) : null;
        // the fix that dissolved the objection — same category join brainGraph uses.
        // Carries the ship DATE so the board can place it on the death→today timeline.
        const cat = deal?.objectionCategory;
        const fix = cat ? changelog.find((f) => f.solves.includes(cat)) : undefined;
        return {
          _id: c._id,
          score: c.retriggerScore ?? 0,
          breakdown: c.retriggerBreakdown ?? null,
          externalSignal: c.externalSignal ?? null,
          reasoning: c.reasoning,
          anchorFact: c.anchorFact,
          copyVariants: c.copyVariants,
          status: c.status,
          account: company?.name ?? deal?.account ?? "—",
          dealAccount: deal?.account ?? null,
          contact: person?.name ?? deal?.contact ?? "—",
          value: deal?.value ?? null,
          lostDate: deal?.lostDate ?? null,
          objection: deal?.objection ?? null,
          objectionCategory: deal?.objectionCategory ?? null,
          transcript: deal?.transcript ?? null,
          transcriptDate: deal?.transcriptDate ?? null,
          externalSignalType: deal?.externalSignalType ?? null,
          fixFeature: fix?.feature ?? null,
          fixShippedAt: fix?.shippedAt ?? null,
          fixSolves: fix?.description ?? null,
        };
      }),
    );
  },
});
