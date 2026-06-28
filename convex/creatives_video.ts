import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Branch G (feat/video-hero). Video write-side, kept in its own file (NOT creatives_write.ts)
// per Wave-2 risk #5 to avoid colliding with E/H. The heavy Remotion render runs in a
// script (scripts/make-video.ts) — Convex only hands out the upload URL (reuse
// creatives_write.generateUploadUrl), joins the lead for the renderer, and flips the type.

// Assemble the EnrichedLead-shaped data the renderer needs from the stored company+person.
export const getForVideo = query({
  args: { creativeId: v.id("creatives") },
  handler: async (ctx, { creativeId }) => {
    const creative = await ctx.db.get(creativeId);
    if (!creative) throw new Error(`creative ${creativeId} not found`);
    const company = await ctx.db.get(creative.companyId);
    if (!company) throw new Error(`company ${creative.companyId} not found`);
    const person = await ctx.db.get(creative.personId);
    if (!person) throw new Error(`person ${creative.personId} not found`);

    return {
      reasoning: creative.reasoning,
      anchorFact: creative.anchorFact,
      lead: {
        fiberId: person.fiberId,
        name: person.name,
        company: company.name,
        domain: company.domain,
        title: person.title,
        email: person.email,
        linkedin: person.linkedin,
        firmoSignals: company.firmoSignals,
        socialPosts: person.socialPosts,
        logoUrl: company.logoUrl,
        screenshotUrl: company.screenshotUrl,
      },
    };
  },
});

// Clone of creatives_write.setArtifact, but flips artifactType to "video".
export const setVideoArtifact = mutation({
  args: {
    creativeId: v.id("creatives"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { creativeId, storageId }) => {
    await ctx.db.patch(creativeId, {
      artifactStorageId: storageId,
      artifactType: "video",
    });
  },
});
