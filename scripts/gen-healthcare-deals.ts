import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

// Generate REALISTIC healthcare-SaaS lost-deal transcripts to grow convex/seed.ts.
// Real such transcripts aren't publicly downloadable (PHI-sensitive), so we synthesize
// them grounded in the SAME objection categories + changelog `solves` tags the board
// joins on — so generated deals are immediately re-triggerable, not noise.
//
// Usage:  npx tsx scripts/gen-healthcare-deals.ts [count]   (default 12, max 40)
// Output: .artifacts/healthcare-deals.json  +  paste-ready TS printed to stdout.

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-2024-08-06";
const COUNT = Math.max(1, Math.min(Number(process.argv[2] ?? 12), 40));
const OUT = path.join(process.cwd(), ".artifacts", "healthcare-deals.json");

// categories that MAP to a shipped feature (ripe to re-trigger) vs ones that stay dead.
// Mirrors the 8-ripe / 4-dead split the seed comment relies on.
const RIPE = ["soc2", "baa", "audit-logs", "encryption", "rbac"] as const;
const DEAD = ["fhir", "on-prem", "pricing", "timing", "salesforce", "compliance-deferred"] as const;

const Deal = z.object({
  account: z.string(),
  contact: z.string(),
  title: z.string(),
  domain: z.string(),
  value: z.number().int().min(50_000).max(600_000),
  objection: z.string(),
  category: z.enum([...RIPE, ...DEAD]),
  lostDate: z.string(), // YYYY-MM-DD, late 2025 → mid 2026
  lostReason: z.string(),
  transcript: z.string(), // "Name: <verbatim objection in their own voice>"
  transcriptDate: z.string(),
  externalSignal: z.string().nullable(), // OpenAI structured-output: all fields required+nullable, not optional
  externalSignalType: z.enum(["funding_round", "hiring", "expansion"]).nullable(),
});
const Batch = z.object({ deals: z.array(Deal) });

const SYSTEM = [
  "You generate REALISTIC closed-lost B2B deals where a healthcare SaaS vendor lost a sale to a clinic/hospital/health-tech buyer.",
  "Each deal died on ONE concrete compliance or technical objection. Make them feel like real procurement: named roles (CISO, Compliance, IT Director, COO), real ACVs, varied buyer sizes.",
  "`transcript` is one line, `\"<Contact Name>: <what they said>\"`, in the buyer's own voice — the verbatim moment the deal died. Specific, not generic. No PHI, no real patient data, no real company names.",
  "`lostReason` is the one-sentence CRM close-lost note. `objection` is a short canonical phrase. `category` MUST be from the allowed enum.",
  `Roughly ${RIPE.length > 0 ? "two-thirds" : ""} of deals use a RIPE category (${RIPE.join(", ")}) — these match features we've shipped, so they're re-triggerable. The rest use a DEAD category (${DEAD.join(", ")}).`,
  "About half the deals carry an externalSignal (a funding_round / hiring / expansion event that would make NOW the moment to re-engage). Leave the rest without one.",
  "Unique accounts and domains. Dates spread across 2025-11 to 2026-05; transcriptDate a few days before lostDate.",
].join(" ");

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const client = new OpenAI({ apiKey });

  console.log(`generating ${COUNT} healthcare lost deals via ${MODEL}…`);
  const completion = await client.beta.chat.completions.parse({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Generate exactly ${COUNT} deals.` },
    ],
    response_format: zodResponseFormat(Batch, "batch"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("no structured output");

  // dedupe by domain; drop any transcript that doesn't actually quote the contact (grounding check)
  const seen = new Set<string>();
  const deals = parsed.deals.filter((d) => {
    const key = d.domain.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    const firstName = d.contact.split(" ")[0] ?? "";
    return d.transcript.includes(firstName);
  });

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(deals, null, 2));

  const ripe = deals.filter((d) => (RIPE as readonly string[]).includes(d.category)).length;
  console.log(`✓ ${deals.length} deals (${ripe} ripe / ${deals.length - ripe} dead) → ${OUT}`);
  console.log(`\n── paste into SEED_DEALS in convex/seed.ts ──\n`);
  for (const d of deals) {
    const extra = d.externalSignal
      ? `,\n    externalSignal: ${JSON.stringify(d.externalSignal)}, externalSignalType: ${JSON.stringify(d.externalSignalType)}`
      : "";
    console.log(
      `  { account: ${JSON.stringify(d.account)}, contact: ${JSON.stringify(d.contact)}, title: ${JSON.stringify(d.title)}, domain: ${JSON.stringify(d.domain)}, value: ${d.value},\n` +
        `    lostReason: ${JSON.stringify(d.lostReason)}, lostDate: ${JSON.stringify(d.lostDate)},\n` +
        `    objection: ${JSON.stringify(d.objection)}, category: ${JSON.stringify(d.category)}, transcriptDate: ${JSON.stringify(d.transcriptDate)},\n` +
        `    transcript: ${JSON.stringify(d.transcript)}${extra} },`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
