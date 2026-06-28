import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

// Branch D (feat/send-reply). The Reply Cyborg: given an inbound reply plus the
// ORIGINAL reasoning + copy that earned it, classify intent and draft the next
// message in the same voice. Structured output so the draft is always parseable.

const ReplyDraft = z.object({
  intent: z
    .string()
    .describe(
      "the prospect's intent in one short phrase, e.g. 'interested — wants pricing', 'objection: timing', 'not now', 'wrong person'",
    ),
  suggestedAction: z
    .string()
    .describe(
      "what the human SDR should do next, one short phrase, e.g. 'book a call', 'send pricing', 'nurture in 30d', 'mark dead'",
    ),
  draftReply: z
    .string()
    .describe(
      "the full follow-up email body, warm and specific, referencing the original angle — no greeting boilerplate, no signature",
    ),
});

export async function draftReply(
  inbound: string,
  ctx: { reasoning: unknown; copy: string },
): Promise<{ draftReply: string; intent: string; suggestedAction: string }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set — needed for draftReply");
  }
  const client = new OpenAI();

  const completion = await client.beta.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are an AI SDR writing the follow-up to a prospect's reply. Stay in the exact angle and voice of the original outreach. Be concise, human, and specific — never generic. Move the conversation one concrete step forward.",
      },
      {
        role: "user",
        content: [
          `ORIGINAL REASONING (why we reached out): ${JSON.stringify(ctx.reasoning)}`,
          `ORIGINAL EMAIL WE SENT:\n${ctx.copy}`,
          `THEIR REPLY:\n${inbound}`,
          "Classify their intent, suggest the next action, and draft the follow-up reply.",
        ].join("\n\n"),
      },
    ],
    response_format: zodResponseFormat(ReplyDraft, "reply"),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("draftReply: model returned no parsed output");
  }
  return parsed;
}
