import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  FALLBACK_RULES,
  normalizeLiveRules,
  type RulesResult,
  type TrackerRule,
} from "./tracker_rules";

// Branch H (feat/signal-spine): the "52 triggers we watch" spine.
//  - listRules: Fiber `listAvailableTrackerRules`, parsed + cached, with an honest
//    static fallback so the panel always renders (these calls are free).
//  - replay: fire a trigger signal on a real company via Fiber's dummy/preview path
//    (free) and record the run. The reasoned-card half lights up once feat/sdr-brain
//    consumes the run — see the wave plan: replay needs A+B for full effect.

const FIBER_BASE = "https://api.fiber.ai";
// ponytail: exact tracker paths are a guess against the public surface; confirm vs
// Fiber docs when the key lands. Any failure degrades to FALLBACK_RULES / a simulated
// fire, so a wrong path never breaks the demo.
const RULES_PATH = "/v1/tracker/list-available-rules";
const FIRE_DUMMY_PATH = "/v1/tracker/fire-dummy";

// ponytail: module-level memo with a 1h TTL — actions reuse the warm isolate, and a
// cold start just re-fetches. A per-deployment cache table only if this gets hot.
const CACHE_TTL_MS = 60 * 60 * 1000;
let cache: { at: number; result: RulesResult } | null = null;

export const listRules = action({
  args: { now: v.optional(v.number()) },
  handler: async (_ctx, { now }): Promise<RulesResult> => {
    const t = now ?? Date.now();
    if (cache && t - cache.at < CACHE_TTL_MS) return cache.result;

    const key = process.env.FIBER_API_KEY;
    const result: RulesResult = key
      ? await fetchLiveRules(key).catch((): RulesResult => ({
          rules: FALLBACK_RULES,
          source: "fallback",
        }))
      : { rules: FALLBACK_RULES, source: "fallback" };

    cache = { at: t, result };
    return result;
  },
});

async function fetchLiveRules(key: string): Promise<RulesResult> {
  const res = await fetch(`${FIBER_BASE}${RULES_PATH}`, {
    headers: { "x-api-key": key },
  });
  if (!res.ok) throw new Error(`Fiber listAvailableTrackerRules ${res.status}`);
  return normalizeLiveRules(await res.json());
}

export type ReplayResult = {
  runId: Id<"runs">;
  ruleId: string;
  ruleName: string;
  companyName: string;
  fired: boolean;
  note: string;
};

export const replay = action({
  args: {
    companyName: v.string(),
    ruleId: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, { companyName, ruleId, now }): Promise<ReplayResult> => {
    const company = companyName.trim();
    if (!company) throw new Error("replay: companyName is required");

    const rule =
      FALLBACK_RULES.find((r) => r.id === ruleId) ??
      ({ id: ruleId, name: ruleId, category: "Other" } satisfies TrackerRule);

    // Fire the signal honestly — Fiber's dummy path is free. Degrade to a simulated
    // fire (still recorded) when there's no key or the path is wrong.
    const fired = await fireDummySignal(ruleId, company).catch(() => false);

    const runId = await ctx.runMutation(internal.tracker.recordReplay, {
      companyName: company,
      ruleId: rule.id,
      ruleName: rule.name,
      fired,
      now: now ?? Date.now(),
    });

    // ponytail: the reasoned-card step is owned by feat/sdr-brain — it consumes this
    // run. Standalone, replay proves the signal→action half and queues the rest.
    return {
      runId,
      ruleId: rule.id,
      ruleName: rule.name,
      companyName: company,
      fired,
      note: fired
        ? `Fired “${rule.name}” for ${company} — queued for reasoning.`
        : `Simulated “${rule.name}” for ${company} (Fiber key/endpoint unavailable) — queued for reasoning.`,
    };
  },
});

async function fireDummySignal(
  ruleId: string,
  company: string,
): Promise<boolean> {
  const key = process.env.FIBER_API_KEY;
  if (!key) return false;
  const res = await fetch(`${FIBER_BASE}${FIRE_DUMMY_PATH}`, {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ ruleId, company }),
  });
  return res.ok;
}

export const recordReplay = internalMutation({
  args: {
    companyName: v.string(),
    ruleId: v.string(),
    ruleName: v.string(),
    fired: v.boolean(),
    now: v.number(),
  },
  handler: async (ctx, { companyName, ruleId, ruleName, fired, now }) => {
    const runId = await ctx.db.insert("runs", {
      type: "live",
      status: "signal-fired",
      total: 1,
      done: 0,
      failed: 0,
      startedAt: now,
    });
    await ctx.db.insert("log", {
      runId,
      level: "info",
      message: `${fired ? "Fired" : "Simulated"} trigger ${ruleId} (${ruleName}) for ${companyName}`,
      ts: now,
    });
    return runId;
  },
});
