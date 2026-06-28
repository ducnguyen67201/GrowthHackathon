import type { EnrichedLead, Reasoning } from "@/lib/schemas";

// CONTRACT (Wave 0). Branch G (feat/video-hero, Tier-2) implements via Remotion
// (@remotion/bundler + @remotion/renderer) + OpenAI TTS voiceover. Specifics overlaid
// by Remotion ONLY; Sora/gpt-image-1 = optional pre-rendered backdrop. Add remotion deps
// in Wave 2 (deferred from Wave 0 install).

export async function renderHeroVideo(_input: {
  reasoning: Reasoning;
  lead: EnrichedLead;
}): Promise<Buffer> {
  throw new Error("not impl: renderHeroVideo — implement in branch feat/video-hero");
}
