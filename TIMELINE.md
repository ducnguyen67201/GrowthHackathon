# Cutthrough — 24h Battle Card (Sat 6/27 5pm → Sun 6/28 5pm)

> Keep this open. Read the ⏰ deadline + ✅ gate for the block you're in. If you miss a gate, drop to ✂️ — don't push the deadline.
> **The one rule:** nothing scales until the *judgment is sharp* (Gate 1). A polished pipeline of generic reasoning loses.

```
SAT                                                          SUN
5pm   6pm    7pm        9pm       11pm    1am   2am ───sleep─── 8am    10am    12pm    2pm     4pm  5pm
│ H0  │ H1   │ H2–4     │ H4–6    │ H6–8  │ H8–9│      babysit   │H15–17│H17–19 │H19–21 │H21–23 │ buf │
│UNBLK│repo  │THE BRAIN │dashboard│send + │batch│               │live  │polish │harden │ship + │     │
│     │+fiber│+artifact │(brain   │reply  │kick │               │-gen  │for    │+seed  │rehrse │CALM │
│     │+convx│×5 cos    │visible) │cyborg │off  │               │      │projctr│threads│+backup│     │
▲GATE1            ▲ judgment sharp        ▲GATE2 complete mini-demo    ▲GATE4      ▲GATE5 FREEZE ▲GATE6
```

---

## ⛔ Pre-flight (do NOW, you're already ~40min into H0)
- [ ] **Get the FIBER_API_KEY** — everything real is blocked on this. Chase it first.
- [ ] While waiting on the key: design the **SDR-brain prompt** + the **Satori artifact template** (designed frame, real logo/name/fact/post filled into slots) against a *hand-written mock signal* (a real company you know, fake the fields). The moment the key lands, swap mock → real.
- [ ] `git init`, new Next.js (App Router, TS), `npx convex dev`, `.env.example`.

---

## The blocks

| Window | ⏰ Hit by | Build | ✅ Done = | ✂️ If behind |
|---|---|---|---|---|
| **H0 Unblock** | **Sat 6:00pm** | By hand: Fiber `textToCompanySearch→peopleSearch→profileLiveEnrich→social-lookup→revealEmail`; one `gpt-image-1` artifact; **write ONE reasoning chain by hand** from real signal. | A real email + a real recent post + a chain that reads like a sharp SDR + an artifact you'd send. | Key late? Design brain prompt on mock signal; do real Fiber the instant key lands. **Don't write loop code yet.** |
| **H1 Repo** | **Sat 7:00pm** | Convex schema (incl `socialPosts[]`, `reasoning`, `replies`); `lib/fiber.ts` (search/enrich/**socialLookup**/reveal/logos); enrich 1 lead → Convex. | One company+person row incl `socialPosts[]` from a real call. | Skip logos/validation endpoints for now; add in polish. |
| **H2–4 THE BRAIN** | **Sat 9:00pm** ⚠️CRIT | `lib/agents.ts`: SDR-brain (`saw→inferred→pain→angle→whyThisAngle→confidence`) → **Satori artifact** (real logo/data, 2 templates) → writer. Nail it on **5 real cos**. | 5 cards whose **reasoning is genuinely sharp** + crisp on-brand artifacts (real logos, no slop), every claim traceable to a real field/post. | Drop to 3 cos. Quality > count. If reasoning is generic, **stop and fix the prompt** — this is the product. |
| **H4–6 Dashboard** | **Sat 11:00pm** | Convex-RT grid; **reasoning chain rendered first-class**; sources popover; edit/approve. Show the 52 tracker rules ("what we watch"). | Read the brain's logic + approve in UI; cards stream live. | Skip tracker-rules panel; plain grid + reasoning is enough. |
| **H6–8 Send + Reply Cyborg** | **Sun 1:00am** ⚠️GATE2 | nodemailer (app pw) + open pixel + IMAP poll + **Reply Cyborg** (reply→drafted follow-up). | Real email sends; a reply → an AI-drafted follow-up you'd actually send. | Reply poll flaky → ship the **"paste a reply" box** that triggers the cyborg. That's enough to demo. |
| **H8–9 Kick coverage** | **Sun 2:00am** | `scripts/coverage.ts`: ≤300 cos, social **batch**, concurrency 5, cached, credit-checked, idempotent, checkpointed. Start it, watch 10 cards land clean. | Batch writing **reasoned** cards live; cost within credits. | Loop not solid? **Don't launch a broken batch.** Sleep, run a smaller batch (50) in the morning. |
| **H9–15 Sleep / babysit** | **Sun 8:00am** | Sleep in shifts. Restart on crash (checkpoint resumes). | Wake to a full reasoned pipeline. | — |
| **H15–17 Live-gen** | **Sun 10:00am** ⚠️GATE4 | `app/api/live/route.ts`: name→**reasoning streamed**→card in ~90s. Pre-render backups for judges'/sponsors'/famous cos. | Type a company → watch it think → finished card <90s; cached = instant. | Social slow → degrade to firmo-only, say so. Backups are non-negotiable. |
| **H17–19 Polish** | **Sun 12:00pm** | Projector legibility: reasoning chain beautiful at 10ft; pipeline + reply-inbox views; branding; one type pairing. | Looks designed; the brain is the visual focus. | Polish only the 3 screens the demo touches. |
| **H19–21 Harden + seed + (hero video)** | **Sun 2:00pm** ⚠️GATE5 FREEZE | Harden live-gen + reply loop; **seed 2–3 real reply threads** (warm contacts) so the loop demos live. *(If ahead:)* render the **Remotion+TTS video hero** for one whale + a backup MP4. | Reply loop works on real threads on stage; (hero video renders or is consciously cut). | **FEATURE FREEZE at 2pm. No new code after this — only rehearsal + bugfix.** Behind? Skip the video. |
| **H21–23 Ship + rehearse** | **Sun 4:00pm** ⚠️GATE6 | Public repo + README (thesis=automated judgment, arch, sponsors, MIT); rehearse the 7-beat arc; **record a clean backup demo video**. | Repo public; demo rehearsed ≥2×; backup recorded. | Backup video > everything. If wifi dies you play it. |
| **H23–24 Buffer** | **Sun 5:00pm** | Final prep. Breathe. Re-warm live-gen cache. | Calm. | — |

---

## 🚦 The 6 hard gates (the only checkpoints that matter)
1. **Sat 6pm** — a *sharp reasoning chain* + good artifact exist by hand. *Everything downstream of this.*
2. **Sun 1am** — a **complete mini-demo** exists (brain → dashboard → send → reply). You could win on just this + live-gen.
3. **Sun 2am** — coverage batch launched (or consciously deferred to morning).
4. **Sun 10am** — live-gen works with cached backups.
5. **Sun 2pm** — **FEATURE FREEZE.** Code stops; rehearsal starts.
6. **Sun 4pm** — repo public + backup video recorded.

## ✂️ Cut-ladder (when behind, drop in THIS order — never skip ahead)
1. Video (already optional)
2. Coverage *scale* → hand-pick 10–15 reasoned cards
3. Live reply loop → "paste a reply" manual trigger
4. Send → reframe as "research & judgment engine"
5. **Floor:** 10 hand-curated reasoned cards (incl. a social-post anchor) + live-gen + the thesis. *This still beats a brainless generator.*

## ☠️ The 4 ways a solo loses this (avoid on purpose)
- **Generic reasoning** → looks like an image tool. Fix the prompt at Gate 1, not at hour 23.
- **Coding past 2pm Sun** → blown rehearsal, fumbled demo. Freeze means freeze.
- **No backup video** → wifi dies, demo dies. Record by Gate 6.
- **Endpoint rabbit-hole** → you wired 10 Fiber endpoints and ran out of time. Lock the list; restraint wins.
