import { ConvexHttpClient } from "convex/browser";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { renderArtifact } from "@/lib/artifact";
import type { EnrichedLead, Reasoning } from "@/lib/schemas";

// The full send pipeline, streamed. Three kinds of stage:
//  • recap   (fiber, summarizing, context) — the reasoning/Fiber/context already ran
//            when the lead was created; we replay the REAL data at a readable pace.
//            We deliberately do NOT re-run reasoning here — that would change the copy
//            the user already approved.
//  • real    (rendering image, video, sending) — genuinely generated on this send.
//  • video   is gated by SEND_GEN_VIDEO (heavy Remotion+TTS render); off → skipped.
// Mirrors lib/livegen: an async generator app/api/send streams as NDJSON. Node-only.

export type SendEvent =
  | {
      stage:
        | "gathering"
        | "fiber"
        | "summarizing"
        | "context"
        | "rendering"
        | "sending";
    }
  | { stage: "video"; skipped?: boolean }
  | { stage: "done"; channel: string; messageId: string; videoUrl?: string }
  | { stage: "error"; message: string };

const RECAP_MS = 550; // brief dwell so recap stages are readable, not a flash
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function convex(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  return new ConvexHttpClient(url);
}

export async function* runSend(
  creativeId: string,
  to?: string,
): AsyncGenerator<SendEvent> {
  try {
    const client = convex();

    yield { stage: "gathering" };
    const c = await client.query(api.creatives_read.get, {
      id: creativeId as Id<"creatives">,
    });
    if (!c) {
      yield { stage: "error", message: "Creative not found" };
      return;
    }
    if (!c.company || !c.person) {
      yield { stage: "error", message: "Lead data missing for this creative" };
      return;
    }

    const lead: EnrichedLead = {
      fiberId: c.company.fiberId,
      name: c.person.name,
      company: c.company.name,
      domain: c.company.domain,
      title: c.person.title,
      email: c.person.email,
      linkedin: c.person.linkedin,
      firmoSignals: (c.company.firmoSignals ?? {}) as Record<string, unknown>,
      socialPosts: c.person.socialPosts ?? [],
      logoUrl: c.company.logoUrl,
      screenshotUrl: c.company.screenshotUrl,
    };
    const reasoning = c.reasoning as Reasoning;

    // Recap of real, already-produced data (no regeneration of approved content).
    yield { stage: "fiber" };
    await delay(RECAP_MS);
    yield { stage: "summarizing" };
    await delay(RECAP_MS);
    yield { stage: "context" };
    await delay(RECAP_MS);

    // Real image render → upload → attach.
    yield { stage: "rendering" };
    const png = await renderArtifact({
      reasoning,
      anchorFact: c.anchorFact,
      lead,
      variant: c.chosenCopyIndex ?? 0,
    });
    const uploadUrl = (await client.mutation(
      api.creatives_write.generateUploadUrl,
      {},
    )) as string;
    const up = await fetch(uploadUrl, {
      method: "POST",
      headers: { "content-type": "image/png" },
      body: new Uint8Array(png),
    });
    if (!up.ok) throw new Error(`Artifact upload failed: ${up.status}`);
    const { storageId } = (await up.json()) as { storageId: Id<"_storage"> };
    await client.mutation(api.creatives_write.setArtifact, {
      creativeId: c._id,
      storageId,
    });

    // Real video — gated (Remotion+Chromium+TTS is heavy). Dynamic-import so the deps
    // never load on the default path. Soft-fails: a video error never blocks the send.
    let videoUrl: string | undefined;
    if (process.env.SEND_GEN_VIDEO) {
      yield { stage: "video" };
      try {
        const { renderHeroVideo } = await import("@/lib/video");
        const mp4 = await renderHeroVideo({
          reasoning,
          lead,
          anchorFact: c.anchorFact,
        });
        const dir = path.join(process.cwd(), "public", "generated");
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, `${c._id}.mp4`), new Uint8Array(mp4));
        videoUrl = `/generated/${c._id}.mp4`;
      } catch (e) {
        console.error("[sendgen] video render failed — skipping", e);
        yield { stage: "video", skipped: true };
      }
    } else {
      yield { stage: "video", skipped: true };
    }

    // Real delivery (Orange Slice → Gmail, open-pixel, status flip). When a clip was rendered,
    // pass its absolute URL so the email links the 7s walkthrough (the unique touch).
    yield { stage: "sending" };
    const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
    const absVideoUrl = videoUrl && base ? `${base}${videoUrl}` : undefined;
    const res = await client.action(api.sendEmail.send, {
      creativeId: c._id,
      ...(to ? { to } : {}),
      ...(absVideoUrl ? { videoUrl: absVideoUrl } : {}),
    });

    yield {
      stage: "done",
      channel: res.channel,
      messageId: res.messageId,
      videoUrl,
    };
  } catch (e) {
    yield {
      stage: "error",
      message: e instanceof Error ? e.message : "Send failed",
    };
  }
}
