"use node"; // real OpenAI network call — needs the Node runtime

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

// The autonomous analytics worker for the dead pipeline. Instead of deals sitting static
// until someone clicks a manual trigger, this runs ON ITS OWN — right after each ingest
// (scheduled by intake.ingestCall) and on a cron (convex/crons.ts). It GROUPS every
// un-analyzed deal into ONE prompt and passes it to the LLM, which reads each real call
// transcript + signal and returns a grounded re-win read. Results are written back so the
// board flips "⟳ analyzing…" → "✓ analyzed" with the model's actual insight per deal.
// No OPENAI_API_KEY → we still stamp analyzedAt (UI resolves) but skip the model: honest,
// never fabricated, and the demo never hangs.

const DealAnalysis = z.object({
  id: z.string(),
  reWinScore: z.number().min(0).max(1),
  priority: z.enum(["now", "soon", "watch"]),
  angle: z.string(),
  insight: z.string(),
});
const Analysis = z.object({ deals: z.array(DealAnalysis) });

type Pending = {
  id: string;
  account: string;
  objection: string;
  value: number;
  transcript: string;
  externalSignal: string | null;
  fixFeature: string | null;
};

export const analyzePipeline = action({
  args: {},
  handler: async (ctx): Promise<{ analyzed: number; model: boolean }> => {
    const deals: Pending[] = await ctx.runQuery(
      api.lostDeals.pendingContext,
      {},
    );
    if (deals.length === 0) return { analyzed: 0, model: false };

    // No key → don't invent analysis. Stamp analyzedAt so the spinner resolves and move on.
    if (!process.env.OPENAI_API_KEY) {
      for (const d of deals) {
        await ctx.runMutation(api.lostDeals.applyAnalysis, {
          lostDealId: d.id as never,
        });
      }
      return { analyzed: deals.length, model: false };
    }

    const roster = deals
      .map(
        (d) =>
          `id=${d.id} | account=${d.account} | value=$${d.value} | objection="${d.objection}" | shippedFix=${d.fixFeature ?? "none"} | whyNowSignal="${d.externalSignal ?? "none"}"\n  transcript: ${d.transcript || "(none)"}`,
      )
      .join("\n\n");

    let analyzed = 0;
    try {
      const client = new OpenAI();
      const completion = await client.beta.chat.completions.parse({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a revenue strategist triaging a book of LOST deals to decide which are worth re-opening NOW and how. Each deal gives you the account, the objection that killed it, the REAL call transcript, a why-now external signal, the deal value, and whether we've since shipped a fix that resolves the objection. For EACH deal return: reWinScore 0-1 (how re-winnable today), priority (now|soon|watch), the single sharpest re-open angle, and a one-line insight a rep can act on. Ground every insight in THAT deal's transcript/signal — quote or paraphrase their actual words; never generic. Echo each deal's id EXACTLY as given.",
          },
          { role: "user", content: `DEALS:\n${roster}` },
        ],
        response_format: zodResponseFormat(Analysis, "analysis"),
      });
      const parsed = completion.choices[0]?.message.parsed;
      const byId = new Map((parsed?.deals ?? []).map((x) => [x.id, x]));
      for (const d of deals) {
        const a = byId.get(d.id);
        await ctx.runMutation(api.lostDeals.applyAnalysis, {
          lostDealId: d.id as never,
          insight: a ? `${a.insight} — ${a.angle}` : undefined,
        });
        analyzed++;
      }
    } catch (e) {
      console.error("[pipeline] LLM analysis failed — stamping analyzed only", e);
      // never leave deals stuck "analyzing": stamp so the UI resolves even on model error.
      for (const d of deals) {
        await ctx.runMutation(api.lostDeals.applyAnalysis, {
          lostDealId: d.id as never,
        });
      }
      return { analyzed: deals.length, model: false };
    }

    return { analyzed, model: true };
  },
});
