import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Branch F (feat/overnight-batch) — run checkpointing + idempotency for the
// overnight coverage script (scripts/coverage.ts). The `runs` and `log` tables are
// defined in schema.ts (Wave 0); this file only reads/writes them.

export const start = mutation({
  args: { total: v.number() },
  handler: (ctx, { total }) =>
    ctx.db.insert("runs", {
      type: "batch",
      status: "running",
      total,
      done: 0,
      failed: 0,
      startedAt: Date.now(),
    }),
});

// Increment = read-modify-write (mirrors companies.upsert's patch-by-id).
export const tick = mutation({
  args: { runId: v.id("runs"), ok: v.boolean() },
  handler: async (ctx, { runId, ok }) => {
    const run = await ctx.db.get(runId);
    if (!run) throw new Error(`tick: run ${runId} not found`);
    await ctx.db.patch(
      runId,
      ok ? { done: run.done + 1 } : { failed: run.failed + 1 },
    );
  },
});

export const finish = mutation({
  args: { runId: v.id("runs"), costCredits: v.optional(v.number()) },
  handler: (ctx, { runId, costCredits }) =>
    ctx.db.patch(runId, { status: "done", costCredits }),
});

// Idempotency: a company already carrying a creative is skipped on re-run/resume.
export const hasCreativeForCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const existing = await ctx.db
      .query("creatives")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .first();
    return existing !== null;
  },
});

export const logLine = mutation({
  args: {
    runId: v.optional(v.id("runs")),
    companyId: v.optional(v.id("companies")),
    level: v.string(),
    message: v.string(),
  },
  handler: (ctx, a) => ctx.db.insert("log", { ...a, ts: Date.now() }),
});
