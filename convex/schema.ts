import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { reasoningV, socialPostV, sourceV, copyVariantV } from "./validators";

// THE INTEGRATION CONTRACT. Defined once in Wave 0. Feature branches read/write
// these tables but never edit this file (additive-only, coordinated if ever needed).
export default defineSchema({
  companies: defineTable({
    fiberId: v.string(),
    name: v.string(),
    domain: v.optional(v.string()),
    firmoSignals: v.any(),
    signalSource: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    screenshotUrl: v.optional(v.string()),
    enrichedAt: v.number(),
    raw: v.optional(v.any()),
  }).index("by_fiberId", ["fiberId"]),

  people: defineTable({
    companyId: v.id("companies"),
    fiberId: v.string(),
    name: v.string(),
    title: v.optional(v.string()),
    email: v.optional(v.string()),
    linkedin: v.optional(v.string()),
    socialPosts: v.array(socialPostV),
    enrichedAt: v.number(),
    raw: v.optional(v.any()),
  }).index("by_company", ["companyId"]),

  creatives: defineTable({
    companyId: v.id("companies"),
    personId: v.id("people"),
    reasoning: reasoningV,
    anchorFact: v.string(),
    sources: v.array(sourceV),
    artifactStorageId: v.optional(v.id("_storage")),
    artifactType: v.union(v.literal("image"), v.literal("video")),
    copyVariants: v.array(copyVariantV),
    chosenCopyIndex: v.optional(v.number()),
    status: v.union(
      v.literal("draft"),
      v.literal("approved"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    runId: v.optional(v.id("runs")),
    createdAt: v.number(),
    // Reading-Minds re-aim (additive): a re-trigger creative carries its score so the
    // board can rank dead-pipeline accounts. Absent on cold-path creatives.
    retriggerScore: v.optional(v.number()),
    retriggerBreakdown: v.optional(v.any()),
    externalSignal: v.optional(v.string()),
    lostDealId: v.optional(v.id("lostDeals")),
  })
    .index("by_status", ["status"])
    .index("by_company", ["companyId"]),

  // --- Reading-Minds re-aim: the dead-pipeline input the engine reads (additive) ---

  // A closed-lost deal. First-party signal (seed/CRM) — Fiber can't know who YOU lost.
  lostDeals: defineTable({
    account: v.string(),
    contact: v.string(),
    title: v.optional(v.string()),
    email: v.optional(v.string()),
    domain: v.optional(v.string()),
    lostReason: v.string(),
    lostDate: v.string(), // ISO yyyy-mm-dd
    value: v.optional(v.number()), // deal ACV ($) — drives "recovered pipeline" hero
    transcript: v.optional(v.string()),
    // the external "what changed since" trigger (e.g. "champion just became VP Eng").
    // Seeded for a deterministic demo; swap to a live lib/fiber.ts lookup post-hackathon.
    externalSignal: v.optional(v.string()),
    externalSignalType: v.optional(v.string()), // Fiber trigger: funding_round, hiring, champion_job_change…
    transcriptDate: v.optional(v.string()), // when the call that surfaced the objection happened
    // links to company/person rows so a re-trigger creative (which requires them) and
    // the artifact renderer reuse the existing lead shape.
    companyId: v.optional(v.id("companies")),
    personId: v.optional(v.id("people")),
    // filled by extractObjection() — kept on the row so the board shows the read
    objection: v.optional(v.string()),
    objectionCategory: v.optional(v.string()),
    objectionCluster: v.optional(v.string()),
    // set by the autonomous analytics pass (convex/pipeline.ts) once it has analyzed the deal.
    // Null → the board shows "⟳ analyzing…".
    analyzedAt: v.optional(v.number()),
    // the LLM's grounded one-line read for THIS deal (why it's worth a call now / the angle).
    analysisInsight: v.optional(v.string()),
  }),

  // What shipped recently — the internal trigger an objection can dissolve against.
  changelog: defineTable({
    feature: v.string(),
    description: v.string(),
    shippedAt: v.string(), // ISO yyyy-mm-dd
    solves: v.array(v.string()), // objection tags this feature resolves
  }),

  // Re-won deals — their objection text seeds the "continuous learning" centroid.
  wonOutcomes: defineTable({
    account: v.string(),
    objection: v.string(),
    reWonAt: v.string(),
  }),

  sends: defineTable({
    creativeId: v.id("creatives"),
    to: v.string(),
    subject: v.string(),
    messageId: v.optional(v.string()),
    channel: v.string(),
    sentAt: v.number(),
    openedAt: v.optional(v.number()),
    repliedAt: v.optional(v.number()),
  }).index("by_creative", ["creativeId"]),

  replies: defineTable({
    sendId: v.id("sends"),
    inboundText: v.string(),
    receivedAt: v.number(),
    draftReply: v.optional(v.string()),
    intent: v.optional(v.string()),
    suggestedAction: v.optional(v.string()),
    draftStatus: v.union(
      v.literal("drafted"),
      v.literal("approved"),
      v.literal("sent"),
    ),
  }).index("by_send", ["sendId"]),

  runs: defineTable({
    type: v.union(v.literal("live"), v.literal("batch")),
    status: v.string(),
    total: v.number(),
    done: v.number(),
    failed: v.number(),
    costCredits: v.optional(v.number()),
    startedAt: v.number(),
  }),

  log: defineTable({
    runId: v.optional(v.id("runs")),
    companyId: v.optional(v.id("companies")),
    level: v.string(),
    message: v.string(),
    ts: v.number(),
  }),
});
