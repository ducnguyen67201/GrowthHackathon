# Cutthrough — Single-Viewport "Mission Control" Dashboard

## What to build
Consolidate the four separate routes (`/signals`, `/brain`, `/live`, `/`) into **ONE page**
— a single-screen **cockpit / bento dashboard** that shows everything at once. Make it the
home route `/`. Keep the other routes working (don't delete them), but `/` is now the hero.

## HARD CONSTRAINTS (these are pass/fail — verify in the browser)
1. **NO PAGE SCROLL.** The whole dashboard fits in `100vh` (and `100vw`). The `<body>`/page
   must not scroll. List-heavy panels (the ranked board, recent re-triggers) scroll
   **internally** (`overflow:auto`) — the page itself never does.
2. **FULL-BLEED.** No wasted side margins — the grid spans the full viewport width with only
   a small gutter. No centered `max-width` columns.
3. **All key components present on the one page:**
   - The **agent activity ticker** (`AgentActivity`) — keep it, it sells "always-on".
   - The **Regulatory Radar** (`RegulatoryRadar`) — the breakthrough: a law → a forced cohort.
   - The **ranked dead-pipeline board** (the re-triggers, from `RetriggerBoard`/`SignalViews`).
   - A **Live re-trigger** panel (the `/live` flow: type/click a dead deal → reasoning → card).
   - The **Brain** graph (`BrainGraph`) — can be a compact panel.
   - **Pipeline** status (sent / opened counts) — can be a compact stat strip.

## Visual direction: FRIENDLY & WARM
The current look is clinical (cool blue-white, hard edges). Make it **warm and approachable**
without losing credibility:
- Warmer surfaces: a soft cream/warm-paper background instead of cool blue-white; cards a
  touch warmer than pure white.
- Keep the emerald accent but soften it; add a warm secondary (amber/coral) for highlights.
- Rounder corners, softer/larger shadows, generous but not wasteful padding.
- Friendly, human microcopy on panel headers (e.g., "What just woke up", "Who's worth a call").
- Clear hierarchy: the Regulatory Radar headline ($2.06M · 9 deals forced) is the focal point.
- Smooth, calm motion (the agent ticker scan bar, gentle hovers) — compositor-friendly only.

## Reuse, don't rebuild
Compose the **existing** components into bento panels. Adapt their CSS for compact panels and
internal scroll. The design tokens live in `styles/tokens.css` — shift them warmer there so the
whole app benefits. Keep `pnpm build` green and every route 200.

## Thesis (so copy stays on-message)
Healthcare-SaaS, "Reading Minds": we re-open deals you lost the moment the reason they said no
stops being true — and a regulation taking effect forces a whole cohort at once.
