import { runRetriggerLive } from "@/lib/retrigger-live";

// Reading-Minds re-aim — streams the live re-trigger beat as NDJSON over a native
// ReadableStream (no SSE lib; Node runtime — OpenAI + Convex need Node). Mirrors
// app/api/live/route.ts. Powers the "name a deal you lost" demo moment on /signals.

export async function POST(req: Request) {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return new Response("NEXT_PUBLIC_CONVEX_URL not set", { status: 503 });
  }

  const { deal } = (await req.json()) as { deal?: unknown };
  if (typeof deal !== "string" || !deal.trim()) {
    return new Response("deal required", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of runRetriggerLive(deal.trim())) {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "live re-trigger failed";
        controller.enqueue(
          encoder.encode(JSON.stringify({ stage: "error", message }) + "\n"),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    },
  });
}
