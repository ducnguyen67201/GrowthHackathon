import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Branch A — companies persistence.
export const getByFiberId = query({
  args: { fiberId: v.string() },
  handler: (ctx, a) => ctx.db.query("companies").withIndex("by_fiberId", (q) => q.eq("fiberId", a.fiberId)).unique(),
});

export const upsert = mutation({
  args: {
    fiberId: v.string(),
    name: v.string(),
    domain: v.optional(v.string()),
    firmoSignals: v.any(),
    signalSource: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    screenshotUrl: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const existing = await ctx.db.query("companies").withIndex("by_fiberId", (q) => q.eq("fiberId", a.fiberId)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...a, enrichedAt: Date.now() });
      return existing._id;
    }
    return ctx.db.insert("companies", { ...a, enrichedAt: Date.now() });
  },
});
