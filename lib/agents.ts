import type { EnrichedLead, ReasonResult, CopyVariant, Reasoning } from "@/lib/schemas";

// CONTRACT (Wave 0). Branch B (feat/sdr-brain) implements the bodies.
// reason() is the product — use OpenAI structured outputs (zodResponseFormat) so the
// chain is validated, and FORCE a non-obvious angle (contrast with the obvious one).

export async function reason(_lead: EnrichedLead): Promise<ReasonResult> {
  throw new Error("not impl: reason — implement in branch feat/sdr-brain (the product; nail this first)");
}

export async function writeCopy(_r: Reasoning, _lead: EnrichedLead): Promise<CopyVariant[]> {
  throw new Error("not impl: writeCopy — implement in branch feat/sdr-brain");
}
