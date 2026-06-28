import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { generateVideo } from "@/lib/textToVideo";
import { directVideo } from "@/lib/videoDirector";

// Director → text-to-video. Give it a dead-deal account and it reads that customer's real
// signal (objection, their words, the fix we shipped), DIRECTS a 4s personalized clip — a
// visual metaphor of THEIR blocker dissolving — then renders it via LTX into public/generated/.
//   pnpm t2v "Lumen Health"        ← directed from the dead deal
//   pnpm t2v "a sunset over hills" ← no deal match → used as a raw prompt
// Needs: OPENAI_API_KEY + LTX_API_KEY + NEXT_PUBLIC_CONVEX_URL (all in .env).

for (const f of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(f);
  } catch {
    // optional file
  }
}

const DEFAULT_PROMPT =
  "Premium healthcare-SaaS motion graphics b-roll: a heavy vault door slowly swinging open " +
  "into a soft emerald glow over a warm cream-to-teal gradient, calm cinematic push-in, " +
  "trustworthy, no text or logos, 16:9.";

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "clip"
  );
}

async function lookupDeal(account: string) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  try {
    const client = new ConvexHttpClient(url);
    return await client.query(api.lostDeals.byAccount, { account });
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const arg = process.argv.slice(2).join(" ").trim();

  let prompt: string;
  let caption = "";
  let label: string;

  const deal = arg ? await lookupDeal(arg) : null;
  if (deal) {
    console.log(
      `directing · ${deal.account}${deal.contact ? ` · ${deal.contact}` : ""}`,
    );
    const plan = await directVideo({
      account: deal.account,
      contact: deal.contact,
      title: deal.title,
      objection: deal.objection,
      quote: (deal.transcript ?? deal.lostReason)?.slice(0, 400),
      fixFeature: deal.fixFeature,
      fixDescription: deal.fixDescription,
      externalSignal: deal.externalSignal,
      industry: "healthcare SaaS",
    });
    prompt = plan.prompt;
    caption = plan.caption;
    label = slug(deal.account);
    console.log(
      `\n  painpoint: ${plan.painpoint}` +
        `\n  concept:   ${plan.concept}` +
        `\n  caption:   "${plan.caption}"` +
        `\n  prompt:    ${plan.prompt}\n`,
    );
  } else {
    prompt = arg || DEFAULT_PROMPT;
    label = slug(prompt);
    if (arg) console.log(`(no dead deal matched "${arg}" — using it as a raw prompt)`);
  }

  console.log(`t2v · LTX ${process.env.LTX_MODEL ?? "ltx-2-3-pro"} · 4s\n…generating…`);
  const started = Date.now();
  const { bytes } = await generateVideo(prompt, { duration: 4 });

  const outDir = path.join(process.cwd(), "public", "generated");
  await mkdir(outDir, { recursive: true });
  const name = `t2v-${label}.mp4`;
  await writeFile(path.join(outDir, name), bytes);

  console.log(
    `\n✓ ${(bytes.length / 1024).toFixed(0)} KB in ${((Date.now() - started) / 1000).toFixed(1)}s` +
      (caption ? `\n  caption: "${caption}"` : "") +
      `\n  view:    http://localhost:3000/generated/${name}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
