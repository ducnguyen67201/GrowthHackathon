import type { Doc } from "@/convex/_generated/dataModel";

// The shape `creatives_read.list` returns: a creative joined with its company,
// person, and resolved artifact URL. `api` is loose (anyApi) until `convex dev`
// regenerates precise types, so the dashboard casts the query result to this.
export type CreativeCard = Doc<"creatives"> & {
  company: Doc<"companies"> | null;
  person: Doc<"people"> | null;
  lostDeal: Doc<"lostDeals"> | null;
  artifactUrl: string | null;
};

export type CreativeStatus = Doc<"creatives">["status"];
