import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

// Branch D (feat/send-reply). Open-tracking pixel: GET /pixel/{sendId} logs the open
// (best-effort) and always returns a 1x1 transparent GIF. id == sends._id.
// ponytail: reference the mutation by name (makeFunctionReference) so this route in
// app/ doesn't depend on convex/_generated, which app's tsc pass can't see.

const GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

const markOpened = makeFunctionReference<"mutation">("sends:markOpened");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (url) {
    try {
      await new ConvexHttpClient(url).mutation(markOpened, { sendId: id });
    } catch {
      // Never let tracking failure break image delivery.
    }
  }
  return new Response(GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
