// The data-source seam. Every external system the re-trigger engine reads from sits behind
// one of these interfaces: closed-lost deals (CRM) and call transcripts (call-recording).
// A `generated` impl ships realistic retrieved data today; real adapters (Salesforce, Gong,
// Fireflies…) drop in behind the SAME interface with zero change downstream. The deal shape
// mirrors what lostDeals.byAccount serves, so a synced row renders in the /live autopsy popup
// unchanged — swapping the vendor never touches the UI.

export type SourceDeal = {
  externalId: string; // id in the system of record (CRM opportunity id, etc.)
  account: string;
  contact: string;
  title: string;
  domain: string;
  value: number; // ACV in $
  lostReason: string;
  lostDate: string; // ISO yyyy-mm-dd
  objection: string; // canonical short objection ("no SOC2 Type II")
  category: string; // matches changelog.solves tags so the fix can join
  externalSignal?: string; // "what changed since" — surfaces the deal as re-winnable
  externalSignalType?: string;
  firmoSignals?: Record<string, unknown>; // company context (industry/size/stage) for the card
};

export type SourceTranscript = {
  transcript: string; // "Speaker: line\n…" — multi-turn
  transcriptDate: string; // ISO yyyy-mm-dd — when the call happened
};

// A system of record for closed-lost deals (CRM). One method: list what we lost.
export interface DealSource {
  readonly id: string; // "generated" | "salesforce" | "hubspot"
  readonly label: string; // human label for logs/UI ("Demo CRM", "Salesforce")
  listClosedLost(opts?: { count?: number }): Promise<SourceDeal[]>;
}

// A call-recording system. One method: get the transcript for a given deal.
export interface TranscriptSource {
  readonly id: string; // "generated" | "gong" | "fireflies"
  readonly label: string;
  getForDeal(deal: SourceDeal): Promise<SourceTranscript | null>;
}
