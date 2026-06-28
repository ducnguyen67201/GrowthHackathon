import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { socialPostV } from "./validators";

// Branch A — people persistence (incl. socialPosts).
export const upsert = mutation({
  args: {
    companyId: v.id("companies"),
    fiberId: v.string(),
    name: v.string(),
    title: v.optional(v.string()),
    email: v.optional(v.string()),
    linkedin: v.optional(v.string()),
    socialPosts: v.array(socialPostV),
  },
  handler: async (ctx, a) => {
    const existing = await ctx.db
      .query("people")
      .withIndex("by_company", (q) => q.eq("companyId", a.companyId))
      .filter((q) => q.eq(q.field("fiberId"), a.fiberId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...a, enrichedAt: Date.now() });
      return existing._id;
    }
    return ctx.db.insert("people", { ...a, enrichedAt: Date.now() });
  },
});
