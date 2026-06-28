// Real text-to-video via LTX (Lightricks) — new accounts get 800 free credits at
// console.ltx.video, so this is the free path (fal/HappyHorse has no free tier).
// Native SYNC API returns the MP4 bytes directly in the response (no polling).
// Setup: create a key at https://console.ltx.video/api-keys → add LTX_API_KEY=... to .env.local
// Swap the model with LTX_MODEL (default "ltx-2-3-pro").

const BASE = "https://api.ltx.video";
const MODEL = process.env.LTX_MODEL ?? "ltx-2-3-pro";
const TIMEOUT_MS = 240_000;

export type GeneratedVideo = { bytes: Buffer; model: string };

export async function generateVideo(
  prompt: string,
  opts?: { resolution?: string; duration?: number },
): Promise<GeneratedVideo> {
  const key = process.env.LTX_API_KEY;
  if (!key) {
    throw new Error(
      "LTX_API_KEY not set — create a key at https://console.ltx.video/api-keys and add LTX_API_KEY=... to .env.local",
    );
  }
  const resolution = opts?.resolution ?? "1920x1080";
  const duration = opts?.duration ?? 4;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/v1/text-to-video`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ prompt, model: MODEL, duration, resolution }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`LTX ${MODEL} ${res.status}: ${(await res.text()).slice(0, 400)}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("video")) {
      // some plans return JSON (async job / error) instead of the raw clip
      throw new Error(
        `expected video/mp4 but got "${contentType}": ${(await res.text()).slice(0, 300)}`,
      );
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 50_000) {
      throw new Error(`suspiciously small clip (${bytes.length}B) — likely a failed render`);
    }
    return { bytes, model: MODEL };
  } finally {
    clearTimeout(timer);
  }
}
