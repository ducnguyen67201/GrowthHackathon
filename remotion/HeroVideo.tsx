import React from "react"; // classic JSX runtime (tsconfig jsx:preserve) needs React in scope
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Branch G (feat/video-hero). The animated twin of lib/artifact.tsx: the model NEVER
// draws logos/names/facts — every string here is a real prop rendered into a designed
// composition, so every pixel of text is correct. Unlike Satori, Remotion renders in
// real headless Chromium, so a remote logo URL fetches fine (monogram fallback still kept).

export const HERO_FPS = 30;
export const HERO_DURATION = 210; // 7s at 30fps; voiceover capped to 2 sentences to fit.
export const HERO_WIDTH = 1200;
export const HERO_HEIGHT = 630;

export type HeroVideoProps = {
  company: string;
  name: string;
  title?: string;
  anchorFact: string;
  accent: string;
  logoUrl?: string;
  quote?: string;
  audioDataUri?: string;
};

export const heroDefaultProps: HeroVideoProps = {
  company: "Acme",
  name: "Jane Doe",
  title: "VP Engineering",
  anchorFact: "shipped three platform launches in a quarter with a team of six",
  accent: "hsl(210, 72%, 48%)",
  logoUrl: undefined,
  quote: undefined,
  audioDataUri: undefined,
};

function LogoBadge({ logoUrl, accent, company }: HeroVideoProps) {
  if (logoUrl) {
    return (
      <Img
        src={logoUrl}
        width={84}
        height={84}
        style={{ borderRadius: 18, objectFit: "contain", background: "#fff" }}
      />
    );
  }
  return (
    <div
      style={{
        display: "flex",
        width: 84,
        height: 84,
        borderRadius: 18,
        background: accent,
        color: "#fff",
        fontSize: 44,
        fontWeight: 600,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {company.charAt(0).toUpperCase()}
    </div>
  );
}

export function HeroVideo(props: HeroVideoProps) {
  const { company, name, title, anchorFact, accent, quote, audioDataUri } =
    props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo lands (spring scale-in), header fades, anchor fact slides up — compositor-only.
  const logoScale = spring({ frame, fps, config: { damping: 14 } });
  const headerOpacity = interpolate(frame, [6, 24], [0, 1], {
    extrapolateRight: "clamp",
  });
  const factOpacity = interpolate(frame, [24, 54], [0, 1], {
    extrapolateRight: "clamp",
  });
  const factShift = interpolate(frame, [24, 54], [40, 0], {
    extrapolateRight: "clamp",
  });
  const quoteOpacity = interpolate(frame, [70, 100], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        flexDirection: "column",
        padding: 64,
        background: "#0c0a09",
        fontFamily: "Inter, sans-serif",
        color: "#f5f5f4",
        justifyContent: "space-between",
      }}
    >
      {audioDataUri ? <Audio src={audioDataUri} /> : null}

      <div style={{ height: 12, background: accent, marginBottom: 24 }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          opacity: headerOpacity,
          transform: `scale(${logoScale})`,
          transformOrigin: "left center",
        }}
      >
        <LogoBadge {...props} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 34, fontWeight: 600 }}>{company}</div>
          <div style={{ fontSize: 22, color: "#a8a29e" }}>
            {name}
            {title ? ` · ${title}` : ""}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 56,
          fontWeight: 600,
          lineHeight: 1.12,
          color: "#fafaf9",
          opacity: factOpacity,
          transform: `translateY(${factShift}px)`,
        }}
      >
        {anchorFact}
      </div>

      {quote ? (
        <div
          style={{
            display: "flex",
            borderLeft: `6px solid ${accent}`,
            paddingLeft: 24,
            fontSize: 26,
            color: "#d6d3d1",
            lineHeight: 1.4,
            opacity: quoteOpacity,
          }}
        >
          “{quote}”
        </div>
      ) : (
        <div style={{ display: "flex" }} />
      )}

      <div style={{ fontSize: 20, color: accent, fontWeight: 600 }}>
        Tombstone
      </div>
    </AbsoluteFill>
  );
}
