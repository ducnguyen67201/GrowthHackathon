import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import {
  RetriggerMatch,
  type ChangelogItem,
  type Objection,
  type Reasoning,
  type RetriggerScore,
} from "@/lib/schemas";

// Reading-Minds re-aim — THE signal. Given an objection (why they died), does any
// shipped feature dissolve it? Then score every dead account so the board ranks who's
// ripe today. match = LLM (mirrors lib/agents.ts); score = pure (testable, transparent).

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-2024-08-06";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

// --- the match (LLM) ---

export async function matchRetrigger(
  objection: Objection,
  changelog: ChangelogItem[],
  externalSignal?: string,
): Promise<RetriggerMatch> {
  const system = [
    "You decide whether a lost B2B deal is now re-triggerable. Given the objection that",
    "killed the deal and a list of shipped features, judge: does any shipped feature genuinely",
    "RESOLVE this exact objection? Be strict — a vague or partial overlap is NOT a match.",
    "If matched, name the single best `feature` verbatim and give a one-sentence `why` that ties",
    "the feature to the objection. If nothing resolves it, matched=false, feature=\"\".",
    "Never claim a feature that isn't in the list.",
  ].join(" ");

  const changelogList = changelog
    .map((c) => `- ${c.feature} (shipped ${c.shippedAt}): ${c.description} [solves: ${c.solves.join(", ")}]`)
    .join("\n");
  const user = [
    `objection: ${objection.objection} (category: ${objection.category})`,
    `their words: "${objection.quote}"`,
    externalSignal ? `external change since: ${externalSignal}` : null,
    `shipped features:\n${changelogList}`,
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await client().beta.chat.completions.parse({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: zodResponseFormat(RetriggerMatch, "match"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("matchRetrigger: no structured output");
  return parsed;
}

// --- the score (PURE — no API; this is what the smoke test asserts) ---

// weights sum to 1 → score stays in [0,1]. Internal "we shipped it" dominates; external
// signal + recency + learned similarity refine the ranking.
export const W_SOLVED = 0.4;
export const W_EXTERNAL = 0.25;
export const W_RECENCY = 0.15;
export const W_SIM = 0.2;

const RECENCY_HALFLIFE_MONTHS = 12;
const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// newer loss = warmer to re-engage. exp decay on age; invalid/future date → 0.
export function recencyDecay(lostDate: string, now: number): number {
  const lostMs = Date.parse(lostDate);
  if (Number.isNaN(lostMs)) return 0;
  const ageMonths = (now - lostMs) / MS_PER_MONTH;
  if (ageMonths < 0) return 0;
  return Math.exp(-ageMonths / RECENCY_HALFLIFE_MONTHS);
}

export function scoreRetrigger(input: {
  solved: boolean;
  externalSignalStrength: number; // 0..1
  lostDate: string;
  simToWon: number; // 0..1
  now: number;
}): RetriggerScore {
  const breakdown = {
    solved: W_SOLVED * (input.solved ? 1 : 0),
    external: W_EXTERNAL * clamp01(input.externalSignalStrength),
    recency: W_RECENCY * recencyDecay(input.lostDate, input.now),
    simToWon: W_SIM * clamp01(input.simToWon),
  };
  const score =
    breakdown.solved + breakdown.external + breakdown.recency + breakdown.simToWon;
  return { score: clamp01(score), breakdown };
}

// --- the bridge: a re-trigger becomes a normal Reasoning, so the ENTIRE existing
// downstream (writeCopy → renderArtifact → send → reply) reuses unchanged. ---

export function buildRetriggerReasoning(args: {
  deal: { account: string; contact: string; lostDate: string };
  objection: Objection;
  match: RetriggerMatch;
  externalSignal?: string;
  score: number;
}): { reasoning: Reasoning; anchorFact: string } {
  const { deal, objection, match, externalSignal, score } = args;
  const angle = externalSignal
    ? `We shipped ${match.feature} — and ${externalSignal}.`
    : `We shipped ${match.feature}.`;
  return {
    reasoning: {
      saw: `${deal.account} passed on ${deal.lostDate}: "${objection.quote}"`,
      inferred: `Deal died on ${objection.category} (${objection.objection}).`,
      pain: objection.objection,
      angle,
      whyThisAngle: `${match.why} The obvious move is a generic "checking back in" — this returns with the specific reason they said no, now resolved.`,
      confidence: score,
    },
    anchorFact: `Said no for "${objection.objection}" — ${match.feature} now ships.`,
  };
}
