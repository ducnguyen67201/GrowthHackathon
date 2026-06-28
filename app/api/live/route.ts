import { runLive } from "@/lib/livegen";

// Branch E (feat/live-gen). Drives the single-lead orchestrator and streams its
// progress events as NDJSON over a native ReadableStream — no SSE library, Node
// runtime (default; satori/resvg/Fiber/OpenAI all need Node, so no edge).

export async function POST(req: Request) {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return new Response("NEXT_PUBLIC_CONVEX_URL not set", { status: 503 });
  }

  const { query } = (await req.json()) as { query?: unknown };
  if (typeof query !== "string" || !query.trim()) {
    return new Response("query required", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of runLive(query.trim())) {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        }
      } catch (e) {
        // runLive already converts its own throws to an "error" event; this is the
        // last-resort guard so the stream still closes cleanly (never a 500 mid-demo).
        const message = e instanceof Error ? e.message : "live-gen failed";
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
      "cache-control": "no-store", // keep proxies from buffering the stream
    },
  });
}
