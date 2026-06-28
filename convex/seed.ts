import { mutation } from "./_generated/server";

// Seed fake-but-realistic data so the dashboard (C) and send (D) branches can build
// WITHOUT waiting on the fiber (A) or brain (B) branches.
// Run AFTER `npx convex dev`:  npx convex run seed:run
//
// run() WIPES the demo tables first, so re-running gives a clean, predictable board
// (no duplicate cards). It seeds two leads:
//   1. Acme Devtools / Jordan Lee — a realistic prospect (fake email) for the full flow.
//   2. "Your Inbox (test)" / You — email = your own, the ONE card that reaches you.

const SELF_SEND_EMAIL = "danielbaker06072001@gmail.com";

export const run = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Wipe demo tables first (creatives + sends before people/companies).
    for (const table of ["sends", "creatives", "people", "companies"] as const) {
      for (const doc of await ctx.db.query(table).collect()) {
        await ctx.db.delete(doc._id);
      }
    }

    // ---- Lead 1: realistic prospect (fake email) — for testing the full real send ----
    const acmeId = await ctx.db.insert("companies", {
      fiberId: "seed-acme",
      name: "Acme Devtools",
      domain: "acme.dev",
      firmoSignals: {
        funding: "Series A $14M",
        headcount: 38,
        hiring: ["SDR", "DevRel"],
      },
      signalSource: "seed",
      logoUrl: undefined,
      enrichedAt: now,
    });

    const jordanId = await ctx.db.insert("people", {
      companyId: acmeId,
      fiberId: "seed-person-1",
      name: "Jordan Lee",
      title: "Head of Growth",
      email: "jordan@acme.dev",
      linkedin: "https://linkedin.com/in/jordanlee",
      socialPosts: [
        {
          platform: "x",
          text: "Hiring our first 5 SDRs. Outbound is broken — every tool sends the same gray email. There has to be a better way.",
          url: "https://x.com/jordanlee",
          postedAt: "2026-06-24",
        },
      ],
      enrichedAt: now,
    });

    const acmeBase = {
      companyId: acmeId,
      personId: jordanId,
      anchorFact:
        "Posted that outbound is broken while hiring their first 5 SDRs",
      sources: [
        { field: "socialPost", value: "outbound is broken... same gray email" },
        { field: "firmoSignals.hiring", value: "SDR x5" },
      ],
      artifactType: "image" as const,
      copyVariants: [
        {
          subject: "saw your post about outbound",
          body: "Jordan — you said every tool sends the same gray email while you're hiring 5 SDRs. That's exactly the problem we kill. 2 min?",
        },
        {
          subject: "your first 5 SDRs",
          body: "Ramping 5 SDRs on outbound that everyone ignores is brutal. We make each touch provably specific. Worth a look?",
        },
      ],
      createdAt: now,
    };

    const acmeReasoning = {
      saw: "Jordan posted (Jun 24) that outbound is broken — 'every tool sends the same gray email' — while hiring 5 SDRs.",
      inferred:
        "They're scaling outbound headcount right now and already feel the gray-text pain firsthand.",
      pain: "New SDRs will ramp slowly because their outbound looks like everyone else's.",
      angle:
        "Lead with their own words on the broken medium, not 'congrats on the raise'.",
      whyThisAngle:
        "The obvious angle is the funding round; but they literally told us their pain is the medium — meeting them there proves we read it.",
      confidence: 0.86,
    };

    await ctx.db.insert("creatives", {
      ...acmeBase,
      reasoning: acmeReasoning,
      status: "approved",
    });
    for (let i = 0; i < 3; i++) {
      await ctx.db.insert("creatives", {
        ...acmeBase,
        reasoning: acmeReasoning,
        status: "draft",
      });
    }

    // ---- Lead 2: the ONE self-send card — its email is yours, so Send reaches you ----
    const inboxId = await ctx.db.insert("companies", {
      fiberId: "seed-self-send",
      name: "Your Inbox (test)",
      domain: "gmail.com",
      firmoSignals: { note: "test lead — emails you" },
      signalSource: "seed",
      logoUrl: undefined,
      enrichedAt: now,
    });

    const youId = await ctx.db.insert("people", {
      companyId: inboxId,
      fiberId: "seed-self-person",
      name: "You (test recipient)",
      title: "Self-send",
      email: SELF_SEND_EMAIL,
      linkedin: undefined,
      socialPosts: [],
      enrichedAt: now,
    });

    await ctx.db.insert("creatives", {
      companyId: inboxId,
      personId: youId,
      anchorFact: "Test card — sending this delivers a real email to your inbox",
      sources: [{ field: "seed", value: "self-send test lead" }],
      artifactType: "image" as const,
      copyVariants: [
        {
          subject: "Cutthrough test send ✓",
          body: "This is a self-send test from the Cutthrough demo. If it landed in your inbox, the real Gmail send path works end to end.",
        },
      ],
      reasoning: {
        saw: "This is the dedicated self-send test card.",
        inferred: "Clicking Send here emails you, not a prospect.",
        pain: "You need to confirm the real send path works before demoing.",
        angle: "Send to yourself first.",
        whyThisAngle: "A real delivered email is the only proof the pipeline works.",
        confidence: 1,
      },
      status: "approved",
      createdAt: now,
    });

    return { acmeId, jordanId, inboxId, youId };
  },
});
