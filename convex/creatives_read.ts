// Branch C (feat/dashboard): the read side of `creatives` — list (joined for display)
// plus the dashboard mutations (approve, editCopy, pickVariant). Split from
// creatives_write.ts so the brain (B) and dashboard (C) branches never collide.
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { replaceVariant } from "../lib/dashboard";

const statusV = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("sent"),
  v.literal("failed"),
);

// One realtime feed for the grid. Joins company + person and resolves the
// artifact storage URL so the client renders a card from a single subscription.
export const list = query({
  args: { status: v.optional(statusV) },
  handler: async (ctx, { status }) => {
    const rows = status
      ? await ctx.db
          .query("creatives")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .collect()
      : await ctx.db.query("creatives").order("desc").collect();

    // The dead deal carries the call transcript + objection. Most cold-path brain
    // creatives have no (or a stale, post-wipe) lostDealId, so fall back to matching
    // a lost deal by account name — that's what surfaces the transcript in the
    // pre-send review and the prep chat's context.
    // ponytail: account-name match — fine while accounts are unique; key on a real
    // company id if names ever collide.
    const lostByAccount = new Map(
      (await ctx.db.query("lostDeals").collect()).map((d) => [
        d.account.toLowerCase(),
        d,
      ]),
    );

    return Promise.all(
      rows.map(async (c) => {
        const company = await ctx.db.get(c.companyId);
        const linked = c.lostDealId ? await ctx.db.get(c.lostDealId) : null;
        return {
          ...c,
          company,
          person: await ctx.db.get(c.personId),
          lostDeal:
            linked ?? lostByAccount.get((company?.name ?? "").toLowerCase()) ?? null,
          artifactUrl: c.artifactStorageId
            ? await ctx.storage.getUrl(c.artifactStorageId)
            : null,
        };
      }),
    );
  },
});

// One creative joined with its company + person — enough to reconstruct the lead
// and re-render its artifact at send time (lib/sendgen). Storage URL not needed here.
export const get = query({
  args: { id: v.id("creatives") },
  handler: async (ctx, { id }) => {
    const c = await ctx.db.get(id);
    if (!c) return null;
    const company = await ctx.db.get(c.companyId);
    let lostDeal = c.lostDealId ? await ctx.db.get(c.lostDealId) : null;
    if (!lostDeal && company) {
      lostDeal =
        (await ctx.db
          .query("lostDeals")
          .filter((q) => q.eq(q.field("account"), company.name))
          .first()) ?? null;
    }
    return {
      ...c,
      company,
      person: await ctx.db.get(c.personId),
      lostDeal,
    };
  },
});

export const approve = mutation({
  args: { id: v.id("creatives") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "approved" });
  },
});

export const pickVariant = mutation({
  args: { id: v.id("creatives"), index: v.number() },
  handler: async (ctx, { id, index }) => {
    const creative = await ctx.db.get(id);
    if (!creative) throw new Error(`creative ${id} not found`);
    if (index < 0 || index >= creative.copyVariants.length) {
      throw new Error(
        `variant index ${index} out of range (have ${creative.copyVariants.length})`,
      );
    }
    await ctx.db.patch(id, { chosenCopyIndex: index });
  },
});

export const editCopy = mutation({
  args: {
    id: v.id("creatives"),
    index: v.number(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { id, index, subject, body }) => {
    const creative = await ctx.db.get(id);
    if (!creative) throw new Error(`creative ${id} not found`);
    const copyVariants = replaceVariant(creative.copyVariants, index, {
      subject,
      body,
    });
    await ctx.db.patch(id, { copyVariants });
  },
});
