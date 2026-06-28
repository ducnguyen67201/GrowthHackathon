import { v, Infer } from "convex/values";

// Reusable validators — used in BOTH schema.ts and function args so there's one
// source of truth. TS types are inferred, never hand-written.
export const socialPostV = v.object({
  platform: v.string(),
  text: v.string(),
  url: v.string(),
  postedAt: v.optional(v.string()),
});

export const sourceV = v.object({
  field: v.string(),
  value: v.string(),
  url: v.optional(v.string()),
});

export const reasoningV = v.object({
  saw: v.string(),
  inferred: v.string(),
  pain: v.string(),
  angle: v.string(),
  whyThisAngle: v.string(),
  confidence: v.number(),
});

export const copyVariantV = v.object({
  subject: v.string(),
  body: v.string(),
});

export type SocialPost = Infer<typeof socialPostV>;
export type Source = Infer<typeof sourceV>;
export type Reasoning = Infer<typeof reasoningV>;
export type CopyVariant = Infer<typeof copyVariantV>;
