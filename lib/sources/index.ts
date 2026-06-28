import type { DealSource, TranscriptSource } from "./types";
import { GeneratedDealSource, GeneratedTranscriptSource } from "./generated";

export * from "./types";

// Provider registry. Pick the source with an env var; default to the generated demo provider
// so the system runs with zero keys. Wiring a real vendor is: implement its adapter behind the
// DealSource/TranscriptSource interface, add a case here, set the env var. Nothing else moves —
// the sync action, the Convex tables, and the /live autopsy popup all stay exactly as they are.

export function getDealSource(): DealSource {
  const mode = process.env.DEAL_SOURCE ?? "generated";
  switch (mode) {
    case "generated":
      return new GeneratedDealSource();
    // --- real adapters drop in here (each is ~1 file implementing listClosedLost) ---
    case "salesforce":
      throw new Error(
        "Salesforce deal source not wired yet — add lib/sources/salesforce.ts (SOQL: Opportunity WHERE StageName='Closed Lost'), set SALESFORCE_* creds, register it here. Unset DEAL_SOURCE to use the generated demo source.",
      );
    case "hubspot":
      throw new Error(
        "HubSpot deal source not wired yet — add lib/sources/hubspot.ts (CRM deals API, dealstage=closedlost), set HUBSPOT_API_KEY, register it here. Unset DEAL_SOURCE to use the generated demo source.",
      );
    default:
      throw new Error(`unknown DEAL_SOURCE: ${mode} (use generated | salesforce | hubspot)`);
  }
}

export function getTranscriptSource(): TranscriptSource {
  const mode = process.env.TRANSCRIPT_SOURCE ?? "generated";
  switch (mode) {
    case "generated":
      return new GeneratedTranscriptSource();
    // --- real adapters drop in here (each implements getForDeal → transcript) ---
    case "gong":
      throw new Error(
        "Gong transcript source not wired yet — add lib/sources/gong.ts (GET /v2/calls?filter by account, then /v2/calls/transcript), set GONG_ACCESS_KEY/SECRET, register it here. Unset TRANSCRIPT_SOURCE to use the generated demo source.",
      );
    case "fireflies":
      throw new Error(
        "Fireflies transcript source not wired yet — add lib/sources/fireflies.ts (GraphQL transcript query), set FIREFLIES_API_KEY, register it here. Unset TRANSCRIPT_SOURCE to use the generated demo source.",
      );
    default:
      throw new Error(`unknown TRANSCRIPT_SOURCE: ${mode} (use generated | gong | fireflies)`);
  }
}
