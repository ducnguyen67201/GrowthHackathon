# Cutthrough — we read the minds of the deals you already lost

> YC AI Growth Hackathon · Track: **Reading Minds** (signal detection on churn) · MIT

Everyone is building cold outbound. Cold email converts at ~1% — it's a dead channel. Meanwhile every company sits on a **graveyard of closed-lost deals**: people who already evaluated you, already wanted it, and told you *exactly* why they said no. That signal is the most valuable lead data you own, and it rots in your CRM.

Cutthrough reads every lost deal, extracts **why** it died, and watches for the moment that reason **dissolves** — you shipped the feature they needed, their champion got promoted, or they raised — then scores who's ripe to re-engage *today* and returns with proof you remember.

> Cold outbound guesses who might care. We **know** who already did.

## How it works

```
closed-lost deals ──▶ extractObjection ──▶ matchRetrigger (objection × changelog) ──┐
   (first-party)        (why it died)        + external signal (Fiber: champion move) │
                                                                                      ▼
won outcomes ──▶ similarityToWon ─────────────────────────────────▶ scoreRetrigger (ranked)
 (continuous learning, no model — embeddings + cosine)                       │
                                                                             ▼
                          buildRetriggerReasoning ──▶ writeCopy + renderArtifact ──▶ send
                          (a re-trigger IS a normal creative — the whole pipeline reuses)
```

**The score is transparent** — every rank decomposes into: *we shipped it* · *they changed* · *still warm* · *looks re-won*. No black box. And it **re-scores continuously**: as deals re-close, the learning set grows and the ranking sharpens.

## Stack
Next.js 15 (App Router, TS) · Convex (realtime + storage) · OpenAI (reasoning + embeddings + TTS) · Fiber (external signal) · Satori (image artifact) · Remotion (hero video) · nodemailer + imapflow (send/reply).

## Setup
```bash
pnpm install
cp .env.example .env.local            # OPENAI_API_KEY, FIBER_API_KEY, GMAIL_*, CONVEX
npx convex dev                        # auth + codegen + push schema
npx convex run seed:seedRetrigger     # seed the dead pipeline (12 lost deals + changelog + re-wins)
set -a; . ./.env.local; set +a
pnpm retrigger                        # score the graveyard → ranked re-trigger creatives
pnpm dev                              # http://localhost:3000/signals  ← the board
```

## The engine (what's new vs reused)
| New | Reused unchanged |
|---|---|
| `lib/objections.ts` — extract + cluster why deals died | `lib/agents.ts` `writeCopy()` |
| `lib/retrigger.ts` — match + **pure** score + the Reasoning bridge | `lib/artifact.tsx` (image), `lib/video.ts` (Remotion) |
| `lib/learning.ts` — embedding similarity (continuous learning) | `lib/mail.ts` + `convex/sendEmail.ts` (send + pixel) |
| `convex/lostDeals.ts` + `lostDeals`/`changelog`/`wonOutcomes` tables | `lib/reply.ts` (carry the conversation) |
| `app/signals` ranked board · `scripts/retrigger.ts` orchestrator | the `creatives` table + dashboard |

A re-trigger output is a normal `creative`, so the entire downstream (artifact → video → send → reply) reuses by construction.

## Verify
```bash
pnpm smoke:retrigger   # deterministic: the scoring/ranking math discriminates (no API key needed)
pnpm typecheck && pnpm build
```

Plan: `.claude/PRPs/plans/completed/lost-reason-retrigger-engine.plan.md`.

## License
MIT
