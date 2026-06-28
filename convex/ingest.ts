"use node"; // fetch + setTimeout used by lib/fiber's social-lookup poll loop

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { discoverAndEnrich } from "../lib/fiber";

// Branch A — ICP/company string → enriched lead persisted to Convex.
// Creative generation (reason→artifact) is branch B's creatives_write:generateForLead;
// call that AFTER this once B is merged. ingest only discovers + persists.
export const ingestLead = action({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    const lead = await discoverAndEnrich(query);
    // Explicit Id annotations break the action's circular type inference
    // (return type → api → this module → return type). Standard Convex remedy.
    const companyId: Id<"companies"> = await ctx.runMutation(api.companies.upsert, {
      fiberId: lead.fiberId,
      name: lead.company,
      domain: lead.domain,
      firmoSignals: lead.firmoSignals,
      logoUrl: lead.logoUrl,
      signalSource: "live",
    });
    const personId: Id<"people"> = await ctx.runMutation(api.people.upsert, {
      companyId,
      fiberId: lead.fiberId,
      name: lead.name,
      title: lead.title,
      email: lead.email,
      linkedin: lead.linkedin,
      socialPosts: lead.socialPosts,
    });
    return { companyId, personId, lead };
  },
});
