"use node"; // the source layer (lib/sources) is plain Node TS; real adapters will use fetch

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getDealSource, getTranscriptSource } from "../lib/sources";

// The aggregation pipeline, made real. Fan out to the configured sources — closed-lost deals
// (CRM) and their call transcripts (call-recording) — join them per deal, and write the result
// into the dead-pipeline tables. This is the exact code path a live Salesforce+Gong integration
// runs; today the providers are the generated demo source (no keys), swapped by env later.
//
//   npx convex run sources:sync                 # 12 deals from the configured sources
//   npx convex run sources:sync '{"count": 30}' # more, to fill the board/graph
//
// After it runs, /live re-triggers (e.g. the synced accounts) read REAL retrieved transcripts.
// Explicit return type: this action references `api` (for runMutation) while being part of
// `api` itself — without the annotation TS can't break the self-reference and degrades to `any`.
export const sync = action({
  args: { count: v.optional(v.number()) },
  handler: async (
    ctx,
    { count },
  ): Promise<{
    dealSource: string;
    transcriptSource: string;
    imported: number;
    creatives: number;
  }> => {
    const dealSrc = getDealSource();
    const txSrc = getTranscriptSource();

    // 1. retrieve closed-lost deals from the system of record
    const deals = await dealSrc.listClosedLost({ count: count ?? 12 });

    // 2. aggregate each deal with its call transcript (parallel — independent lookups)
    const rows = await Promise.all(
      deals.map(async (d) => {
        const tx = await txSrc.getForDeal(d);
        return {
          externalId: d.externalId,
          account: d.account,
          contact: d.contact,
          title: d.title,
          domain: d.domain,
          value: d.value,
          lostReason: d.lostReason,
          lostDate: d.lostDate,
          objection: d.objection,
          category: d.category,
          externalSignal: d.externalSignal,
          externalSignalType: d.externalSignalType,
          firmoSignals: d.firmoSignals,
          transcript: tx?.transcript,
          transcriptDate: tx?.transcriptDate,
        };
      }),
    );

    // 3. persist — same sink a real integration would write to
    const label = `${dealSrc.label} + ${txSrc.label}`;
    const res = await ctx.runMutation(api.lostDeals.importSynced, {
      source: label,
      rows,
    });

    // 4. "the system running": generate the re-trigger creative for every ripe deal missing one
    // (seed + synced), so the wall and the autopsy show the SAME deals. Deterministic today;
    // LLM when OPENAI_API_KEY is set (scripts/retrigger.ts).
    const gen = await ctx.runMutation(api.lostDeals.generateCreatives, {});

    console.info("[sources:sync]", {
      dealSource: dealSrc.label,
      transcriptSource: txSrc.label,
      imported: res.imported,
      creatives: gen.generated,
    });
    return {
      dealSource: dealSrc.label,
      transcriptSource: txSrc.label,
      imported: res.imported,
      creatives: gen.generated,
    };
  },
});
