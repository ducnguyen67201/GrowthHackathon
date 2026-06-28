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
  })
    .index("by_status", ["status"])
    .index("by_company", ["companyId"]),

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
