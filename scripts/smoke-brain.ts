import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { reason, writeCopy } from "@/lib/agents";
import { renderArtifact } from "@/lib/artifact";
import {
  EnrichedLead,
  type ReasonResult,
  type Reasoning,
  type CopyVariant,
} from "@/lib/schemas";

// Branch B smoke (Gate 1). Feeds a MOCKED EnrichedLead — no Fiber, no Convex needed.
// With OPENAI_API_KEY set it exercises the real brain (reason + writeCopy). Without a
// key it falls back to a fixture chain so the Satori artifact path still renders and can
// be eyeballed for pixel-perfect logos/text. Outputs PNGs to .artifacts/.

const OUT_DIR = path.join(process.cwd(), ".artifacts");

// A deliberately sharp mock: the obvious angle is "congrats on the raise"; the real
// signal is the founder publicly naming the pain. A good chain must pick the latter.
const mockLead = EnrichedLead.parse({
  fiberId: "mock-vercel-1",
  name: "Lee Robinson",
  company: "Vercel",
  domain: "vercel.com",
  title: "VP of Product",
  email: "lee@vercel.com",
  linkedin: "https://linkedin.com/in/leerob",
  logoUrl: "https://logo.clearbit.com/vercel.com",
  firmoSignals: {
    funding: "Series E $250M",
    headcount: 600,
    hiring: ["DevRel", "PMM"],
  },
  socialPosts: [
    {
      platform: "x",
      text: "Every SaaS outbound email reads identically now. AI made the spam fluent but not relevant. The bar to earn a reply has never been higher.",
      url: "https://x.com/leerob/status/1",
      postedAt: "2026-06-25",
    },
  ],
});

const fixtureReason: Extract<ReasonResult, { skip: false }> = {
  skip: false,
  reasoning: {
    saw: "Lee posted (Jun 25) that 'every SaaS outbound email reads identically now — AI made the spam fluent but not relevant.'",
    inferred:
      "He's actively thinking about outbound quality and is skeptical of generic AI personalization.",
    pain: "His own inbox proves the medium is saturated; any pitch that looks templated is dead on arrival.",
    angle:
      "Lead by agreeing with his exact framing — fluent ≠ relevant — and show a card built only from his real words.",
    whyThisAngle:
      "The obvious angle is 'congrats on the $250M Series E', but he literally told us the funding isn't his concern — the medium is. Meeting him on relevance proves we read him.",
    confidence: 0.88,
  },
  anchorFact:
    "Said AI 'made the spam fluent but not relevant' — the bar to earn a reply has never been higher.",
  sources: [
    {
      field: "socialPost",
      value: "AI made the spam fluent but not relevant",
      url: "https://x.com/leerob/status/1",
    },
    { field: "firmoSignals.funding", value: "Series E $250M" },
  ],
};

const fixtureCopy: CopyVariant[] = [
  {
    subject: "fluent but not relevant",
    body: "Lee — you nailed it: AI made outbound fluent, not relevant. So I built you a card using only your own post, zero templated fluff. Worth 2 min to see what relevant actually looks like?",
  },
  {
    subject: "earning the reply",
    body: "You said the bar to earn a reply has never been higher. Agreed — which is why this note references nothing but what you actually wrote. Open to a quick look at how we keep every touch this specific?",
  },
];

function printChain(
  r: Reasoning,
  anchorFact: string,
  sources: { field: string; value: string }[],
) {
  console.log("\n── reasoning chain ──");
  console.log(`saw:        ${r.saw}`);
  console.log(`inferred:   ${r.inferred}`);
  console.log(`pain:       ${r.pain}`);
  console.log(`angle:      ${r.angle}`);
  console.log(`whyAngle:   ${r.whyThisAngle}`);
  console.log(`confidence: ${r.confidence}`);
  console.log(`anchorFact: ${anchorFact}`);
  console.log("sources:");
  for (const s of sources) console.log(`  - ${s.field}: ${s.value}`);
}

async function main() {
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  console.log(
    hasKey
      ? "OPENAI_API_KEY set → running REAL brain."
      : "No OPENAI_API_KEY → fixture chain (artifact path only).",
  );

  let result: Extract<ReasonResult, { skip: false }>;
  let copy: CopyVariant[];

  if (hasKey) {
    const r = await reason(mockLead);
    if (r.skip)
      throw new Error(
        `reason() skipped the lead: ${r.why} (mock should be high-confidence — check the prompt)`,
      );
    result = r;
    copy = await writeCopy(r.reasoning, mockLead);
  } else {
    result = fixtureReason;
    copy = fixtureCopy;
  }

  printChain(result.reasoning, result.anchorFact, result.sources);
  console.log("\n── copy variants ──");
  copy.forEach((c, i) => console.log(`[${i}] ${c.subject}\n    ${c.body}`));

  await mkdir(OUT_DIR, { recursive: true });
  for (const variant of [0, 1]) {
    const png = await renderArtifact({
      reasoning: result.reasoning,
      anchorFact: result.anchorFact,
      lead: mockLead,
      variant,
    });
    const file = path.join(OUT_DIR, `smoke-brain-v${variant}.png`);
    await writeFile(file, png);
    console.log(`\nartifact v${variant} → ${file} (${png.length} bytes)`);
    if (png.length < 1000)
      throw new Error(
        `artifact v${variant} suspiciously small (${png.length} bytes)`,
      );
  }

  console.log(
    "\n✓ smoke:brain passed — eyeball .artifacts/*.png for pixel-perfect logo + text.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
