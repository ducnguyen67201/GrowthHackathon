import { mutation } from "./_generated/server";

// Seed fake-but-realistic data so the dashboard (C) and send (D) branches can build
// WITHOUT waiting on the fiber (A) or brain (B) branches.
// Run AFTER `npx convex dev`:  npx convex run seed:run
export const run = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const companyId = await ctx.db.insert("companies", {
      fiberId: "seed-acme",
      name: "Acme Devtools",
      domain: "acme.dev",
      firmoSignals: { funding: "Series A $14M", headcount: 38, hiring: ["SDR", "DevRel"] },
      signalSource: "seed",
      logoUrl: undefined,
      enrichedAt: now,
    });

    const personId = await ctx.db.insert("people", {
      companyId,
      fiberId: "seed-person-1",
      name: "Jordan Lee",
      title: "Head of Growth",
      email: "jordan@acme.dev",
      linkedin: "https://linkedin.com/in/jordanlee",
      socialPosts: [
        {
          platform: "x",
          text: "Hiring our first 5 SDRs. Outbound is broken — every tool sends the same gray email. There has to be a better way.",
          url: "https://x.com/jordanlee/status/1",
          postedAt: "2026-06-24",
        },
      ],
      enrichedAt: now,
    });

    const base = {
      companyId,
      personId,
      anchorFact: "Posted that outbound is broken while hiring their first 5 SDRs",
      sources: [
        { field: "socialPost", value: "outbound is broken... same gray email", url: "https://x.com/jordanlee/status/1" },
        { field: "firmoSignals.hiring", value: "SDR x5" },
      ],
      artifactType: "image" as const,
      copyVariants: [
        { subject: "saw your post about outbound", body: "Jordan — you said every tool sends the same gray email while you're hiring 5 SDRs. That's exactly the problem we kill. 2 min?" },
        { subject: "your first 5 SDRs", body: "Ramping 5 SDRs on outbound that everyone ignores is brutal. We make each touch provably specific. Worth a look?" },
      ],
      createdAt: now,
    };

    const reasoning = {
      saw: "Jordan posted (Jun 24) that outbound is broken — 'every tool sends the same gray email' — while hiring 5 SDRs.",
      inferred: "They're scaling outbound headcount right now and already feel the gray-text pain firsthand.",
      pain: "New SDRs will ramp slowly because their outbound looks like everyone else's.",
      angle: "Lead with their own words on the broken medium, not 'congrats on the raise'.",
      whyThisAngle: "The obvious angle is the funding round; but they literally told us their pain is the medium — meeting them there proves we read it.",
      confidence: 0.86,
    };

    await ctx.db.insert("creatives", { ...base, reasoning, status: "approved" });
    for (let i = 0; i < 3; i++) {
      await ctx.db.insert("creatives", { ...base, reasoning, status: "draft" });
    }

    return { companyId, personId, creatives: 4 };
  },
});
