"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { sendCreative } from "../lib/mail";

// Branch D (feat/send-reply). Node action (nodemailer needs net/tls). Orchestrates:
// load creative -> insert send row -> embed pixel -> send -> stamp messageId + status.
// Lives apart from sends.ts because a "use node" module can't hold mutations.
export const send = action({
  args: { creativeId: v.id("creatives") },
  handler: async (
    ctx,
    { creativeId },
  ): Promise<{ sendId: string; messageId: string }> => {
    const base = process.env.APP_BASE_URL;
    if (!base)
      throw new Error(
        "APP_BASE_URL not set — needed to build the open-tracking pixel",
      );

    const payload = await ctx.runQuery(api.sends.getForSend, { creativeId });
    const sendId = await ctx.runMutation(api.sends.record, {
      creativeId,
      to: payload.to,
      subject: payload.subject,
    });

    const { messageId } = await sendCreative({
      to: payload.to,
      subject: payload.subject,
      body: payload.body,
      pngUrl: payload.pngUrl,
      pixelUrl: `${base.replace(/\/$/, "")}/pixel/${sendId}`,
    });

    await ctx.runMutation(api.sends.complete, { sendId, messageId });
    return { sendId, messageId };
  },
});
