import type { EnrichedLead } from "@/lib/schemas";

// Orange Slice integration. Bolt-on at the send layer — the whole SDK stays behind
// these two methods so the core pipeline never sees it. Both are TOTAL (never throw):
// when OS is unconfigured or errors, execute() returns a non-"sent" status and the
// caller (convex/sendEmail.ts) falls back to Gmail (lib/mail.ts) — the demo survives
// either way.
//
// ponytail: the REST shape below is a best guess from the Orange Slice spiel (no public
// docs in hand). It's env-driven so you can correct it WITHOUT a code change once you
// confirm the real endpoint/auth in the OS Slack: set ORANGESLICE_BASE and, if the path
// differs, ORANGESLICE_SEND_PATH. Auth is assumed Bearer ORANGESLICE_API_KEY.

export type OutreachChannel = "email" | "x_dm" | "call";

const BASE = process.env.ORANGESLICE_BASE ?? "https://api.orangeslice.ai";
const SEND_PATH = process.env.ORANGESLICE_SEND_PATH ?? "/v1/outreach/send";

function key(): string | undefined {
  return process.env.ORANGESLICE_API_KEY;
}

type ExecuteResult = {
  channel: OutreachChannel;
  status: "sent" | "failed" | "skipped";
  messageId?: string;
  providerLog?: unknown;
};

// Execution: ship an approved card on the channel the prospect actually lives on.
export async function execute(a: {
  to: { email?: string; xHandle?: string; phone?: string };
  subject: string;
  body: string;
  pngUrl?: string;
  preferChannel?: OutreachChannel;
}): Promise<ExecuteResult> {
  const channel = a.preferChannel ?? "email";
  const apiKey = key();

  // Unconfigured, or no address for the chosen channel → let the caller use Gmail.
  if (!apiKey) return { channel, status: "skipped" };
  const recipient = a.to.email ?? a.to.xHandle ?? a.to.phone;
  if (!recipient) return { channel, status: "skipped" };

  try {
    const res = await fetch(`${BASE}${SEND_PATH}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel,
        to: a.to,
        subject: a.subject,
        body: a.body,
        attachmentUrl: a.pngUrl,
      }),
    });

    const log: unknown = await res.json().catch(() => ({}));
    if (!res.ok) return { channel, status: "failed", providerLog: log };

    const record =
      log && typeof log === "object" ? (log as Record<string, unknown>) : {};
    return {
      channel:
        typeof record.channel === "string"
          ? (record.channel as OutreachChannel)
          : channel,
      status: "sent",
      messageId: typeof record.id === "string" ? record.id : undefined,
      providerLog: log,
    };
  } catch (err: unknown) {
    return {
      channel,
      status: "failed",
      providerLog: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

// Waterfall contact enrichment: fill a verified email/phone when Fiber returned none.
// Implemented but intentionally NOT wired into the Fiber enrich loop yet (the stub keeps
// OS out of the core path). Wire it in lib/fiber.ts's discoverAndEnrich when ready.
// ponytail: returns {} until a contact-enrich endpoint is confirmed — no best-guess body
// here because, unlike send, there's no Gmail fallback to absorb a wrong shape.
export async function enrichFallback(
  _lead: EnrichedLead,
): Promise<{ email?: string; phone?: string; channels?: OutreachChannel[] }> {
  return {};
}
