import { z } from "zod";

// Pure, dependency-free half of the signal spine (no Convex imports) so the
// fallback catalog and the Fiber-response normalizer are unit-testable on their own.
// convex/tracker.ts wires these into the action layer.

export type TrackerRule = {
  id: string;
  name: string;
  category: string;
  hero?: boolean;
};

export type RulesResult = { rules: TrackerRule[]; source: "live" | "fallback" };

// 52 real B2B trigger types Fiber watches, grouped. Job-change is the hero trigger.
export const FALLBACK_RULES: TrackerRule[] = [
  // Funding & finance
  {
    id: "funding_round_raised",
    name: "Raised a funding round",
    category: "Funding",
  },
  { id: "funding_seed", name: "Raised a seed round", category: "Funding" },
  { id: "funding_series_a", name: "Raised a Series A", category: "Funding" },
  {
    id: "funding_series_b_plus",
    name: "Raised a Series B+",
    category: "Funding",
  },
  { id: "ipo_filed", name: "Filed for IPO", category: "Funding" },
  { id: "acquired", name: "Was acquired", category: "Funding" },
  {
    id: "made_acquisition",
    name: "Acquired another company",
    category: "Funding",
  },
  { id: "new_investor", name: "Added a notable investor", category: "Funding" },
  // Hiring
  { id: "hiring_surge", name: "Headcount growth spike", category: "Hiring" },
  { id: "hiring_sales", name: "Opened sales / SDR roles", category: "Hiring" },
  {
    id: "hiring_engineering",
    name: "Opened engineering roles",
    category: "Hiring",
  },
  {
    id: "hiring_marketing",
    name: "Opened marketing roles",
    category: "Hiring",
  },
  { id: "hiring_executive", name: "Hiring a VP / C-level", category: "Hiring" },
  {
    id: "hiring_first_in_role",
    name: "First hire in a function",
    category: "Hiring",
  },
  { id: "hiring_freeze_lifted", name: "Resumed hiring", category: "Hiring" },
  {
    id: "open_roles_spike",
    name: "Spike in total open roles",
    category: "Hiring",
  },
  {
    id: "hiring_internationally",
    name: "Hiring in a new country",
    category: "Hiring",
  },
  {
    id: "hiring_devrel",
    name: "Hiring DevRel / community",
    category: "Hiring",
  },
  // People & job changes (hero category)
  {
    id: "champion_job_change",
    name: "Your champion changed jobs",
    category: "Job changes",
    hero: true,
  },
  {
    id: "new_exec_joined",
    name: "A new executive joined",
    category: "Job changes",
  },
  { id: "new_cxo", name: "Appointed a new CXO", category: "Job changes" },
  {
    id: "decision_maker_promoted",
    name: "Decision maker promoted",
    category: "Job changes",
  },
  {
    id: "buyer_left",
    name: "Key contact left the account",
    category: "Job changes",
  },
  { id: "new_vp_eng", name: "New VP Engineering", category: "Job changes" },
  { id: "new_cmo", name: "New CMO", category: "Job changes" },
  {
    id: "board_member_added",
    name: "Added a board member",
    category: "Job changes",
  },
  // Growth & expansion
  {
    id: "headcount_milestone",
    name: "Crossed a headcount milestone",
    category: "Growth",
  },
  { id: "new_office", name: "Opened a new office", category: "Growth" },
  {
    id: "expanded_to_region",
    name: "Expanded to a new region",
    category: "Growth",
  },
  {
    id: "revenue_milestone",
    name: "Hit a revenue milestone",
    category: "Growth",
  },
  {
    id: "customer_milestone",
    name: "Announced a customer milestone",
    category: "Growth",
  },
  { id: "rebrand", name: "Rebranded", category: "Growth" },
  // Product & go-to-market
  {
    id: "product_launch",
    name: "Launched a new product",
    category: "Product / GTM",
  },
  {
    id: "feature_launch",
    name: "Shipped a major feature",
    category: "Product / GTM",
  },
  { id: "pricing_change", name: "Changed pricing", category: "Product / GTM" },
  {
    id: "new_integration",
    name: "Announced an integration",
    category: "Product / GTM",
  },
  {
    id: "entered_new_market",
    name: "Entered a new market segment",
    category: "Product / GTM",
  },
  {
    id: "partnership_announced",
    name: "Announced a partnership",
    category: "Product / GTM",
  },
  {
    id: "launched_on_marketplace",
    name: "Listed on a marketplace",
    category: "Product / GTM",
  },
  {
    id: "announced_at_event",
    name: "Announced at a conference",
    category: "Product / GTM",
  },
  // Tech & web intent
  {
    id: "tech_stack_added",
    name: "Adopted a new technology",
    category: "Tech & intent",
  },
  {
    id: "tech_stack_removed",
    name: "Dropped a tool from the stack",
    category: "Tech & intent",
  },
  {
    id: "adopted_competitor",
    name: "Started using a competitor",
    category: "Tech & intent",
  },
  {
    id: "website_relaunch",
    name: "Relaunched their website",
    category: "Tech & intent",
  },
  { id: "traffic_surge", name: "Web traffic surge", category: "Tech & intent" },
  {
    id: "job_posting_keyword",
    name: "Job post mentions a key term",
    category: "Tech & intent",
  },
  {
    id: "content_published",
    name: "Published relevant content",
    category: "Tech & intent",
  },
  {
    id: "search_intent_spike",
    name: "Spike in category search intent",
    category: "Tech & intent",
  },
  // Risk
  { id: "layoffs", name: "Announced layoffs", category: "Risk" },
  {
    id: "leadership_departure",
    name: "Notable leadership departure",
    category: "Risk",
  },
  { id: "negative_press", name: "Negative press coverage", category: "Risk" },
  {
    id: "compliance_event",
    name: "Regulatory / compliance event",
    category: "Risk",
  },
];

// Fiber's shape is unknown until the key lands — parse defensively and keep only
// what we render. Accept a bare array or a `{ rules }` / `{ data }` envelope.
const liveRuleV = z
  .object({
    id: z.string().optional(),
    key: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    label: z.string().optional(),
    category: z.string().optional(),
    group: z.string().optional(),
  })
  .transform((r): TrackerRule | null => {
    const id = r.id ?? r.key;
    const name = r.name ?? r.title ?? r.label ?? id;
    if (!id || !name) return null;
    return { id, name, category: r.category ?? r.group ?? "Other" };
  });

const liveRulesV = z.union([
  z.array(liveRuleV),
  z.object({ rules: z.array(liveRuleV) }).transform((o) => o.rules),
  z.object({ data: z.array(liveRuleV) }).transform((o) => o.data),
]);

const isJobChange = (r: TrackerRule): boolean =>
  /job.?change|champion/i.test(`${r.id} ${r.name}`);

// Parse an unknown Fiber payload into our shape. Throws on a totally unrecognized
// envelope or an empty result, so the caller can fall back to the catalog.
export function normalizeLiveRules(payload: unknown): RulesResult {
  const parsed = liveRulesV.parse(payload);
  const rules = parsed.filter((r): r is TrackerRule => r !== null);
  if (rules.length === 0) throw new Error("Fiber returned no tracker rules");
  // Flag the job-change rule as hero if it's present in the live set.
  return {
    rules: rules.map((r) => (isJobChange(r) ? { ...r, hero: true } : r)),
    source: "live",
  };
}
