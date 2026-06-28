import OpenAI from "openai";

// Streams a prep-chat reply as plain text. The rep is prepping to re-engage a
// prospect; we hand the model the full dossier (enrichment signal, chosen angle,
// the draft, and the call transcript when present) so its answers are grounded,
// not generic. Node runtime (OpenAI SDK). Mirrors the text-stream shape of /api/send.

type ChatMsg = { role: "user" | "assistant"; content: string };

const SYSTEM = [
  "You are an AI sales strategist helping a rep prep to re-engage a prospect.",
  "You have the full dossier below: the enrichment signal, the model's chosen angle,",
  "the drafted email, and (when present) the call transcript where the deal died.",
  "Help the rep prep: anticipate objections, give concrete talking points, role-play",
  "the prospect, or sharpen the message. Be concise, specific, and grounded in the",
  "dossier — never generic. Use short paragraphs or tight bullets.",
].join(" ");

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response("OPENAI_API_KEY not set", { status: 503 });
  }

  const { context, messages } = (await req.json()) as {
    context?: unknown;
    messages?: unknown;
  };
  if (typeof context !== "string" || !context.trim()) {
    return new Response("context required", { status: 400 });
  }
  // Trust nothing from the client: keep only well-formed turns, cap history.
  const history: ChatMsg[] = Array.isArray(messages)
    ? (messages as ChatMsg[])
        .filter(
          (m) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string",
        )
        .slice(-20)
    : [];
  if (history.length === 0) {
    return new Response("at least one message required", { status: 400 });
  }

  const client = new OpenAI();
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    stream: true,
    messages: [
      { role: "system", content: `${SYSTEM}\n\n=== DOSSIER ===\n${context}` },
      ...history,
    ],
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "model error";
        controller.enqueue(encoder.encode(`\n\n[prep chat failed: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
