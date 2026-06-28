import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { draftReply } from "../lib/reply";

// Branch D (feat/send-reply): the Reply Cyborg. `pasteReply` is the must-always-work
// demo path (paste an inbound reply, get a contextual draft). IMAP auto-poll is
// skipped on purpose — it's the flaky optional; the paste path covers the loop.
// OpenAI runs in Convex's default runtime, so no "use node" needed here.

// Store an inbound reply and flag the send as replied.
export const record = mutation({
  args: { sendId: v.id("sends"), inboundText: v.string() },
  handler: async (ctx, { sendId, inboundText }) => {
    const send = await ctx.db.get(sendId);
    if (!send) throw new Error(`send ${sendId} not found`);
    if (!send.repliedAt) await ctx.db.patch(sendId, { repliedAt: Date.now() });
    return await ctx.db.insert("replies", {
      sendId,
      inboundText,
      receivedAt: Date.now(),
      draftStatus: "drafted",
    });
  },
});

// Attach the AI-drafted follow-up to a reply.
export const setDraft = mutation({
  args: {
    replyId: v.id("replies"),
    draftReply: v.string(),
    intent: v.string(),
    suggestedAction: v.string(),
  },
  handler: async (
    ctx,
    { replyId, draftReply: text, intent, suggestedAction },
  ) => {
    await ctx.db.patch(replyId, { draftReply: text, intent, suggestedAction });
  },
});

// The original reasoning + copy that earned this reply — context for the draft.
export const context = query({
  args: { sendId: v.id("sends") },
  handler: async (ctx, { sendId }) => {
    const send = await ctx.db.get(sendId);
    if (!send) throw new Error(`send ${sendId} not found`);
    const creative = await ctx.db.get(send.creativeId);
    if (!creative) throw new Error(`creative ${send.creativeId} not found`);
    const idx = creative.chosenCopyIndex ?? 0;
    const variant = creative.copyVariants[idx];
    const copy = variant ? `${variant.subject}\n\n${variant.body}` : "";
    return { reasoning: creative.reasoning, copy };
  },
});

// Paste-a-reply: record it, draft the follow-up, save the draft. Always-on fallback.
export const pasteReply = action({
  args: { sendId: v.id("sends"), inboundText: v.string() },
  handler: async (
    ctx,
    { sendId, inboundText },
  ): Promise<{
    replyId: string;
    draftReply: string;
    intent: string;
    suggestedAction: string;
  }> => {
    const replyId = await ctx.runMutation(api.replies.record, {
      sendId,
      inboundText,
    });
    const ctxData = await ctx.runQuery(api.replies.context, { sendId });
    const draft = await draftReply(inboundText, ctxData);
    await ctx.runMutation(api.replies.setDraft, { replyId, ...draft });
    return { replyId, ...draft };
  },
});
