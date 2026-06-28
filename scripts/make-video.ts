import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EnrichedLead } from "@/lib/schemas";
import { renderHeroVideo } from "@/lib/video";

// Branch G (feat/video-hero). Usage: pnpm video <creativeId>
// Renders one reasoned creative to a personalized MP4, writes it to .artifacts/, then
// uploads it to Convex storage and flips the creative to artifactType:"video".
// ponytail: render in a script, NOT a Convex action — Remotion needs headless Chromium.

// Loads .env.local natively (Node 20.12+ / 24). Requires OPENAI_API_KEY + NEXT_PUBLIC_CONVEX_URL.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — rely on exported env
}

const OUT_DIR = ".artifacts";
const MIN_MP4_BYTES = 50_000; // a real H.264 clip is far bigger — catches a black/empty render.

async function main() {
  const creativeId = process.argv[2];
  if (!creativeId) throw new Error("Usage: pnpm video <creativeId>");

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl)
    throw new Error("NEXT_PUBLIC_CONVEX_URL not set (add to .env.local)");
  if (!process.env.OPENAI_API_KEY)
    throw new Error("OPENAI_API_KEY not set (add to .env.local)");

  const convex = new ConvexHttpClient(convexUrl);
  const id = creativeId as Id<"creatives">;

  const { reasoning, anchorFact, lead } = await convex.query(
    api.creatives_video.getForVideo,
    { creativeId: id },
  );

  // Zod boundary: the DB-joined lead is external data — parse it into the contract shape.
  const parsedLead = EnrichedLead.parse(lead);

  console.log(`rendering hero video for ${parsedLead.company}…`);
  const mp4 = await renderHeroVideo({
    reasoning,
    lead: parsedLead,
    anchorFact,
  });

  if (mp4.length < MIN_MP4_BYTES)
    throw new Error(
      `rendered MP4 suspiciously small (${mp4.length} bytes) — render likely failed`,
    );

  await mkdir(OUT_DIR, { recursive: true });
  const safe = parsedLead.company.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const file = path.join(OUT_DIR, `hero-${safe}.mp4`);
  await writeFile(file, mp4);
  console.log(`✓ ${file} (${mp4.length} bytes)`);

  // Upload: generateUploadUrl -> POST bytes -> setVideoArtifact (mirrors creatives_write flow).
  const uploadUrl = await convex.mutation(
    api.creatives_write.generateUploadUrl,
    {},
  );
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "video/mp4" },
    body: new Blob([new Uint8Array(mp4)], { type: "video/mp4" }),
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };

  await convex.mutation(api.creatives_video.setVideoArtifact, {
    creativeId: id,
    storageId,
  });
  console.log(
    `✓ attached video to creative ${creativeId} (artifactType:video)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
