import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { runLive, type LiveEvent } from "@/lib/livegen";

// Branch E smoke (Gate 4). Seeds a fake .livecache entry and runs runLive() — the
// cache-hit path short-circuits before any Fiber/OpenAI/Convex call, so this needs
// NO API keys and still proves the generator + cache + event ordering are intact.

const CACHE_DIR = path.join(process.cwd(), ".livecache");
const KEY = "smoke-test"; // slug("smoke test")

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  const pngPath = path.join(CACHE_DIR, `${KEY}.png`);
  await writeFile(pngPath, Buffer.from("fake-png-bytes"));
  await writeFile(
    path.join(CACHE_DIR, `${KEY}.json`),
    JSON.stringify({
      lead: {
        fiberId: "smoke",
        name: "Tester",
        company: "SmokeCo",
        firmoSignals: {},
        socialPosts: [],
      },
      reasoning: {
        saw: "a",
        inferred: "b",
        pain: "c",
        angle: "d",
        whyThisAngle: "e",
        confidence: 0.9,
      },
      anchorFact: "anchor",
      copy: [{ subject: "s", body: "b" }],
      creativeId: "fake-creative-id",
      pngPath,
    }),
  );

  const events: LiveEvent[] = [];
  for await (const ev of runLive("smoke test")) events.push(ev);

  const stages = events.map((e) => ("stage" in e ? e.stage : `step:${e.step}`));
  assert.deepEqual(
    stages,
    [
      "reasoning",
      "step:saw",
      "step:inferred",
      "step:pain",
      "step:angle",
      "step:whyThisAngle",
      "rendering",
      "done",
    ],
    `unexpected event order: ${stages.join(", ")}`,
  );

  const done = events[events.length - 1];
  assert(
    done && "stage" in done && done.stage === "done",
    "last event must be done",
  );
  assert.equal(done.cached, true, "cache hit must mark cached:true");
  assert.equal(done.creativeId, "fake-creative-id");

  await rm(path.join(CACHE_DIR, `${KEY}.json`));
  await rm(pngPath);
  console.log("✓ smoke:live passed — cache replay yields the right event order.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
