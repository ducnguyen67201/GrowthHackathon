# Eval Rubric — Single-Viewport Mission Control (design-weighted)

Score each 0–10; weighted total must reach **7.5** to pass.
Evaluate the home route `/` in a real browser at a desktop viewport (≈1440×900).

## GATING CONSTRAINTS (auto-fail if any is false — check first)
- **No page scroll:** `document.body.scrollHeight <= window.innerHeight + 2`. The page fits one
  viewport. (Internal panel scrolling is fine and expected.)
- **Full-bleed:** content spans ~full viewport width; no large empty side margins.
- **All six surfaces visible without scrolling the page:** agent ticker, Regulatory Radar
  (with the $/cohort headline), ranked board, Live re-trigger panel, Brain, Pipeline stats.
- **Build/health:** `/` returns 200, no console errors.

### Design Quality (weight: 0.35)
- Reads as a friendly, warm, intentional "mission control" — not clinical, not a default grid.
- Strong focal hierarchy: the Regulatory Radar headline ($2.06M · 9 deals forced) draws the eye
  first; secondary panels support it.
- Bento composition feels balanced — panels sized by importance, aligned to a clean grid.

### Originality (weight: 0.30)
- Distinctive, memorable treatment — warmth + the "always-on agent" liveliness make it feel like
  a living cockpit, not a SaaS template.
- Would a judge screenshot it? Does it feel like a real, opinionated product?

### Craft (weight: 0.25)
- Warm palette applied consistently via tokens; rounded corners, soft shadows, good spacing rhythm.
- Density without clutter: full but breathable; internal scroll where needed, no overflow/clipping.
- Motion compositor-only (transform/opacity); `prefers-reduced-motion` respected.
- Legible; sufficient contrast on the warm surfaces.

### Functionality (weight: 0.10)
- Live panels bind to Convex data; the Live re-trigger and "Re-trigger this live" handoffs still work.
- Other routes still 200; `pnpm build` clean.

## Pass gate
- Weighted ≥ 7.5 AND no page scroll at 1440×900 AND full-bleed AND all six surfaces visible AND build clean.
