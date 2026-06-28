import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

// The director — turns a lost deal's REAL signal (their objection, in their words, + the
// thing we now ship that resolves it) into a ~4s personalized clip concept. Text-to-video
// renders FOOTAGE, not text, so the director designs a vivid VISUAL METAPHOR of THEIR exact
// blocker dissolving — the "oh, they get my problem and solved it" reaction — plus a one-line
// human caption (for the email subject / overlay). Mirrors lib/agents.ts OpenAI usage.

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

export type DealSignal = {
  account: string;
  contact?: string | null;
  title?: string | null;
  objection?: string | null;
  quote?: string | null; // their actual words (transcript / lostReason)
  fixFeature?: string | null; // what we shipped that resolves it
  fixDescription?: string | null;
  externalSignal?: string | null; // what changed on their side
  industry?: string;
};

const DirectorPlan = z.object({
  painpoint: z.string(), // the blocker, distilled to plain words
  concept: z.string(), // one-line creative idea (the metaphor)
  prompt: z.string(), // the cinematic text-to-video prompt (visuals only)
  caption: z.string(), // one short human line this prospect would feel
});
export type DirectorPlan = z.infer<typeof DirectorPlan>;

export async function directVideo(deal: DealSignal): Promise<DirectorPlan> {
  const industry = deal.industry ?? "healthcare SaaS";

  const system = [
    "You are a creative director for short, personalized B2B re-engagement videos.",
    "You get a deal the company LOST, the prospect's real objection (their own words), and the",
    "thing the company has SINCE shipped that resolves it. Design a ~4-second cinematic clip that",
    "makes THIS prospect feel SEEN — a vivid VISUAL METAPHOR for THEIR specific blocker dissolving",
    "or unlocking. Target reaction: 'oh — they understand my exact problem, and they solved it.'",
    "",
    "HARD constraints for `prompt` (text-to-video cannot render text or logos reliably):",
    "- PURE VISUALS only: subject, camera move, motion, lighting, color palette, mood.",
    "- NO text, NO words, NO logos, NO readable screens in the shot.",
    "- One continuous shot, ~4 seconds, 16:9, photoreal or premium 3D render.",
    `- On-brand for ${industry}: warm, calm, trustworthy, premium; resolve to a soft emerald "unlocked" glow.`,
    "- The metaphor MUST fit THEIR objection. Examples: compliance/SOC2/BAA → a massive vault door",
    "  swinging open to warm light; missing integration/connector → two separate conduits clicking",
    "  into one seamless flow; API too limited → a narrow pipe widening into an open lattice;",
    "  audit logging → a dark ledger lighting up line by line. Choose the best fit, don't copy these.",
    "",
    "`caption`: one short line this prospect would feel (use their name if given). Plain, human,",
    "specific to the resolved blocker. No emojis. e.g. \"Lena — the SOC2 wall just came down.\"",
  ].join("\n");

  const user = [
    `account: ${deal.account}`,
    deal.contact
      ? `contact: ${deal.contact}${deal.title ? ` (${deal.title})` : ""}`
      : null,
    `industry: ${industry}`,
    deal.objection ? `objection (why they said no): ${deal.objection}` : null,
    deal.quote ? `their words: "${deal.quote}"` : null,
    deal.fixFeature
      ? `what we shipped that resolves it: ${deal.fixFeature}${deal.fixDescription ? ` — ${deal.fixDescription}` : ""}`
      : null,
    deal.externalSignal
      ? `external change on their side: ${deal.externalSignal}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await client().beta.chat.completions.parse({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: zodResponseFormat(DirectorPlan, "director_plan"),
    temperature: 0.85,
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("director returned no plan");
  return parsed;
}
