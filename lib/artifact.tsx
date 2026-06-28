import React from "react"; // classic JSX runtime (tsconfig jsx:preserve) needs React in scope
import { readFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import OpenAI from "openai";
import type { EnrichedLead, Reasoning } from "@/lib/schemas";

// Branch B (feat/sdr-brain). Satori (HTML→SVG) + resvg (SVG→PNG). The model NEVER
// draws logos/names/facts — we render them from real lead data into a designed
// template, so every pixel of text is correct.
//
// AI backdrop (opt-in): when AI_BACKDROP is set, we generate an ABSTRACT background
// (gpt-image-1) and composite the same exact-text template on top of a scrim. The
// model still never draws text/logos — only an on-brand texture behind them. Off by
// default (free + deterministic); any failure falls back to the flat template.

const WIDTH = 1200;
const HEIGHT = 630;
const FONT_DIR = path.join(process.cwd(), "public", "fonts");

let _fonts: Awaited<ReturnType<typeof loadFonts>> | null = null;
async function loadFonts() {
  const [regular, semibold] = await Promise.all([
    readFile(path.join(FONT_DIR, "Inter-Regular.ttf")),
    readFile(path.join(FONT_DIR, "Inter-SemiBold.ttf")),
  ]);
  return [
    {
      name: "Inter",
      data: regular,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Inter",
      data: semibold,
      weight: 600 as const,
      style: "normal" as const,
    },
  ];
}
async function fonts() {
  if (!_fonts) _fonts = await loadFonts();
  return _fonts;
}

// Deterministic brand color from the company name — gives each card its own accent
// without needing a real brand-color field. ponytail: hash→hue, good enough for a card.
function brandColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 72%, 48%)`;
}

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// Optional AI backdrop. Returns a data-URI PNG to sit BEHIND the templated text, or
// null on any failure (unverified org, rate limit, etc.) so the card still renders.
// Model is overridable via AI_BACKDROP_MODEL (default gpt-image-1; "dall-e-3" works too).
async function aiBackdrop(lead: EnrichedLead): Promise<string | null> {
  try {
    const prompt =
      `Abstract premium background texture for a B2B outreach card about ${lead.company}` +
      `${lead.domain ? ` (${lead.domain})` : ""}. Soft gradient mesh, subtle geometric depth, ` +
      `fine grain, cinematic and modern, muted sophisticated palette. ` +
      `Absolutely no text, no words, no logos, no people, no UI elements.`;
    const model = process.env.AI_BACKDROP_MODEL ?? "gpt-image-1";
    const isGpt = model === "gpt-image-1";
    // gpt-image-1 always returns b64 + rejects response_format; dall-e-3 needs it set.
    const params = {
      model,
      prompt,
      n: 1,
      size: isGpt ? "1536x1024" : "1792x1024",
      ...(isGpt ? { quality: "low" } : { response_format: "b64_json" }),
    } as unknown as OpenAI.Images.ImageGenerateParams;
    const res = await openai().images.generate(params);
    const b64 = res.data?.[0]?.b64_json;
    return b64 ? `data:image/png;base64,${b64}` : null;
  } catch (e) {
    console.error("[artifact] AI backdrop failed — using flat template", e);
    return null;
  }
}

// Satori can't fetch images reliably in Node, so we inline the real logo as a data URI.
// On any failure we fall back to a monogram (still real data — first letter, never invented).
async function logoDataUri(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${type};base64,${b64}`;
  } catch {
    return null;
  }
}

function firstPostQuote(lead: EnrichedLead): string | null {
  const post = lead.socialPosts[0];
  if (!post) return null;
  const t = post.text.trim();
  return t.length > 180 ? `${t.slice(0, 177)}…` : t;
}

type TemplateInput = {
  accent: string;
  logo: string | null;
  company: string;
  name: string;
  title?: string;
  firmo?: string; // "Healthcare · ~60 employees · Series B" — company context on the card
  anchorFact: string;
  quote: string | null;
};

// One-line company context from firmographics (Fiber, or seeded). Falls back to the domain so
// the card never shows a bare name. Tolerant of key spellings (Fiber vs seed vs CRM).
function firmoLine(lead: EnrichedLead): string | undefined {
  const f = (lead.firmoSignals ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) =>
    typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? v : null;
  const parts: string[] = [];
  const industry = str(f.industry) ?? str(f.sector);
  if (industry) parts.push(industry);
  const emp = num(f.employees) ?? num(f.headcount) ?? num(f.employee_count);
  if (emp) parts.push(`~${emp} employees`);
  const funding = str(f.funding) ?? str(f.latest_funding) ?? str(f.stage);
  if (funding) parts.push(funding);
  if (!parts.length && lead.domain) parts.push(lead.domain);
  return parts.length ? parts.join(" · ") : undefined;
}

function logoBadge(input: TemplateInput) {
  if (input.logo) {
    return (
      <img
        src={input.logo}
        width={72}
        height={72}
        style={{ borderRadius: 16, objectFit: "contain", background: "#fff" }}
      />
    );
  }
  return (
    <div
      style={{
        display: "flex",
        width: 72,
        height: 72,
        borderRadius: 16,
        background: input.accent,
        color: "#fff",
        fontSize: 38,
        fontWeight: 600,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {input.company.charAt(0).toUpperCase()}
    </div>
  );
}

// Variant 0 — light editorial card.
function templateLight(input: TemplateInput) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: WIDTH,
        height: HEIGHT,
        padding: 64,
        background: "#fafaf9",
        fontFamily: "Inter",
        color: "#1c1917",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {logoBadge(input)}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>
            {input.company}
          </div>
          <div style={{ display: "flex", fontSize: 20, color: "#78716c" }}>
            {input.name}
            {input.title ? ` · ${input.title}` : ""}
          </div>
          {input.firmo ? (
            <div style={{ display: "flex", fontSize: 16, color: input.accent, marginTop: 4 }}>
              {input.firmo}
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 52,
          fontWeight: 600,
          lineHeight: 1.15,
        }}
      >
        {input.anchorFact}
      </div>

      {input.quote ? (
        <div
          style={{
            display: "flex",
            borderLeft: `6px solid ${input.accent}`,
            paddingLeft: 24,
            fontSize: 26,
            color: "#44403c",
            lineHeight: 1.4,
          }}
        >
          “{input.quote}”
        </div>
      ) : (
        <div style={{ display: "flex" }} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            display: "flex",
            width: 28,
            height: 6,
            borderRadius: 3,
            background: input.accent,
          }}
        />
        <div style={{ display: "flex", fontSize: 18, color: "#a8a29e" }}>
          Tombstone
        </div>
      </div>
    </div>
  );
}

// Variant 1 — dark accent-block card.
function templateDark(input: TemplateInput) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: WIDTH,
        height: HEIGHT,
        background: "#0c0a09",
        fontFamily: "Inter",
        color: "#f5f5f4",
      }}
    >
      <div style={{ display: "flex", height: 12, background: input.accent }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: 64,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {logoBadge(input)}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>
              {input.company}
            </div>
            <div style={{ display: "flex", fontSize: 20, color: "#a8a29e" }}>
              {input.name}
              {input.title ? ` · ${input.title}` : ""}
            </div>
            {input.firmo ? (
              <div style={{ display: "flex", fontSize: 16, color: input.accent, marginTop: 4 }}>
                {input.firmo}
              </div>
            ) : (
              <div style={{ display: "flex" }} />
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 54,
            fontWeight: 600,
            lineHeight: 1.12,
            color: "#fafaf9",
          }}
        >
          {input.anchorFact}
        </div>

        {input.quote ? (
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#d6d3d1",
              lineHeight: 1.4,
            }}
          >
            “{input.quote}”
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}

        <div
          style={{
            display: "flex",
            fontSize: 18,
            color: input.accent,
            fontWeight: 600,
          }}
        >
          Tombstone
        </div>
      </div>
    </div>
  );
}

// AI-backdrop variant — the exact-text content from the dark card, composited over the
// generated image with a bottom-weighted scrim so every word stays legible.
function templateBackdrop(input: TemplateInput & { backdrop: string }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: WIDTH,
        height: HEIGHT,
        fontFamily: "Inter",
      }}
    >
      <img
        src={input.backdrop}
        width={WIDTH}
        height={HEIGHT}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: WIDTH,
          height: HEIGHT,
          objectFit: "cover",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: WIDTH,
          height: HEIGHT,
          background:
            "linear-gradient(180deg, rgba(8,7,6,0.35) 0%, rgba(8,7,6,0.84) 100%)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          width: WIDTH,
          height: HEIGHT,
          padding: 64,
          justifyContent: "space-between",
          color: "#fafaf9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {logoBadge(input)}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>
              {input.company}
            </div>
            <div style={{ display: "flex", fontSize: 20, color: "#d6d3d1" }}>
              {input.name}
              {input.title ? ` · ${input.title}` : ""}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 54,
            fontWeight: 600,
            lineHeight: 1.12,
          }}
        >
          {input.anchorFact}
        </div>

        {input.quote ? (
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#e7e5e4",
              lineHeight: 1.4,
            }}
          >
            “{input.quote}”
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "flex",
              width: 28,
              height: 6,
              borderRadius: 3,
              background: input.accent,
            }}
          />
          <div style={{ display: "flex", fontSize: 18, color: "#fafaf9" }}>
            Tombstone
          </div>
        </div>
      </div>
    </div>
  );
}

export async function renderArtifact(input: {
  reasoning: Reasoning;
  lead: EnrichedLead;
  anchorFact?: string;
  variant: number;
}): Promise<Buffer> {
  const { lead, reasoning, variant } = input;
  const tpl: TemplateInput = {
    accent: brandColor(lead.company),
    logo: await logoDataUri(lead.logoUrl),
    company: lead.company,
    name: lead.name,
    title: lead.title,
    firmo: firmoLine(lead),
    // anchorFact lives on ReasonResult, not Reasoning — accept it explicitly, fall back to the angle.
    anchorFact: input.anchorFact ?? reasoning.angle,
    quote: firstPostQuote(lead),
  };

  // Opt-in AI backdrop (AI_BACKDROP). On any gen failure we fall back to the flat card.
  const backdrop = process.env.AI_BACKDROP ? await aiBackdrop(lead) : null;
  const element = backdrop
    ? templateBackdrop({ ...tpl, backdrop })
    : variant % 2 === 0
      ? templateLight(tpl)
      : templateDark(tpl);
  const svg = await satori(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: await fonts(),
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } })
    .render()
    .asPng();
  return Buffer.from(png);
}
