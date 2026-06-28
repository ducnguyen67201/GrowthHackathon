"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { sendCreative } from "../lib/mail";
import { execute as orangeSliceExecute } from "../lib/orangeslice";

// Branch D (feat/send-reply). Node action (nodemailer needs net/tls). Orchestrates:
// load creative -> [Orange Slice execute | Gmail fallback] -> stamp messageId + status.
// Lives apart from sends.ts because a "use node" module can't hold mutations.
export const send = action({
  args: { creativeId: v.id("creatives"), to: v.optional(v.string()) },
  handler: async (
    ctx,
    { creativeId, to: toArg },
  ): Promise<{ sendId: string; messageId: string; channel: string }> => {
    const payload = await ctx.runQuery(api.sends.getForSend, { creativeId });

    // Recipient picker: an explicit address from the UI means "actually deliver this to
    // me" — a real send to that inbox, bypassing dry-run. This is the live test path.
    const explicitTo =
      typeof toArg === "string" && toArg.trim() ? toArg.trim() : null;

    // Demo dry-run: skip real delivery but still record + flip the creative to
    // sent, so the funnel resolves green without Gmail / Orange Slice creds.
    // Enable with `npx convex env set SEND_DRY_RUN 1`. Skipped when a recipient is picked.
    if (!explicitTo && process.env.SEND_DRY_RUN) {
      const sendId = await ctx.runMutation(api.sends.record, {
        creativeId,
        to: payload.to,
        subject: payload.subject,
        channel: "dry-run",
      });
      const messageId = `dry-run:${sendId}`;
      await ctx.runMutation(api.sends.complete, { sendId, messageId });
      return { sendId, messageId, channel: "dry-run" };
    }

    // Picked recipient wins; then the SEND_TO_OVERRIDE env default; then the prospect.
    const to = explicitTo ?? process.env.SEND_TO_OVERRIDE ?? payload.to;

    // Orange Slice first: it owns delivery + its own tracking, so it never sees our
    // open-pixel. Anything but a clean "sent" (incl. OS unconfigured) falls to Gmail.
    const os = await orangeSliceExecute({
      to: { email: to },
      subject: payload.subject,
      body: payload.body,
      pngUrl: payload.pngUrl,
      preferChannel: "email",
    });

    if (os.status === "sent") {
      const channel = `orangeslice:${os.channel}`;
      const sendId = await ctx.runMutation(api.sends.record, {
        creativeId,
        to,
        subject: payload.subject,
        channel,
      });
      const messageId = os.messageId ?? `orangeslice:${sendId}`;
      await ctx.runMutation(api.sends.complete, { sendId, messageId });
      return { sendId, messageId, channel };
    }

    // Fallback: Gmail with an open-tracking pixel. Record first so the pixel carries
    // the send id. APP_BASE_URL is only needed on this path, not for Orange Slice.
    const base = process.env.APP_BASE_URL;
    if (!base)
      throw new Error(
        "APP_BASE_URL not set — needed to build the open-tracking pixel",
      );

    const sendId = await ctx.runMutation(api.sends.record, {
      creativeId,
      to,
      subject: payload.subject,
    });

    const { messageId } = await sendCreative({
      to,
      subject: payload.subject,
      body: payload.body,
      pngUrl: payload.pngUrl,
      pixelUrl: `${base.replace(/\/$/, "")}/pixel/${sendId}`,
    });

    await ctx.runMutation(api.sends.complete, { sendId, messageId });
    return { sendId, messageId, channel: "email" };
  },
});
