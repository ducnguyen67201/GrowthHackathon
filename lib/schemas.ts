import { z } from "zod";

// Zod = validation at external boundaries (Fiber, OpenAI). House rule: never trust
// external data — parse it here, then the rest of the code works with inferred types.

export const SocialPost = z.object({
  platform: z.string(),
  text: z.string(),
  url: z.string(),
  postedAt: z.string().optional(),
});

export const Source = z.object({
  field: z.string(),
  value: z.string(),
  url: z.string().optional(),
});

export const EnrichedLead = z.object({
  fiberId: z.string(),
  name: z.string(),
  company: z.string(),
  domain: z.string().optional(),
  title: z.string().optional(),
  email: z.string().optional(),
  linkedin: z.string().optional(),
  firmoSignals: z.record(z.unknown()),
  socialPosts: z.array(SocialPost),
  logoUrl: z.string().optional(),
  screenshotUrl: z.string().optional(),
});

export const Reasoning = z.object({
  saw: z.string(),
  inferred: z.string(),
  pain: z.string(),
  angle: z.string(),
  whyThisAngle: z.string(),
  confidence: z.number().min(0).max(1),
});

// The brain either reasons or skips a weak lead — model both as one union.
export const ReasonResult = z.discriminatedUnion("skip", [
  z.object({ skip: z.literal(true), why: z.string() }),
  z.object({
    skip: z.literal(false),
    reasoning: Reasoning,
    anchorFact: z.string(),
    sources: z.array(Source),
  }),
]);

export const CopyVariant = z.object({ subject: z.string(), body: z.string() });

// --- Reading-Minds re-aim: lost-deal → objection → match → score ---

export const LostDeal = z.object({
  id: z.string(),
  account: z.string(),
  contact: z.string(),
  title: z.string().optional(),
  email: z.string().optional(),
  domain: z.string().optional(),
  lostReason: z.string(),
  lostDate: z.string(),
  transcript: z.string().optional(),
});

// extractObjection() output — grounded: quote must come from the deal's own text.
export const Objection = z.object({
  objection: z.string(),
  category: z.string(),
  quote: z.string(),
  confidence: z.number().min(0).max(1),
});

export const ChangelogItem = z.object({
  feature: z.string(),
  description: z.string(),
  shippedAt: z.string(),
  solves: z.array(z.string()),
});

// matchRetrigger() output — does any shipped feature dissolve this objection?
export const RetriggerMatch = z.object({
  matched: z.boolean(),
  feature: z.string(), // "" when matched=false
  why: z.string(),
});

// scoreRetrigger() output — the ranked signal + its transparent breakdown.
export const RetriggerScore = z.object({
  score: z.number().min(0).max(1),
  breakdown: z.object({
    solved: z.number(),
    external: z.number(),
    recency: z.number(),
    simToWon: z.number(),
  }),
});

export type SocialPost = z.infer<typeof SocialPost>;
export type Source = z.infer<typeof Source>;
export type EnrichedLead = z.infer<typeof EnrichedLead>;
export type Reasoning = z.infer<typeof Reasoning>;
export type ReasonResult = z.infer<typeof ReasonResult>;
export type CopyVariant = z.infer<typeof CopyVariant>;
export type LostDeal = z.infer<typeof LostDeal>;
export type Objection = z.infer<typeof Objection>;
export type ChangelogItem = z.infer<typeof ChangelogItem>;
export type RetriggerMatch = z.infer<typeof RetriggerMatch>;
export type RetriggerScore = z.infer<typeof RetriggerScore>;
