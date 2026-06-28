import { readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import type { EnrichedLead, Reasoning } from "@/lib/schemas";
import type { HeroVideoProps } from "@/remotion/HeroVideo";

// Branch G (feat/video-hero). Implements the Wave-0 contract: one reasoned lead →
// a personalized MP4 (real logo + animated anchor fact + OpenAI TTS voiceover).
// Remotion renders in headless Chromium so it CANNOT run inside Convex — this lib is
// driven from scripts/make-video.ts (Node context). Specifics overlaid by Remotion ONLY.

const TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";
const TTS_VOICE = "alloy";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

// Deterministic brand color from the company name — copied from lib/artifact.tsx so the
// video matches the card without touching that branch's file. ponytail: hash→hue.
function brandColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 72%, 48%)`;
}

function firstPostQuote(lead: EnrichedLead): string | undefined {
  const post = lead.socialPosts[0];
  if (!post) return undefined;
  const t = post.text.trim();
  return t.length > 160 ? `${t.slice(0, 157)}…` : t;
}

// 2-sentence script: name + the exact situation. Capped to fit the fixed 8s composition.
function voiceoverScript(lead: EnrichedLead, fact: string): string {
  return `${lead.name} at ${lead.company} — ${fact}. Worth a look?`;
}

async function speak(script: string): Promise<string> {
  const res = await client().audio.speech.create({
    model: TTS_MODEL,
    voice: TTS_VOICE,
    input: script,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:audio/mpeg;base64,${buf.toString("base64")}`;
}

export async function renderHeroVideo(input: {
  reasoning: Reasoning;
  lead: EnrichedLead;
  anchorFact?: string;
}): Promise<Buffer> {
  const { lead, reasoning } = input;
  // anchorFact lives on ReasonResult, not Reasoning — accept it explicitly, fall back to angle.
  const fact = input.anchorFact ?? reasoning.angle;

  const audioDataUri = await speak(voiceoverScript(lead, fact));

  const inputProps: HeroVideoProps = {
    company: lead.company,
    name: lead.name,
    title: lead.title,
    anchorFact: fact,
    accent: brandColor(lead.company),
    logoUrl: lead.logoUrl,
    quote: firstPostQuote(lead),
    audioDataUri,
  };

  await ensureBrowser();
  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), "remotion", "Root.tsx"),
  });
  const composition = await selectComposition({
    serveUrl,
    id: "HeroVideo",
    inputProps,
  });

  // renderMedia has no in-memory output — render to a temp file, read it back, clean up.
  const out = path.join(
    os.tmpdir(),
    `hero-${lead.fiberId}-${composition.height}.mp4`,
  );
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation: out,
    inputProps,
  });

  try {
    return await readFile(out);
  } finally {
    await unlink(out).catch(() => {});
  }
}
