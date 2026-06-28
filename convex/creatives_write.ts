import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { reasoningV, sourceV, copyVariantV } from "./validators";

// Branch B (feat/sdr-brain) — write side of `creatives`. The brain reasons + writes
// copy, renders the artifact (lib/artifact.tsx) outside Convex, uploads the PNG via
// generateUploadUrl, then attaches it with setArtifact. Reads live in creatives_read.ts (C).

export const create = mutation({
  args: {
    companyId: v.id("companies"),
    personId: v.id("people"),
    reasoning: reasoningV,
    anchorFact: v.string(),
    sources: v.array(sourceV),
    copyVariants: v.array(copyVariantV),
    runId: v.optional(v.id("runs")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("creatives", {
      companyId: args.companyId,
      personId: args.personId,
      reasoning: args.reasoning,
      anchorFact: args.anchorFact,
      sources: args.sources,
      copyVariants: args.copyVariants,
      artifactType: "image",
      status: "draft",
      runId: args.runId,
      createdAt: Date.now(),
    });
  },
});

// Upload flow for the rendered PNG: the caller POSTs the bytes to this URL, gets a
// storageId back, then calls setArtifact. (Convex storage can't be written from outside
// without a generated upload URL.)
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const setArtifact = mutation({
  args: {
    creativeId: v.id("creatives"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.creativeId, {
      artifactStorageId: args.storageId,
      artifactType: "image",
    });
  },
});

// Used by app/api/artifact/[id]/route.ts to resolve a creative to its signed PNG URL.
export const artifactUrl = query({
  args: { creativeId: v.id("creatives") },
  handler: async (ctx, args) => {
    const creative = await ctx.db.get(args.creativeId);
    if (!creative?.artifactStorageId) return null;
    return await ctx.storage.getUrl(creative.artifactStorageId);
  },
});
