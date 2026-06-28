import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Branch B (feat/sdr-brain). Serves a creative's rendered PNG. We resolve the creative
// to its signed Convex storage URL and redirect there — no proxying bytes through Next.
// The dashboard (C) points <img src="/api/artifact/{id}"> at this.

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!convexUrl) {
    return new Response("NEXT_PUBLIC_CONVEX_URL not set", { status: 503 });
  }
  const { id } = await params;
  const client = new ConvexHttpClient(convexUrl);
  const url = await client.query(api.creatives_write.artifactUrl, {
    creativeId: id as Id<"creatives">,
  });
  if (!url) {
    return new Response("artifact not found", { status: 404 });
  }
  // 302 so the browser can cache the underlying signed URL response, not the redirect.
  return Response.redirect(url, 302);
}
