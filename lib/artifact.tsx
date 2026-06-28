import React from "react"; // classic JSX runtime (tsconfig jsx:preserve) needs React in scope
import { readFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { EnrichedLead, Reasoning } from "@/lib/schemas";

// Branch B (feat/sdr-brain). Satori (HTML→SVG) + resvg (SVG→PNG). The model NEVER
// draws logos/names/facts — we render them from real lead data into a designed
// template, so every pixel of text is correct. gpt-image-1 backdrop is out of scope here.

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
  anchorFact: string;
  quote: string | null;
};

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
          Cutthrough
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
          Cutthrough
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
    // anchorFact lives on ReasonResult, not Reasoning — accept it explicitly, fall back to the angle.
    anchorFact: input.anchorFact ?? reasoning.angle,
    quote: firstPostQuote(lead),
  };

  const element = variant % 2 === 0 ? templateLight(tpl) : templateDark(tpl);
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
