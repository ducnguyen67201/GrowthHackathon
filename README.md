# Cutthrough — the AI SDR that does the homework, and proves it

An AI SDR that figures out what a prospect cares about **right now** (from their freshest signal — funding, hiring, and their *actual recent posts* via Fiber), reasons like a senior rep about the sharpest angle, proves it understood with a personalized artifact a generic tool couldn't fake, lets a human approve, sends, and carries the reply.

> The reasoning is the product. The artifact is the proof. The human ships.

## Stack
Next.js 15 (App Router, TS) · Convex (realtime + storage) · Fiber (signal) · OpenAI (reasoning + TTS) · Satori (image artifact) · Remotion (hero video) · nodemailer + imapflow (send/reply).

## Setup
```bash
pnpm install
cp .env.example .env.local        # fill OPENAI_API_KEY, FIBER_API_KEY, GMAIL_*
npx convex dev                    # auth + codegen + push schema (creates CONVEX vars)
npx convex run seed:run           # seed fake creatives so the UI/send branches have data
pnpm dev                          # http://localhost:3000
```

## How it's built (multi-branch)
Plans live in `.claude/PRPs/plans/`:
- `wave-0-foundation.plan.md` — TS setup + contracts (this scaffold).
- `wave-1-core-loop.plan.md` — branches A·B·C·D·H (the core loop).
- `wave-2-amplifiers.plan.md` — branches E·F·G + polish.
- `cutthrough-shipping.plan.md` — the branch map + dependency DAG.

Strategy: `sales-cyborg-cutthrough.plan.md`. Hour-by-hour: `TIMELINE.md`.

## License
MIT
