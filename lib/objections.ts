import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { Objection, type LostDeal } from "@/lib/schemas";

// Reading-Minds re-aim — read WHY a deal died. Mirrors lib/agents.ts: zodResponseFormat,
// OBJECT-root schema, grounded prompt (the quote MUST come from the deal's own words),
// skip-below-threshold. Never invent a reason the text doesn't support.

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-2024-08-06";
const SKIP_BELOW = 0.5;

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export type ObjectionResult =
  | { skip: true; why: string }
  | { objection: z.infer<typeof Objection>; skip: false };

function dealContext(d: LostDeal): string {
  return [
    `account: ${d.account}`,
    `contact: ${d.contact}${d.title ? `, ${d.title}` : ""}`,
    `lost on: ${d.lostDate}`,
    `stated lost reason: ${d.lostReason}`,
    d.transcript ? `call notes: ${d.transcript}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function extractObjection(d: LostDeal): Promise<ObjectionResult> {
  const system = [
    "You read closed-lost B2B deals and extract the ONE concrete reason the deal died.",
    "Rules: the `quote` MUST be copied verbatim from the deal's stated reason or call notes —",
    "never paraphrase into the quote, never invent. `objection` is a short canonical phrase",
    "(e.g. 'missing SSO/SAML', 'price too high', 'no Salesforce integration', 'not a priority this quarter').",
    "`category` is one of: auth, price, integration, timing, feature-gap, competitor, trust, other.",
    "`confidence` is how clearly the text names a real, addressable objection (0..1).",
    "If the text is too vague to name a concrete objection, set confidence below 0.5.",
  ].join(" ");

  const completion = await client().beta.chat.completions.parse({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: dealContext(d) },
    ],
    response_format: zodResponseFormat(Objection, "objection"),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("extractObjection: no structured output");
  if (parsed.confidence < SKIP_BELOW) {
    return { skip: true, why: `confidence ${parsed.confidence.toFixed(2)} < ${SKIP_BELOW}` };
  }
  return { skip: false, objection: parsed };
}

// Cluster objections into named buckets. One LLM call for the whole (small) set —
// ponytail: ~18 items fit in one prompt; no embeddings/vector-DB needed here. /graphify
// is the brain-viz amplifier, not required for the score.
const ClusterResponse = z.object({
  clusters: z.array(
    z.object({
      cluster: z.string(), // kebab name, e.g. "enterprise-auth"
      memberIndexes: z.array(z.number()),
    }),
  ),
});

export async function clusterObjections(
  objections: { objection: string; category: string }[],
): Promise<string[]> {
  if (objections.length === 0) return [];
  const system = [
    "Group these B2B sales objections into a few named clusters by underlying theme.",
    "Cluster names are short kebab-case (e.g. 'enterprise-auth', 'pricing', 'missing-integration', 'not-ready').",
    "Return clusters with the member indexes (0-based) of the objections they contain.",
    "Every objection must belong to exactly one cluster.",
  ].join(" ");
  const list = objections
    .map((o, i) => `[${i}] (${o.category}) ${o.objection}`)
    .join("\n");

  const completion = await client().beta.chat.completions.parse({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: list },
    ],
    response_format: zodResponseFormat(ClusterResponse, "clusters"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("clusterObjections: no structured output");

  // map each objection index → its cluster name; default "unclustered" if the model misses one
  const out = new Array<string>(objections.length).fill("unclustered");
  for (const c of parsed.clusters) {
    for (const idx of c.memberIndexes) {
      if (idx >= 0 && idx < out.length) out[idx] = c.cluster;
    }
  }
  return out;
}
