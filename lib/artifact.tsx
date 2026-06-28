import type { EnrichedLead, Reasoning } from "@/lib/schemas";

// CONTRACT (Wave 0). Branch B (feat/sdr-brain) implements via Satori (HTML->SVG) +
// @resvg/resvg-js (SVG->PNG). NEVER let a model draw logos/names/facts — render them
// from real data into a designed template. gpt-image-1 is for an optional backdrop only.
// Needs public/fonts/Inter-*.ttf buffers.

export async function renderArtifact(_input: {
  reasoning: Reasoning;
  lead: EnrichedLead;
  variant: number;
}): Promise<Buffer> {
  throw new Error("not impl: renderArtifact — implement in branch feat/sdr-brain (Satori + resvg)");
}
