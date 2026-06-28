import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Branch D (feat/send-reply): V8 query + mutations behind the send flow.
// The actual SMTP send lives in `sendEmail.ts` ("use node" — Node-only nodemailer);
// Convex forbids mutations in a "use node" module, so the DB writes live here.

// What the send action needs to build + transmit an email for one creative.
export const getForSend = query({
  args: { creativeId: v.id("creatives") },
  handler: async (ctx, { creativeId }) => {
    const creative = await ctx.db.get(creativeId);
    if (!creative) throw new Error(`creative ${creativeId} not found`);
    if (creative.status !== "approved" && creative.status !== "sent") {
      throw new Error(
        `creative ${creativeId} is '${creative.status}', not approved`,
      );
    }
    const person = await ctx.db.get(creative.personId);
    if (!person) throw new Error(`person ${creative.personId} not found`);
    // Re-trigger seed people have no email — synthesize a stable one from name + domain.
    // Real delivery to fake prospects should use SEND_TO_OVERRIDE; dry-run never sends.
    const company = await ctx.db.get(creative.companyId);
    const first = person.name.trim().split(/\s+/)[0] ?? "contact";
    const handle = first.toLowerCase().replace(/[^a-z0-9]/g, "");
    const to = person.email ?? `${handle || "contact"}@${company?.domain ?? "example.com"}`;

    const idx = creative.chosenCopyIndex ?? 0;
    const variant = creative.copyVariants[idx];
    if (!variant)
      throw new Error(`creative ${creativeId} has no copy variant at ${idx}`);

    const pngUrl = creative.artifactStorageId
      ? ((await ctx.storage.getUrl(creative.artifactStorageId)) ?? undefined)
      : undefined;

    return {
      to,
      subject: variant.subject,
      body: variant.body,
      pngUrl,
    };
  },
});

// Insert the send row first so the open-pixel URL can carry its id.
export const record = mutation({
  args: {
    creativeId: v.id("creatives"),
    to: v.string(),
    subject: v.string(),
    channel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sends", {
      creativeId: args.creativeId,
      to: args.to,
      subject: args.subject,
      channel: args.channel ?? "email",
      sentAt: Date.now(),
    });
  },
});

// Email left the building: stamp the provider messageId, flip the creative to sent.
export const complete = mutation({
  args: { sendId: v.id("sends"), messageId: v.string() },
  handler: async (ctx, { sendId, messageId }) => {
    const send = await ctx.db.get(sendId);
    if (!send) throw new Error(`send ${sendId} not found`);
    await ctx.db.patch(sendId, { messageId });
    await ctx.db.patch(send.creativeId, { status: "sent" });
  },
});

// Called by the tracking-pixel route. Idempotent: first open wins.
export const markOpened = mutation({
  args: { sendId: v.id("sends") },
  handler: async (ctx, { sendId }) => {
    const send = await ctx.db.get(sendId);
    if (!send || send.openedAt) return;
    await ctx.db.patch(sendId, { openedAt: Date.now() });
  },
});
