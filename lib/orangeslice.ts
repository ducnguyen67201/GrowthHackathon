import type { EnrichedLead } from "@/lib/schemas";

// CONTRACT (Wave 0). Branch feat/orangeslice-execution implements the bodies.
// Bolt-on at the send layer (Task 5) — lands AFTER wave-1 (A/B/C/D/H), never edits
// the same files as the core loop. Keep the whole Orange Slice SDK behind these two
// methods so the pipeline never sees it.
//
// ponytail: SDK surface unconfirmed — confirm package/MCP in the Orange Slice Slack at
// H0, wire it inside these bodies only. If execute() throws or OS is unconfigured, the
// caller falls back to lib/mail.ts (Gmail) — the demo finale survives either way.

export type OutreachChannel = "email" | "x_dm" | "call";

const ni = (n: string): never => {
  throw new Error(`not impl: ${n} — implement in branch feat/orangeslice-execution`);
};

// Waterfall: fill a verified contact when Fiber returned none. Primary stays Fiber.
export async function enrichFallback(
  _lead: EnrichedLead,
): Promise<{ email?: string; phone?: string; channels?: OutreachChannel[] }> {
  return ni("enrichFallback");
}

// Execution: ship an approved card on the channel the prospect actually lives on.
// Surface providerLog/cost the way fiber.ts surfaces chargeInfo (budget-aware beat).
export async function execute(_a: {
  to: { email?: string; xHandle?: string; phone?: string };
  subject: string;
  body: string;
  pngUrl?: string;
  preferChannel?: OutreachChannel;
}): Promise<{
  channel: OutreachChannel;
  status: "sent" | "failed" | "skipped";
  providerLog?: unknown;
}> {
  return ni("execute");
}
