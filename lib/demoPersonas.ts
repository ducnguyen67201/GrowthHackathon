// Demo-only target dossiers for the Live re-trigger. Presentation data (deal value,
// recent "why-now" signals) that isn't in the seed — it makes the target feel like a real
// person the engine pulled up, reliably, with no live network call. The three seeded ones
// match the names used across the app; anything else gets a believable deterministic
// fallback so a typed company still looks researched.
// ponytail: hand-authored fixtures + hash fallback — swap for live Fiber enrichment
//           (lib/fiber.ts already does it) if you want this truly live instead of demo-safe.

export type Persona = {
  name: string;
  title: string;
  company: string;
  domain: string;
  employees: string;
  avatar: string; // initials
  dealValue: string;
  lostAgo: string;
  quote: string;
  signals: string[]; // "why now" — what changed on their side, real-looking
  seeded: boolean; // true = curated demo deal, false = generated fallback
};

const SEEDED: Record<string, Persona> = {
  forge: {
    name: "Marcus Olsson",
    title: "Analytics Lead",
    company: "Forge Analytics",
    domain: "forge-analytics.com",
    employees: "~140",
    avatar: "MO",
    dealValue: "$48k/yr",
    lostAgo: "14 months ago",
    quote: "Your API is too limited for our data team.",
    signals: [
      "LinkedIn · 3d ago: “re-evaluating our analytics vendors this quarter”",
      "Forge raised a $12M Series B (Jun 2026) — new data-platform budget",
    ],
    seeded: true,
  },
  lattice: {
    name: "Devin Lin",
    title: "VP Engineering",
    company: "Lattice Commerce",
    domain: "latticecommerce.com",
    employees: "~320",
    avatar: "DL",
    dealValue: "$71k/yr",
    lostAgo: "9 months ago",
    quote: "No Snowflake connector — it doesn’t fit our warehouse.",
    signals: [
      "LinkedIn · 1w ago: “migrating the whole stack onto Snowflake”",
      "Hiring 2 data engineers on the team that ran the eval",
    ],
    seeded: true,
  },
  marlow: {
    name: "Lena Webb",
    title: "Eng Lead",
    company: "Marlow Health",
    domain: "marlowhealth.com",
    employees: "~90",
    avatar: "LW",
    dealValue: "$60k/yr",
    lostAgo: "13 months ago",
    quote: "No SOC2 Type II — we can’t touch PHI without it.",
    signals: [
      "New HIPAA compliance mandate hit healthcare SaaS (Q2 2026)",
      "LinkedIn · 5d ago: “locking down our vendor security review”",
    ],
    seeded: true,
  },
};

const FALLBACK_NAMES = [
  "Alex Rivera",
  "Priya Shah",
  "Jordan Cole",
  "Sam Okafor",
  "Maya Lindqvist",
];
const FALLBACK_TITLES = [
  "VP Engineering",
  "Head of Growth",
  "Director of RevOps",
  "Founder & CTO",
];
const FALLBACK_EMP = ["~60", "~120", "~240", "~400"];
const FALLBACK_VALUE = ["$36k/yr", "$52k/yr", "$68k/yr", "$84k/yr"];

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// Parse 'Company — "the reason"' (the chip / board-handoff format).
function parse(input: string): { company: string; quote: string } {
  const [head, ...rest] = input.split(/[—:–-]/);
  const company = head?.trim() || "the prospect";
  const quoted = input.match(/["“]([^"”]+)["”]/);
  const quote =
    quoted?.[1]?.trim() ||
    rest.join("-").replace(/["“”]/g, "").trim() ||
    "it wasn’t the right time";
  return { company, quote };
}

export function getPersona(input: string): Persona {
  const { company, quote } = parse(input);
  const key = company.toLowerCase();
  for (const k of Object.keys(SEEDED)) {
    if (key.includes(k)) return SEEDED[k] as Persona;
  }

  // Deterministic fallback so a typed company still looks researched (and stable on replay).
  const h = hash(company);
  const name = FALLBACK_NAMES[h % FALLBACK_NAMES.length] as string;
  return {
    name,
    title: FALLBACK_TITLES[h % FALLBACK_TITLES.length] as string,
    company,
    domain: `${company.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`,
    employees: FALLBACK_EMP[h % FALLBACK_EMP.length] as string,
    avatar: initials(name),
    dealValue: FALLBACK_VALUE[h % FALLBACK_VALUE.length] as string,
    lostAgo: `${(h % 14) + 6} months ago`,
    quote,
    signals: [
      `LinkedIn · recently: “taking another look at tooling for the team”`,
      `${company} is hiring on the team that ran the original eval`,
    ],
    seeded: false,
  };
}
