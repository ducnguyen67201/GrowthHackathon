import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  Reasoning,
  Source,
  CopyVariant,
  type EnrichedLead,
  type ReasonResult,
} from "@/lib/schemas";

// Branch B (feat/sdr-brain) — THE PRODUCT. reason() must produce a sharp,
// source-grounded chain that picks a NON-obvious angle. If it reads generic, fix
// the prompt before anything downstream matters (Gate 1).

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-2024-08-06";
const SKIP_BELOW = 0.5; // contract: confidence < 0.5 → skip the lead

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

// OpenAI structured outputs need an OBJECT root (no top-level union) and required,
// non-optional fields — so this API-facing schema differs slightly from ReasonResult.
// We map it back to the contract type after parsing (this IS the Zod boundary).
const ReasonResponse = z.object({
  reasoning: Reasoning,
  anchorFact: z.string(),
  sources: z.array(Source.extend({ url: z.string().nullable() })),
});

const CopyResponse = z.object({ variants: z.array(CopyVariant) });

function leadContext(lead: EnrichedLead): string {
  const posts = lead.socialPosts
    .map(
      (p, i) =>
        `  [post ${i}] (${p.platform}${p.postedAt ? `, ${p.postedAt}` : ""}) ${p.text} <${p.url}>`,
    )
    .join("\n");
  return [
    `name: ${lead.name}`,
    lead.title ? `title: ${lead.title}` : null,
    `company: ${lead.company}`,
    lead.domain ? `domain: ${lead.domain}` : null,
    `firmographic signals: ${JSON.stringify(lead.firmoSignals)}`,
    posts ? `recent posts:\n${posts}` : "recent posts: (none)",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function reason(lead: EnrichedLead): Promise<ReasonResult> {
  const system = [
    "You are a sharp B2B SDR researcher. From the lead's REAL data, build a reasoning",
    "chain that earns a reply. Every step must trace to a cited field or post — never invent facts.",
    "Steps: saw (quote/cite a specific real field or post) → inferred (what it implies) →",
    "pain (the concrete problem they feel now) → angle (a CONCRETE opening tied to the specific signal —",
    "not a vague promise like 'leveraging deep insights' or 'tailored outreach'; name the actual thing) →",
    "whyThisAngle (MUST explicitly contrast and reject the obvious angle, e.g. 'congrats on",
    "the raise / the new role / the launch' — explain why your angle is sharper) → confidence (0..1).",
    "anchorFact: the single most specific, verifiable hook (a real quote or number).",
    "sources: one entry per field/post you actually used (field name, the value, url if it has one;",
    "url null when the field has none). If the data is too thin for a non-generic angle, set confidence below 0.5.",
  ].join(" ");

  const completion = await client().beta.chat.completions.parse({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: leadContext(lead) },
    ],
    response_format: zodResponseFormat(ReasonResponse, "reason"),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("reason: model returned no structured output");

  if (parsed.reasoning.confidence < SKIP_BELOW) {
    return {
      skip: true,
      why: `confidence ${parsed.reasoning.confidence.toFixed(2)} < ${SKIP_BELOW}`,
    };
  }

  return {
    skip: false,
    reasoning: parsed.reasoning,
    anchorFact: parsed.anchorFact,
    sources: parsed.sources.map((s) => ({
      field: s.field,
      value: s.value,
      ...(s.url ? { url: s.url } : {}),
    })),
  };
}

export async function writeCopy(
  r: Reasoning,
  lead: EnrichedLead,
): Promise<CopyVariant[]> {
  const system = [
    "Write 2 cold-email variants for this lead. Warm, human, specific — open on the chosen angle,",
    "reference the real signal below, no fluff, no 'I hope this finds you well', no fake personalization.",
    "HARD RULE: reference ONLY the real signal provided. NEVER claim research, data, insights, or",
    "knowledge you were not given — no 'I've looked into your projects', no 'I have insights about X',",
    "no invented specifics. If you have no concrete fact for a sentence, speak to their stated situation,",
    "not a fabricated capability of yours.",
    "Subjects lowercase and conversational. Bodies 2-4 short sentences ending in a low-friction ask.",
    "Both variants share the angle but differ in opening and ask.",
  ].join(" ");

  const user = [
    `lead: ${lead.name}${lead.title ? `, ${lead.title}` : ""} at ${lead.company}`,
    `the real signal you may reference (cite ONLY this): ${r.saw}`,
    `angle: ${r.angle}`,
    `pain: ${r.pain}`,
    `why this angle: ${r.whyThisAngle}`,
  ].join("\n");

  const completion = await client().beta.chat.completions.parse({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: zodResponseFormat(CopyResponse, "copy"),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed)
    throw new Error("writeCopy: model returned no structured output");
  return parsed.variants;
}
