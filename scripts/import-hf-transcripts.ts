import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Real-dataset plugin: pull REAL sales-call transcripts from a public HuggingFace dataset
// via the datasets-server REST API — no auth, no Python, no multi-GB download. Saves to
// .artifacts/hf-transcripts.json so you can hand-pick them into convex/seed.ts (the
// `transcript` field) or paste one straight into the /signals live beat.
//
// Usage:  npx tsx scripts/import-hf-transcripts.ts [dataset] [count]
//   default dataset: goendalf666/sales-conversations  (text-only sales dialogue, 3,412 rows, Apache-2.0-ish)
//   other good ones: gwenshap/sales-transcripts · DeepMostInnovations/saas-sales-conversations (Apache-2.0, has won/lost outcomes)

const DATASET = process.argv[2] ?? "goendalf666/sales-conversations";
const COUNT = Math.max(1, Math.min(Number(process.argv[3] ?? 25), 100));
const OUT = path.join(process.cwd(), ".artifacts", "hf-transcripts.json");

// join the row's text fields (datasets vary: turn-per-column, a `conversation` array, or `text`)
function rowToTranscript(row: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const v of Object.values(row)) {
    if (typeof v === "string" && v.trim()) parts.push(v.trim());
    else if (Array.isArray(v)) {
      for (const item of v) if (typeof item === "string" && item.trim()) parts.push(item.trim());
    }
  }
  return parts.join("\n");
}

async function main(): Promise<void> {
  const url =
    `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(DATASET)}` +
    `&config=default&split=train&offset=0&length=${COUNT}`;
  console.log(`fetching ${COUNT} rows from HuggingFace: ${DATASET}…`);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HF datasets-server ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { rows?: { row: Record<string, unknown> }[] };
  const transcripts = (json.rows ?? [])
    .map((r) => rowToTranscript(r.row))
    .filter((t) => t.length > 40);

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ dataset: DATASET, count: transcripts.length, transcripts }, null, 2));

  console.log(`✓ saved ${transcripts.length} real transcripts → ${OUT}`);
  console.log(`\n── sample ──\n${(transcripts[0] ?? "").slice(0, 320)}…`);
  console.log(
    `\nNext: hand-pick any into convex/seed.ts (a deal's \`transcript\`), or paste one into the /signals live beat to watch the engine read a REAL call.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
