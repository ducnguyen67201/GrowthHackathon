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

export type SocialPost = z.infer<typeof SocialPost>;
export type Source = z.infer<typeof Source>;
export type EnrichedLead = z.infer<typeof EnrichedLead>;
export type Reasoning = z.infer<typeof Reasoning>;
export type ReasonResult = z.infer<typeof ReasonResult>;
export type CopyVariant = z.infer<typeof CopyVariant>;
