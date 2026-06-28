import type { EnrichedLead, SocialPost } from "@/lib/schemas";

// CONTRACT (Wave 0). Branch A (feat/fiber-data) implements the bodies.
// Branch F (feat/overnight-batch) implements socialLookupBatch — stubbed separately
// so A and F never edit the same function body.

export type CompanyHit = { fiberId: string; name: string; domain?: string };
export type PersonHit = { fiberId: string; name: string; title?: string };

const ni = (n: string): never => {
  throw new Error(`not impl: ${n} — implement in branch feat/fiber-data`);
};

export async function searchCompanies(_nlOrFilters: string): Promise<CompanyHit[]> {
  return ni("searchCompanies");
}

export async function findContact(_companyFiberId: string): Promise<PersonHit> {
  return ni("findContact");
}

export async function enrich(_personFiberId: string): Promise<EnrichedLead> {
  return ni("enrich");
}

export async function socialLookup(_handleOrId: string): Promise<SocialPost[]> {
  return ni("socialLookup");
}

export async function revealEmail(_personFiberId: string): Promise<string> {
  return ni("revealEmail");
}

export async function getLogo(_domain: string): Promise<string | null> {
  return ni("getLogo");
}

export async function getScreenshot(_domain: string): Promise<string | null> {
  return ni("getScreenshot");
}

export async function getCredits(): Promise<number> {
  return ni("getCredits");
}

// Wave 2 / branch F:
export async function socialLookupBatch(
  _handles: string[],
): Promise<Record<string, SocialPost[]>> {
  throw new Error("not impl: socialLookupBatch — implement in branch feat/overnight-batch");
}
