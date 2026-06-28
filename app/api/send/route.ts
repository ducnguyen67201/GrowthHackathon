import { runSend } from "@/lib/sendgen";

// Streams the REAL send pipeline (lib/sendgen) as NDJSON over a native ReadableStream
// — same shape as app/api/live. Node runtime (default): satori/resvg + the Convex
// action all need Node, so no edge.

export async function POST(req: Request) {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return new Response("NEXT_PUBLIC_CONVEX_URL not set", { status: 503 });
  }

  const { creativeId } = (await req.json()) as { creativeId?: unknown };
  if (typeof creativeId !== "string" || !creativeId) {
    return new Response("creativeId required", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of runSend(creativeId)) {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        }
      } catch (e) {
        // runSend converts its own throws to an "error" event; last-resort guard so
        // the stream still closes cleanly instead of a 500 mid-send.
        const message = e instanceof Error ? e.message : "send failed";
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
