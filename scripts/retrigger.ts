import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { extractObjection } from "@/lib/objections";
import {
  matchRetrigger,
  scoreRetrigger,
  buildRetriggerReasoning,
} from "@/lib/retrigger";
import { similarityToWon } from "@/lib/learning";
import { writeCopy } from "@/lib/agents";
import { renderArtifact } from "@/lib/artifact";
import { EnrichedLead, type ChangelogItem, type LostDeal } from "@/lib/schemas";

// Reading-Minds re-aim — THE orchestrator. Reads the dead pipeline, scores every lost
// deal, and writes a re-trigger creative for the ripe ones. REUSES the existing
// writeCopy → renderArtifact → upload flow unchanged (a re-trigger IS a normal creative).
// Usage: set -a; . ./.env.local; set +a; pnpm retrigger
// NEEDS: OPENAI_API_KEY + a live Convex deployment (NEXT_PUBLIC_CONVEX_URL). Not run in-CI.

const EXTERNAL_STRENGTH = 0.9; // weight when a seeded external signal is present

function convex(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  return new ConvexHttpClient(url);
}

async function uploadArtifact(
  client: ConvexHttpClient,
  creativeId: Id<"creatives">,
  png: Buffer,
): Promise<void> {
  const uploadUrl = (await client.mutation(
    api.creatives_write.generateUploadUrl,
    {},
  )) as string;
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: { "content-type": "image/png" },
    body: new Uint8Array(png),
  });
  if (!up.ok) throw new Error(`artifact upload failed: ${up.status}`);
  const { storageId } = (await up.json()) as { storageId: Id<"_storage"> };
  await client.mutation(api.creatives_write.setArtifact, { creativeId, storageId });
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  const client = convex();

  const deals = await client.query(api.lostDeals.listLostDeals, {});
  const changelogRows = await client.query(api.lostDeals.listChangelog, {});
  const won = await client.query(api.lostDeals.listWon, {});
  const wonTexts = won.map((w) => w.objection);
  const changelog: ChangelogItem[] = changelogRows.map((c) => ({
    feature: c.feature,
    description: c.description,
    shippedAt: c.shippedAt,
    solves: c.solves,
  }));

  console.log(
    `read ${deals.length} lost deals · ${changelog.length} shipped features · ${wonTexts.length} re-won (learning set)`,
  );

  const now = Date.now();
  let ripe = 0;

  for (const d of deals) {
    if (!d.companyId || !d.personId) {
      console.log(`  ✂ ${d.account}: no company/person link (re-seed) — skip`);
      continue;
    }
    const lostDeal: LostDeal = {
      id: d._id,
      account: d.account,
      contact: d.contact,
      title: d.title,
      email: d.email,
      domain: d.domain,
      lostReason: d.lostReason,
      lostDate: d.lostDate,
      transcript: d.transcript,
    };

    const objRes = await extractObjection(lostDeal);
    if (objRes.skip) {
      console.log(`  · ${d.account}: objection unclear (${objRes.why}) — skip`);
      continue;
    }
    const objection = objRes.objection;
    await client.mutation(api.lostDeals.setObjection, {
      lostDealId: d._id,
      objection: objection.objection,
      objectionCategory: objection.category,
    });

    const match = await matchRetrigger(objection, changelog, d.externalSignal ?? undefined);
    if (!match.matched) {
      console.log(`  · ${d.account}: "${objection.objection}" — not ripe yet`);
      continue;
    }

    const simToWon = wonTexts.length
      ? await similarityToWon(objection.objection, wonTexts)
      : 0;
    const score = scoreRetrigger({
      solved: true,
      externalSignalStrength: d.externalSignal ? EXTERNAL_STRENGTH : 0,
      lostDate: d.lostDate,
      simToWon,
      now,
    });

    const { reasoning, anchorFact } = buildRetriggerReasoning({
      deal: { account: d.account, contact: d.contact, lostDate: d.lostDate },
      objection,
      match,
      externalSignal: d.externalSignal ?? undefined,
      score: score.score,
    });

    const lead = EnrichedLead.parse({
      fiberId: `lost-${d._id}`,
      name: d.contact,
      company: d.account,
      domain: d.domain,
      title: d.title,
      email: d.email,
      firmoSignals: {},
      socialPosts: [],
    });

    const copy = await writeCopy(reasoning, lead);
    const png = await renderArtifact({ reasoning, anchorFact, lead, variant: 0 });

    const creativeId = (await client.mutation(api.lostDeals.createRetrigger, {
      companyId: d.companyId,
      personId: d.personId,
      lostDealId: d._id,
      reasoning,
      anchorFact,
      sources: objection.quote
        ? [{ field: "lostReason", value: objection.quote }]
        : [],
      copyVariants: copy,
      retriggerScore: score.score,
      retriggerBreakdown: score.breakdown,
      externalSignal: d.externalSignal ?? undefined,
    })) as Id<"creatives">;
    await uploadArtifact(client, creativeId, png);

    ripe++;
    console.log(
      `  ✓ ${d.account}: said no for "${objection.objection}" → ${match.feature} (score ${score.score.toFixed(3)})`,
    );
  }

  console.log(`\n${ripe}/${deals.length} dead accounts are re-triggerable now. Board ranked.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
