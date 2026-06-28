# Plan: Cutthrough — The AI SDR That Reads the Room (and Proves It)

> YC AI Growth Hackathon · Track: **Sales Cyborgs** · Solo · 24h · brand-new open-source repo · judged Sun 5pm.

### How to read this doc (where you're heading)
1. **NORTH STAR** — identity + wedge. *Never drift from this.*
2. **WHY THIS WINS** — the judgment-first thesis + where to spend hours.
3. **60-SECOND PITCH** — what you say at judging.
4. **Flow / Components / Data Model** — what it is and how it works.
5. **Build Order + 24h Schedule + Step-by-Step Tasks** — exactly what to do, hour by hour.
6. **WIN AMPLIFIERS** — the gap-fills that move the number.
7. **Risks / Fallback Ladder** — so there's always a working demo.

**One-line north star:** *An AI that reads a prospect's freshest, most personal signal — their actual recent posts, their funding, their hires — reasons like a great SDR about what they care about right now, proves it understood with an artifact a generic tool could never fake, and carries the reply. The human approves; the AI does the judgment.*

> **The image is not the product. The judgment is the product. The image is the proof the judgment was right.**

## Summary
An AI **sales cyborg** that automates the *thinking* a great SDR does — not the typing. One sentence of ICP → Fiber finds + enriches real accounts, including each contact's **recent X/Instagram posts** (Fiber social lookup) → an **SDR-brain agent** reasons from that signal to the prospect's current situation, the relevant pain, and the sharpest angle (and says *why this angle beats the alternatives*) → it generates a **personalized visual + 2-line message** as *proof it understood* → a human rep reviews the reasoning, edits, approves, sends → **and when the prospect replies, the agent drafts the contextual follow-up.** WOW = watch it think like your best rep on a company a judge knows cold, be right, and carry the conversation — at a scale no human matches.

## User Story
As a **sales rep (AE/SDR)**, I want an agent that does the *research and judgment* part of outbound for me — figure out what each prospect actually cares about right now, pick the angle, prove it knows them, and draft the follow-ups — so I spend my time approving and closing instead of stalking LinkedIn for 20 minutes per lead.

## Problem → Solution
**Now:** AI gave everyone the same gray-text email generator. Reply rates collapsed because the *judgment* is missing — the bots don't actually understand the prospect, they just template. The one thing that works (proving you did the homework) takes ~20 min of research per lead, so reps can't scale it.
**After:** That 20 minutes of *judgment* becomes one click. Fiber supplies the real, fresh facts — including what the person literally just posted. The agent reasons to the right angle, proves it understood with an artifact you can't fake, and handles the reply. **AI-enhanced sales = automated judgment, not faster spam.**

## Metadata
- **Complexity**: Large (greenfield, external integrations, real-time UI, batch job) — ruthlessly scoped to a 24h single-pass build.
- **Source PRD**: N/A (free-form hackathon brief)
- **Profile**: Solo · pure-engineering edge · judgment-first, verifiable
- **Estimated surface**: ~14–18 files, one Next.js app + Convex backend + a few Node scripts.

---

## The Thesis (say this first — it's what makes it WIN, not LARP)
> "AI didn't make sales better — it made everyone's outbound *identical gray text*, because the bots template words but don't have **judgment**. A great SDR's edge was never typing speed — it was *reading the room*: knowing what this specific person cares about right now and what to say about it. **That** is what we automated. And the proof it actually understood is an artifact a generic tool could never produce — a personalized visual about *their* exact situation. The human approves; the AI does the thinking. That's the cyborg."

**Why now:** a person's *live* situation became an API call — Fiber returns not just funding/hires but their **actual recent X/Instagram posts**. Plus image gen got good enough to be a comprehension lie-detector. Those just crossed. That's the YC "why now."

---

## NORTH STAR — read this first (identity, never drift)

**Track:** Sales Cyborgs — **AI-Enhanced Sales.** We automate the SDR's *judgment*, the human ships. Locked. Not ad gen, not virality, not analytics, not an image tool.

**The wedge (the defensible insight):**
> "Everyone automated the *words* of sales and made spam faster. We automated the *judgment* — reading what a prospect cares about right now and deciding what to say. The personalized artifact isn't the gimmick; it's the **proof of comprehension**: a generic tool literally can't make a specific-and-correct image, so the artifact is a lie-detector for whether the AI really understood. And we don't stop at hello — we carry the reply."

- The "reinventing" = automating the *judgment layer*, not the typing layer. Everyone else makes the old motion faster (more spam). We make the *decision* a senior rep makes.
- **The image's job:** prove the AI understood. If it could make *this* about you, it gets you. That kills both the "gimmick" objection and the "thin wrapper" objection in one move.
- The chain, one breath: **reads their real recent signal → reasons to what they care about → proves it understood → carries the reply.** *(judgment, verified, then sustained.)*

**What it IS vs what it is NOT** (kills the recurring confusion):

| | "Faster spam" AI-SDR (NOT us) | Cutthrough (us) |
|---|---|---|
| What's automated | the words (templating) | **the judgment (what to say & why)** |
| Signal depth | firmographics | **firmographics + their actual recent posts** |
| The visual is… | a gimmick/decoration | **proof of comprehension (can't fake it)** |
| Conversation | one-shot blast | **reads the reply, drafts the follow-up** |
| Win = | volume sent | **right judgment, verifiable, sustained** |

**Image gen is the PROOF, not the moat.** `gpt-image-1` is a commodity. The moat is: deepest live signal (incl. social) → correct sales judgment → an artifact that proves it → a conversation it can carry. The artifact makes them look twice; **the judgment + the reply loop win.**

---

## WHY THIS WINS — where to spend the hours

A growth judge (operator + founder) scores on weighted axes. Spend hours where the green clusters on the heavy ones. **Note how the ranking moved: the engine and the conversation now outrank the artifact.**

| Element | Proof (heaviest) | Moat (heavy) | Track-fit ("is it *sales*?") | Insight | Sticky | Rank |
|---|---|---|---|---|---|---|
| **The SDR-brain reasoning chain** (signal→angle, *why*) | 🟢🟢 | 🟢🟢🟢 | 🟢🟢🟢 | 🟢🟢🟢 | 🟢 | **#1** |
| **Verifiable on the judge's own company** (live) | 🟢🟢🟢 | 🟡 | 🟢🟢 | 🟢 | 🟢 | **#2** |
| **Reply loop** (reads reply → drafts follow-up) | 🟢🟢 | 🟢🟢 | 🟢🟢🟢 | 🟢 | 🟢🟢 | **#3** |
| **Social-signal depth** (their actual recent posts) | 🟢🟢 | 🟢🟢🟢 | 🟢 | 🟢🟢🟢 | 🟢 | **#4** |
| **The proof-artifact** (personalized visual) | 🟡 | 🔴 | 🟡 | 🟡 | 🟢 | #5 (proof, not hero) |
| **Coverage at scale** (whole ICP researched overnight) | 🟡 | 🟡 | 🟢 | 🟡 | 🟢🟢 | #6 |
| **Raw image gen** | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 | bottom (commodity) |

**Rule:** an hour exposing the *reasoning* or building the *reply loop* buys more rank than an hour making the visual prettier. The visual *looks* like the wow but loses the heavy axes; the **judgment** wins them.

### The 5 WOW moves (priority order)
1. **The visible reasoning chain** *(P0 — the thing that wins).* Every card shows: *saw → inferred → relevant pain → chosen angle → why this beats the alternatives → confidence.* This is the SDR brain working out loud. **This is what makes it "AI-enhanced sales" and not "an image tool."**
2. **Live, verifiable on the judges' own companies** *(P0 — the unforgettable beat).* "Name a company you know." → ~90s → it shows its *reasoning* + the artifact about a company the judge knows cold, so they personally confirm "yeah, that's actually our situation." Domain-expert validation in real time = impossible to dismiss. Cached backups ready.
3. **The reply loop** *(P0 — what makes it a sales *rep*, not a postcard).* A real reply comes in → the agent reads it in context → drafts the next message / booking. "It doesn't just open — it carries the conversation." This single beat separates you from every one-shot AI-SDR in the track.
4. **Social-signal depth** *(P1 — the insight edge).* It anchors on what the person *literally just posted* (Fiber X/Instagram lookup), not just "you raised." "It saw your tweet from Tuesday." Deepest, freshest, most personal signal in the room.
5. **Coverage at scale** *(P1 — the throughput gut-punch).* The whole ICP — researched, judged, drafted — overnight. Framed as "your Monday pipeline, ready," not "500 memes." Volume of *judgment*, not volume of spam.

---

## THE 60-SECOND PITCH (say this at judging)

> **(Problem)** "AI didn't fix outbound — it made everyone's identical. The bots template words but have no *judgment*, so reply rates collapsed.
> **(Insight/wedge)** A great SDR's real edge was never typing — it was *reading the room*: knowing what this person cares about right now. That's the part we automated.
> **(What — show, don't tell)** Watch. [name a company] — Cutthrough pulls their freshest signal, including what their team *literally just posted*, and reasons out loud: it saw this, inferred that, chose this angle because it beats the obvious one. And the proof it actually understood? This — a personalized visual a generic tool could never make about *your* exact situation.
> **(Depth — the loop)** When they reply, it reads the reply and drafts the follow-up. It doesn't just say hello — it carries the conversation. The rep approves; the AI does the thinking.
> **(Scale)** It did this for our entire ICP overnight — a day of an SDR's research and judgment, done before I woke up. Here's the pipeline, ready to approve.
> **(Business)** Per-seat for SDR teams today; a judgment-and-conversation layer for all of outbound tomorrow. The model's a commodity — our moat is the deepest live signal plus the judgment-and-reply loop that compounds with data.
> **(Close)** We didn't automate the words of sales. We automated the *judgment*. Name another company — I'll show you."

**Competitor one-liners (for Q&A):** Clay enriches but you still write the gray text · Sendspark/Tavus do video but manual + no judgment · Instantly blasts volume with no brain · **we automate the judgment + carry the reply, grounded in the freshest signal (incl. social).**

---

## Expected End-to-End Flow

```
                      ┌─────────────────────────────────────────────┐
  rep types ICP  ───▶ │  "Series A devtools that just hired 1st SDR" │
  or a company        └─────────────────────────────────────────────┘
        │
        ▼
  ┌───────────────────────────────────────────────────────────────┐
  │ FIBER (signal layer — REST or MCP v2)                          │
  │  textToCompanySearch / companySearch → matching accounts      │
  │  peopleSearch → the right contact at each                     │
  │  profileLiveEnrich / KitchenSinkProfile → 44+ fresh fields    │
  │  social-media-lookup (X / Instagram) → their RECENT POSTS  ◀── │ the insight edge
  │  syncQuickContactReveal → verified work email                 │
  │  ⇒ per lead: {name, company, title, email, firmographic       │
  │     signals, RECENT SOCIAL POSTS, sources, chargeInfo}        │
  └───────────────────────────────────────────────────────────────┘
        │  (writes to Convex; chargeInfo logged)
        ▼
  ┌───────────────────────────────────────────────────────────────┐
  │ ★ SDR-BRAIN agent (OpenAI) — THE HERO ★                        │
  │  reasons over ALL signal (incl. their posts):                 │
  │    saw → inferred situation → relevant pain → chosen angle     │
  │    → WHY this angle beats the obvious one → confidence         │
  │  rejects weak/no-signal leads. Outputs a full reasoning chain. │
  └───────────────────────────────────────────────────────────────┘
        │
        ├─────────────────────────────┬───────────────────────────┐
        ▼                             ▼                           ▼
  ┌──────────────┐            ┌──────────────┐           ┌──────────────┐
  │ ARTIFACT     │            │ WRITER agent │           │ reasoning    │
  │ Satori tmpl  │            │ 2-line msg + │           │ chain stored │
  │ + REAL logo/ │            │ the ask      │           │ → shown on   │
  │ screenshot   │            │              │           │ the card     │
  │ (=proof)     │            │              │           │              │
  └──────────────┘            └──────────────┘           └──────────────┘
        │                             │
        └──────────────┬──────────────┘
                       ▼
        ┌───────────────────────────────────────────────┐
        │ CYBORG DASHBOARD (Next + Convex RT)            │
        │  card = artifact + copy + ★the reasoning chain★ │
        │  rep: read reasoning / edit / approve          │
        └───────────────────────────────────────────────┘
                       │  (HERO account, live-gen) → upgrade
                       ▼
        ┌───────────────────────────────────────────────┐
        │ VIDEO HERO: Remotion template (real logo +     │
        │  data animates in) + OpenAI TTS voiceover →    │
        │  MP4. [Sora = optional pre-rendered backdrop]  │
        └───────────────────────────────────────────────┘
                       │  approve
                       ▼
        ┌───────────────────────────────────────────────┐
        │ SEND (Gmail via nodemailer + app password)     │
        │  + open pixel + reply poll (IMAP)              │
        └───────────────────────────────────────────────┘
                       │  prospect replies
                       ▼
        ┌───────────────────────────────────────────────┐
        │ ★ REPLY CYBORG ★ reads reply in context →      │
        │   drafts the contextual follow-up / booking    │
        │   → back to dashboard for human approve        │
        └───────────────────────────────────────────────┘

  LIVE-GEN: "name any company" → full loop + reasoning shown → finished card in ~90s
```

---

## Component Responsibilities (what each piece does + performs)

| Component | Tech | Responsibility | "Performs" / output |
|---|---|---|---|
| **Fiber client** | REST (`x-api-key`) or MCP v2 | Discover → find contact → live-enrich → **social lookup (X/IG recent posts)** → reveal email. Surface the freshest, most personal signal. | `{lead, company, title, email, firmoSignals, socialPosts[], sources, chargeInfo}` |
| **★ SDR-brain (Strategist) ★** | OpenAI (`gpt-4.x`) | **The hero.** Reason from all signal (esp. recent posts) to: situation, pain, angle, *why this angle over the obvious*, confidence. Reject weak leads. | `{saw, inferred, pain, angle, whyThisAngle, anchorFact, sources[], confidence}` |
| **Proof artifact (Image) — the core** | **Satori (HTML→PNG)** template + **real Fiber logo/screenshot** | Personalized visual on the anchor — *proof it understood*. **Designed template, real specifics filled in** (name/logo/fact/post). Never let a model *draw* logos/text. Fast + deterministic + crisp. `gpt-image-1` only for an optional backdrop scene. 2 variants. | PNG → Convex storage → url |
| **Video hero (Tier-2)** | **Remotion** (React→MP4) + **OpenAI TTS** voiceover [+ optional **Sora 2** backdrop, pre-rendered] | The gasp beat for ONE live-gen / whale account: real logo + data **animate in**, AI voiceover says their name + exact situation. Same template discipline — specifics overlaid, never generated. | MP4 → Convex storage → url |
| **Writer** | OpenAI | 2-line message framing the artifact + a soft ask. Warm, specific, never generic. 2 variants. | `{copy[], subject}` |
| **★ Reply Cyborg ★** | OpenAI | Read inbound reply + original thread/context → draft the contextual next message or booking ask. | `{draftReply, intent, suggestedAction}` |
| **Cyborg dashboard** | Next.js + Convex RT | Pipeline of accounts; per-card **reasoning chain**, artifact, copy, approve; reply inbox with AI drafts; live-gen box. | the demo surface |
| **Sender** | nodemailer + Gmail app password | Send approved creative. Embed open pixel. | `send` row, message-id |
| **★ Orange Slice harness ★** | their package / MCP (confirm in Slack) | **Execution layer.** `execute(approvedCard)` → multichannel send (email/DM/call) as GTM code; `enrichFallback` waterfalls contacts when Fiber misses. Behind `lib/orangeslice.ts`. | `{channel, status, providerLog}` |
| **Tracker** | Next pixel route + IMAP poll | Log opens; poll inbox, match replies by sender → trigger Reply Cyborg. | open/reply timestamps |
| **Batch runner** | Node script | Overnight: real ICP companies through the full loop (incl. social **batch** lookup), parallelized + cached + rate-limited. | the coverage pipeline |
| **Live-gen route** | Next API route | "name any company" → full loop with **reasoning streamed** → ~60–90s finished card. Pre-warmed + cached backups. | the interactive WOW |

---

## Data Model (Convex)

```
companies   { fiberId, name, domain, firmoSignals, signalSource, enrichedAt, raw }
people      { companyId, fiberId, name, title, email, linkedin,
              socialPosts[],            // {platform, text, url, postedAt} from social lookup
              enrichedAt, raw }
creatives   { companyId, personId,
              reasoning: { saw, inferred, pain, angle, whyThisAngle, confidence },
              anchorFact, sources[],    // every claim → a real Fiber field / post url
              artifactStorageId, artifactPrompt, copyVariants[], chosenCopy,
              status: "draft"|"approved"|"sent"|"failed", runId, createdAt }
sends       { creativeId, to, subject, messageId, sentAt, openedAt, repliedAt, channel }
replies     { sendId, inboundText, receivedAt,
              draftReply, intent, suggestedAction, draftStatus }   // ★ reply loop
runs        { type: "live"|"batch", status, total, done, failed, costCredits, startedAt }
log         { runId, companyId, level, message, ts }   // agent reasoning → demo log
```
Artifacts live in **Convex file storage** (`ctx.storage`), referenced by `artifactStorageId`. Convex real-time subscriptions feed the dashboard for free (sponsor points + zero polling code). `sources[]` on every creative is what makes the reasoning *verifiable*.

---

## External Documentation (read first — already captured here)

| Topic | Source | Key takeaway |
|---|---|---|
| Fiber routing/ops | `api.fiber.ai/llms.txt`, `api.fiber.ai/ai-docs/index.md` | Machine-readable docs for agents; canonical endpoint list |
| Fiber search | `POST /v1/companySearch`, `/v1/peopleSearch`, `textToCompanySearch` | 1 credit/result; free `companyCount`/`peopleSearchCount` to dry-run |
| Fiber enrich | `profileLiveEnrich` (live LinkedIn, ~2–4s, 1cr), `KitchenSinkProfile` (44+ fields), `syncQuickContactReveal` (work email 2cr) | Fresh firmographic signal |
| **Fiber social ★** | `POST /v1/social-media-lookup/trigger` + `/v1/social-media-lookup/polling` (single); `/v1/social-media-lookup/batch/trigger` + `/batch/poll` (X, Instagram); webhook `social_media_lookup.completed`. Also: X tweet search/details, IG posts, **LinkedIn post activity/comments/reactions** | **The insight edge** — a person's *actual recent posts*. Single for live-gen, **batch for the overnight coverage run**. Async: trigger → poll (or webhook). |
| **Fiber tracker/signals ★** | `GET listAvailableTrackerRules` (52 signal types: funding, hiring, job changes) · `POST previewTrackerSignal` · `POST fireTrackerDummy` (all **free**) | **The spine.** "We watch 52 trigger types and fire reasoned outbound when one hits." Demo without waiting for a live webhook: replay real recent signals + dummy-fire the signal→action path. |
| **Fiber job intel** | job postings search/count · job-change tracking · `jdToProfileSearch` | Job change = the best real sales trigger ("your champion just moved"); "they posted 5 SDR roles" = juiciest hiring signal. Feeds the brain. |
| **Fiber logos** | bulk company **logo** fetch · webpage screenshots | **Kills the logo-mangling risk** — composite the *real* logo (not gpt-image-1's hallucinated one) into the artifact. Looks legit. |
| **Fiber GitHub map** *(optional)* | GitHub username → LinkedIn URL | Devtools niche only: reason from a target's actual GitHub. Gate behind time. |
| **Fiber validation** | email bounce detection · phone validation | Protects the send (deliverability) — validate before the 20–40 cold sends. |
| Fiber batch enrich | `startBatchContactDetails` + `pollBatchContactDetails` (10–2000) | Use for the overnight pipeline |
| Fiber MCP | `https://mcp.fiber.ai/mcp/v2`, header `x-api-key: $FIBER_API_KEY` | **Use v2 (API key)** — simpler than v3 OAuth for a hackathon |
| Fiber cost | `GET /v1/get-org-credits?apiKey=…` (free); every charge returns `chargeInfo` | Surface `chargeInfo` verbatim → "budget-aware agent" beat |
| **Artifact: Satori** | `@vercel/og` / `satori` HTML→PNG | **The core artifact engine.** Designed template, real data filled in — crisp logos/text, fast, deterministic. No slop, no gen-latency gamble. |
| **Video: Remotion** | `remotion` React→MP4 | Data-driven personalized video; one template → N MP4s. Specifics overlaid (never generated). The Tier-2 hero. |
| **Voice: OpenAI TTS** | `audio.speech.create` | Voiceover track for the hero video — names them + their exact fact. |
| OpenAI images | `images.generate({ model:"gpt-image-1" })` returns b64 | **Backdrop/scene only** — never logos/text. ~10–25s/image → pre-render, cache, never gen the pipeline live. |
| Sora 2 *(optional)* | `sora-2` ($0.10/s 720p), `sora-2-pro` ($0.30–0.50/s); 4/8/12s | **Optional cinematic backdrop for the ONE hero video, PRE-RENDERED** (too slow/uncertain for live). Specifics still overlaid via Remotion. Can't render logos/text — don't try. |
| Convex | files + real-time queries | `ctx.storage.store()` for artifacts (PNG + MP4); `useQuery` auto-subscribes |
| Gmail send | nodemailer + **app password** | Skip OAuth — app password is the lazy path; low volume avoids spam flags |
| **Orange Slice** | their **coding-agent package / MCP** (confirm in their Slack at H0) — bundles many enrichment providers + a sales-agent harness | **The execution layer.** `enrichFallback(person)` when Fiber misses a contact; `execute(approvedCard)` ships approved outreach multichannel (email/DM/call) as GTM code. Wrap behind `lib/orangeslice.ts`; surface its cost like Fiber `chargeInfo`. |

GOTCHA log:
- `KEY_INSIGHT:` social lookup is **async** (trigger → poll/webhook) → **APPLIES_TO** live-gen latency → **GOTCHA** fire the social trigger *first*, run enrich in parallel while it cooks; poll with a timeout and degrade gracefully to firmographic-only if it's slow.
- `KEY_INSIGHT:` **the artifact is Satori (template + real assets), NOT pure image-gen** → **APPLIES_TO** quality + live-gen speed → **GOTCHA** Satori renders crisp + instant + deterministic (no slop, no 25s wait). `gpt-image-1`/Sora are *backdrop only*, pre-rendered + cached, never drawing logos/text. The whole "make them wow" hinges on this: designed frame, real specifics filled in.
- `KEY_INSIGHT:` Fiber charges per result → **APPLIES_TO** batch run → **GOTCHA** call free `companyCount`/`get-org-credits` first, cap the run (≤300), log `chargeInfo`. Social lookup is extra credits — budget it.
- `KEY_INSIGHT:` the *reasoning* is the product → **APPLIES_TO** the whole demo → **GOTCHA** never hide the chain behind a popover only; make "saw → inferred → why this angle" first-class on the card. A judge must see the brain in 2 seconds.
- `KEY_INSIGHT:` cold email deliverability is real → **APPLIES_TO** reply loop → **GOTCHA** low volume (20–40), surgical, plain text; replies are *upside that powers the loop*, never the headline metric.

---

## Architecture / Strategic Design

- **Approach**: Single Next.js app (App Router) + Convex backend. Agents run as Convex actions / Node scripts that call Fiber + OpenAI and write to Convex. The dashboard is a thin real-time view. The **reasoning chain is a first-class data object**, not an afterthought — it's the hero, so it's modeled and rendered like one.
- **Why this stack**: every piece is a sponsor (OpenAI, Convex, Fiber) or zero-infra (nodemailer). Convex RT removes all polling/websocket code. Maximizes WOW-per-line for a solo dev.
- **Alternatives rejected**: (a) *image-tool framing* — loses the heavy axes, reads as a gimmick/wrapper, fails track-fit; we make **judgment** the hero instead. (b) *autonomous SDR with no human* — LARP risk; cyborg = human approves. (c) *self-optimizing bandit as a headline* — theater on 24h data; cut in favor of the **reply loop**, which is real depth a judge can verify. (d) *video-first* — latency/stitching eats the 24h.
- **Scope (WILL build)**: Fiber enrich + **social lookup** → SDR-brain reasoning → **Satori artifact** (real logo/data) + copy → review dashboard *with the chain* → send → reply track → **reply cyborg (draft follow-up)** → overnight coverage run → live-gen with streamed reasoning → **one Remotion+TTS video hero (Tier-2)**.
- **Artifact stack (locked)**: **Satori** = the core image (every card), real assets filled into a designed template. **Remotion + OpenAI TTS** = the one live video hero. **gpt-image-1 / Sora 2** = optional pre-rendered *backdrop* only — never logos/text. Principle: *designed frame + real specifics, never let a model draw the specifics.*
- **NOT building**: auth/multi-user, billing, CRM sync, real A/B framework, multi-armed bandit, video (unless hours remain), mobile, settings, agent "autonomy" theater, anything not in the demo.

---

## Orange Slice — the go-to-market execution harness (how to use it + the WOW finish)

> Adds a **fourth sponsor with a distinct job** and gives the demo its mic-drop. Slots in *without* touching the judgment-first core — the brain is still the hero; Orange Slice is what makes the judgment *real*.

**The clean division of labor (this is the system a growth engineer would actually build):**

| Sponsor | One job |
|---|---|
| **Fiber** | the freshest **signal** (funding, hiring, their actual recent posts) |
| **OpenAI (SDR-brain)** | the **judgment** — what to say & why |
| **★ Orange Slice ★** | the **execution** — ship the approved judgment as GTM *code*: multichannel send + enrichment waterfall |
| **Convex** | the **spine** — realtime pipeline + storage |

No overlap, so no "why two enrichment tools?" question. Four sponsors, four jobs, one system.

**Two plug-in points — both thin, both behind one adapter, neither can sink the core:**

1. **Enrichment waterfall (cheap, real GTM practice).** Fiber stays primary for signal + social. When Fiber returns no verified email/phone, fall through to **Orange Slice's bundled providers** to fill the gap → buys a real **contact-coverage %** metric and protects deliverability. `orangeslice.enrichFallback(person)`.
2. ★ **The execution harness = the WOW finale.** Today the approved card only emails via Gmail. With Orange Slice, hit Approve and the harness *executes* the whole reasoned pipeline across the channel each prospect actually lives on — email, X DM, a call for the whale — as a sales agent you programmed. "We didn't just draft the judgment. We shipped it as go-to-market code, on the right channel, live." `orangeslice.execute(approvedCard)`.

**How to wire it (lazy + swappable):**
- `lib/orangeslice.ts` — one thin adapter, two methods: `enrichFallback(person)` and `execute(approvedCard) → {channel, status, providerLog}`.
- Confirm the exact package/MCP surface in the **Orange Slice Slack at H0** (5 min). Wrap whatever it is behind those two methods so the pipeline never sees the SDK. `// ponytail: adapter — the SDK can change without touching the app`.
- Surface its `providerLog`/cost the same way you surface Fiber `chargeInfo` → the "budget-aware GTM engineer" beat now spans **two** providers.

**Honesty guard (stay a cyborg):** Orange Slice only *executes what the human approved*. Don't claim fully-autonomous outreach — claim "approved judgment, executed as code, on the right channel." If the harness flakes mid-demo, the **Gmail send still fires** — the finale survives either way.

---

## Build Order — Priority Ladder (there is ALWAYS a working demo)

1. **ONE correct judgment** on a real company from real Fiber signal (incl. one social post) — the reasoning chain reads like a sharp SDR *and* the proof artifact is genuinely good. *If the reasoning isn't impressive, fix the SDR-brain prompt before anything else. Everything is downstream of "the judgment is right."*
2. **The loop** producing {reasoning + artifact + copy} for ~5 real recognizable companies.
3. **Dashboard with the reasoning chain front-and-center** — the judgment WOW, even with 5 cards.
4. **Send + reply tracking → reply cyborg** (drafts the follow-up). *The depth beat.*
5. **Live-gen fast path** ("name any company", reasoning streamed) — the interactive, verifiable WOW.
6. **Overnight coverage run at scale** (200–300, incl. social batch) — the throughput WOW.
7. **Polish + (optional) video** — garnish, only if hours remain.

Each rung is a shippable demo. Stop climbing when time runs out; you still have a complete story. **Note:** live-gen (#5) is promoted above the scale run (#6) — verifiability beats volume.

---

## 24-Hour Timeboxed Schedule (Sat 5pm kickoff → Sun 5pm judging)

| Time | Hours | Goal | Done = |
|---|---|---|---|
| Sat 5–6pm | **H0 UNBLOCK** | Confirm Fiber access; by hand: `textToCompanySearch` → `peopleSearch` → `profileLiveEnrich` → **`social-media-lookup` (trigger+poll)** → `syncQuickContactReveal`; generate ONE good proof artifact via `gpt-image-1`. Write ONE great SDR-brain reasoning chain by hand from real signal. `git init`. | A real email + real signal **+ a real recent post** + a reasoning chain that reads like a sharp SDR + an artifact you'd send. |
| Sat 6–7pm | H1 | Convex project + schema; Fiber client (REST or MCP v2); enrich + social-lookup one lead end-to-end **into Convex**. | One `companies`+`people` row incl. `socialPosts[]` from a real call. |
| Sat 7–9pm | H2–4 | **THE BRAIN**: SDR-brain agent (saw→inferred→angle→why→confidence) → proof artifact (2 variants) → writer. Nail *judgment quality* on 5 real companies. | 5 cards whose **reasoning is genuinely sharp** and traceable to real fields/posts. |
| Sat 9–11pm | H4–6 | Cyborg dashboard: pipeline grid (Convex RT), **the reasoning chain rendered first-class**, sources popover, edit/approve. | You can read the brain's logic + approve in the UI. |
| Sat 11pm–1am | H6–8 | Send (nodemailer + app password) + open pixel + IMAP reply poll + **Reply Cyborg** (reply → drafted follow-up on the dashboard). | A real email sends; a manual reply produces an AI-drafted follow-up. |
| Sun 1–2am | H8–9 | **Kick off OVERNIGHT COVERAGE run** (200–300 real ICP cos, incl. social **batch** lookup), parallelized (cap 5), cached, credit-checked, `chargeInfo` logged. | Run writing reasoned cards live to the pipeline. |
| Sun 2–8am | H9–15 | **Sleep in shifts / babysit.** Restart on failures. Let coverage grow. | Wake to a full, reasoned pipeline. |
| Sun 8–10am | H15–17 | Live-gen fast path ("name any company" → reasoning streamed → 60–90s) + pre-render backups for likely judge/sponsor inputs. | Type a company → watch it think → finished card. |
| Sun 10am–12pm | H17–19 | Projector polish: make the **reasoning chain** legible and beautiful at 10ft; pipeline view; reply-inbox view; branding; one strong type pairing. | Looks designed; the brain is the visual focus. |
| Sun 12–2pm | H19–21 | Harden live-gen + reply loop; seed 2–3 real reply threads (warm-reachable contacts) so the loop demos live. | Reply loop works on real threads on stage. |
| Sun 2–4pm | H21–23 | README + open-source + rehearse demo + **record backup demo video**. | Repo public; demo rehearsed; backup recorded. |
| Sun 4–5pm | H23–24 | Final prep + buffer. *(Video Tier-2 only if absurdly ahead.)* | Calm. |

Rule: **don't write loop code until one correct reasoning chain + one good artifact exist by hand (H0).** Everything is downstream of "the judgment is right."

---

## Step-by-Step Tasks

### Task 0 — Unblock (H0)
- **ACTION**: Prove the hard dependencies + the *judgment* by hand before any app code.
- **IMPLEMENT**: `curl` Fiber `textToCompanySearch` → `peopleSearch` → `profileLiveEnrich` → **`social-media-lookup/trigger` then `/polling`** → `syncQuickContactReveal`; a 10-line Node script calling `gpt-image-1`. Then *by hand*, write the SDR-brain reasoning chain from the real signal.
- **VALIDATE**: You hold a real email, a real recent post, a reasoning chain that reads like a sharp SDR, and an artifact you'd send.
- **GOTCHA**: If the *reasoning* is generic ("congrats on the raise"), fix the brain's prompt NOW — the judgment is the whole product. Social lookup is async: trigger first, poll with a timeout.

### Task 1 — Repo + Convex + env
- **ACTION**: New repo, Next.js (App Router, TS) + `npx convex dev`.
- **IMPLEMENT**: `convex/schema.ts` (tables above, incl. `socialPosts[]`, `reasoning`, `replies`). `.env.local`: `OPENAI_API_KEY`, `FIBER_API_KEY`, `CONVEX_DEPLOYMENT`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ORANGESLICE_API_KEY`.
- **VALIDATE**: `convex dev` runs; schema pushes clean.
- **GOTCHA**: Secrets via env only; commit `.env.example`, never `.env.local`.

### Task 2 — Fiber client (incl. social)
- **ACTION**: `lib/fiber.ts` — discover → find contact → live-enrich → **socialLookup** → reveal.
- **IMPLEMENT**: `searchCompanies`, `findContact`, `enrich`, `socialLookup(personId)` (trigger + poll helper with timeout), `revealEmail`. Header `x-api-key`. Capture `chargeInfo` from every response; expose `getCredits()`.
- **VALIDATE**: One call returns a real lead + firmographic signal + **≥1 recent post**; `chargeInfo` logged.
- **GOTCHA**: Free `companyCount`/`get-org-credits` before paid calls; cap concurrency 5; social lookup is async + extra credits — budget it, degrade to firmo-only on timeout.

### Task 3 — The SDR-brain + Writer + Proof artifact (the core)
- **ACTION**: `lib/agents.ts` — `reason(enriched)` (the hero), `writeCopy(reasoning)`; `lib/artifact.tsx` — `renderArtifact(reasoning, assets)` via **Satori**.
- **IMPLEMENT**: **SDR-brain prompt** forces a structured chain: `saw` (cite real fields/posts) → `inferred` situation → `pain` → `angle` → `whyThisAngle` (must contrast with the obvious angle) → `confidence`; low confidence → skip. Every claim maps to a `sources[]` entry (field name or post url). **Artifact = a designed Satori HTML template** with slots filled by real data: company name, **real Fiber logo**, the anchor fact, their actual post, brand color. `gpt-image-1` only for an optional backdrop. 2 template variants; cheap auto-scorer gates on specificity + safety.
- **VALIDATE**: 5 real companies → 5 sharp reasoning chains + 5 crisp on-brand artifacts; every anchor traceable to a real Fiber field/post; **logos/text are pixel-perfect** (because they're real, not generated).
- **GOTCHA**: Ban invented facts ("only use provided signal; if none, return skip"). Warm, never a roast. Public info only. **If the brain just says "congrats on the raise," the prompt is too shallow — push it to use the *social posts* for the non-obvious angle.** **Never let a model draw the logo/name/fact — Satori renders those from real data.**

### Task 4 — Cyborg dashboard (the brain, visible)
- **ACTION**: Next page = real-time grid over `creatives`, **reasoning chain first-class**.
- **IMPLEMENT**: Card: the reasoning chain (saw → inferred → angle → *why*) rendered prominently, the artifact, editable copy, a "sources" popover (field/post + url), variant switcher, Approve. Filter by status. A reasoning log panel.
- **VALIDATE**: Cards stream in live; the *logic* is readable in 2s; edit + approve works.
- **GOTCHA**: `useQuery` auto-subscribes — no polling. Don't bury the reasoning behind a click — it's the hero.

### Task 5 — Send + tracking + ★ Reply Cyborg ★ + ★ Orange Slice execution ★
- **ACTION**: `lib/mail.ts` send + `app/pixel/[id]/route.ts` open pixel + IMAP reply poll + `lib/reply.ts` reply cyborg + `lib/orangeslice.ts` (multichannel execution + enrichment waterfall).
- **IMPLEMENT**: nodemailer (app password) sends approved card. Pixel logs `openedAt`. `imapflow` poller matches inbound sender → writes a `replies` row → **Reply Cyborg reads inbound + original context → drafts the follow-up** → surfaces on the dashboard for approve. **Orange Slice harness:** on Approve, `orangeslice.execute(approvedCard)` ships the outreach on the prospect's real channel (email/DM/call) and logs its `providerLog`/cost like Fiber `chargeInfo`; Gmail send stays as the fallback path. `enrichFallback` fills any contact Fiber missed before send.
- **VALIDATE**: Real email arrives; open logs; a reply produces a contextual AI-drafted follow-up that a human would actually send.
- **GOTCHA**: Low volume (20–40), plain text + one image, real inbox. Reply poll flaky? Manual "paste a reply" box that still triggers the cyborg — so the loop always demos.

### Task 6 — Overnight coverage run (batch)
- **ACTION**: `scripts/coverage.ts` — N real ICP companies through the full loop incl. **social batch lookup**.
- **IMPLEMENT**: `companyCount` → cap (≤300) → credit check → `social-media-lookup/batch/trigger` + `/batch/poll` for the cohort → enrich + reason + generate with concurrency cap 5, cache by `companyId`, retry once, log `chargeInfo` + failures. Idempotent (skip already-done).
- **VALIDATE**: Leave running; pipeline fills to hundreds of *reasoned* cards by morning; cost within credits.
- **GOTCHA**: NEVER gen live in the demo. Checkpoint so a crash resumes. Batch social lookup is async — poll with backoff or use the `social_media_lookup.completed` webhook.

### Task 7 — Live-gen fast path (reasoning streamed)
- **ACTION**: `app/api/live/route.ts` — company name → finished card in ~60–90s, **streaming the reasoning as it thinks**.
- **IMPLEMENT**: Full loop, single lead. Fire social-lookup trigger first, run enrich in parallel while it cooks; parallelize image+copy. Stream `saw → inferred → angle` to the UI so the judge *watches it think*. Pre-render + cache likely inputs (judges' companies, sponsors, famous startups).
- **VALIDATE**: Type a company → reasoning streams → finished card under ~90s; cached inputs instant.
- **GOTCHA**: Keep a pre-rendered backup for every plausible name. If social lookup is slow, degrade to firmo-only and say so — still impressive.

### Task 8 — Open-source + demo prep
- **ACTION**: Public repo + README + rehearse + record backup.
- **IMPLEMENT**: README (thesis = *automated judgment*, arch diagram, setup, sponsors). MIT, `.env.example`. Rehearse the arc; screen-record a clean run as wifi insurance.
- **VALIDATE**: Repo public before judging; backup video exists.

### Task 9 — Video Hero (Tier-2) — *gated behind Gate 2 (Sun 1am); the gasp beat*
- **ACTION**: `remotion/HeroVideo.tsx` + `lib/video.ts` — render ONE personalized MP4 for the live-gen / whale account.
- **IMPLEMENT**: **Remotion** template: real logo lands, the anchor fact + their post **animate in** (typewriter/slide), brand-colored. **OpenAI TTS** voiceover reads a 2-sentence script (their name + exact situation) → audio track. *(Optional)* `gpt-image-1` or **Sora 2** generates a cinematic backdrop — **pre-rendered ahead of time**, specifics overlaid by Remotion on top. Never render the wall as video — image for the wall, video for the one reveal.
- **VALIDATE**: One company → a polished, spoken, branded MP4 in which the logo/name/fact are **correct**; renders fast enough to show live (or pre-rendered backup ready).
- **GOTCHA**: Specifics via Remotion overlay ONLY — Sora/gpt-image can't render logos/crisp text. **Record a flawless backup MP4 in rehearsal** — if live render flakes, play it. Cut without guilt if behind at Gate 2.

---

## The Demo Script (judgment-first arc — climbs to the verifiable WOW)

1. **Thesis (10s)** — "AI automated the *words* of sales and made spam faster. We automated the *judgment*." Frame the real wedge.
2. **Watch it think (the core)** — open a card; read the reasoning chain aloud: "it *saw* their CTO's tweet about scaling pains, *inferred* X, *chose* this angle *because* the obvious 'congrats on the raise' is what everyone sends." Click "sources" → the real post + real Fiber field. **This is the AI-enhanced-sales beat.**
3. **The proof** — "and here's how we know it understood: a generic tool can't make *this* about you." Show the artifact. (Proof, not gimmick.)
4. **Verifiable, live** — "name a company you know." Type it → reasoning streams → ~90s → a card the judge personally confirms is right. *Domain-expert validation in real time.*
4b. **The gasp (Tier-2)** — "and for the whale, one click —" → a personalized **video**: their logo + fact animate in, an **AI voiceover** names them and their exact situation. (Pre-rendered backup ready.) *"An agency week, in 90 seconds, about a company you picked."*
5. **It carries the conversation** — show a real reply → the AI-drafted contextual follow-up. "It doesn't just say hello." (The depth that beats one-shot SDRs.)
6. **Scale = judgment, not spam** — the overnight pipeline: hundreds of *reasoned* cards. "A day of an SDR's research and judgment, done while I slept. Here's the queue, ready to approve."
7. ★ **Ship it as code — the WOW finish** — "and here's what a slide deck can't fake: I approve, and **Orange Slice** — the go-to-market-engineering harness — *executes* the whole reasoned pipeline across the channel each prospect actually lives on: email here, an X DM there, a call for the whale. The judgment, shipped as GTM code, live." Hit **Approve** → the harness fans the approved cards out multichannel on screen, provider + cost logged. *(If it flakes: the Gmail send still fires — the beat survives.)*
8. **Cyborg close** — "Fiber found the freshest signal. The brain made the call. Orange Slice shipped it — on the right channel, as code. The human approved; the machine did the work. We didn't make spam faster — we automated the *judgment* and executed it. Name another company."

---

## Expected Outcomes / Metrics (what you claim on stage)

| Metric | Target for the demo |
|---|---|
| **Reasoning quality** | every card shows saw→inferred→angle→*why*, traceable to a **real field/post** (zero hallucinated facts) — *the headline* |
| **Verifiability** | judge names a company → AI's reasoning confirmed correct **by the judge**, live |
| **Reply loop** | inbound reply → contextual AI-drafted follow-up on real threads |
| **Signal depth** | anchors include a person's **actual recent post** (social lookup), not just firmographics |
| Throughput | a day of an SDR's research + judgment in **minutes** (whole ICP overnight) |
| Live gen | company name → reasoned card in **~60–90s** |
| Coverage | **200–300** reasoned accounts (the pipeline) |
| Real sends | 20–40 surgically personalized |
| Replies | upside that *powers the reply loop* — **not** a reply-rate stat on tiny N |
| Cost transparency | `chargeInfo`/credits surfaced verbatim (budget-aware agent) |
| Sponsors used | OpenAI + Convex + Fiber (signal + **social lookup**) + **Orange Slice** (enrichment waterfall + multichannel execution) |

> **Deliberately dropped:** the "{N}× reply lift" headline. On 20–40 sends it's statistical noise and a sharp judge discounts everything after it. Lead with the *verifiable* (reasoning + live-gen), keep replies as fuel for the loop.

---

## WIN AMPLIFIERS — Gap-Fill (priority-ordered, mostly cheap)

### A. The Reasoning Chain as a first-class object — *P0, the thing that wins*
- **Gap:** if the judgment is hidden in a popover, you look like an image tool.
- **Build:** model `reasoning{saw,inferred,pain,angle,whyThisAngle,confidence}` + `sources[]`; render it as the *primary* content of every card. The "why this angle beats the obvious one" line is what reads as senior-rep judgment.
- **Demo line:** "watch it think like your best SDR — out loud."

### B. The Reply Loop — *P0, makes it a sales rep not a postcard*
- **Gap:** one-shot outbound isn't "sales," and every other team in the track stops at hello.
- **Build:** reply → Reply Cyborg drafts contextual follow-up → human approves. Seed 2–3 warm-reachable threads so it demos live.
- **Demo line:** "it carries the conversation, not just the opener."

### C. Social-Signal Depth — *P0, the insight edge (now unlocked)*
- **Gap:** firmographic-only signal is what everyone has.
- **Build:** Fiber `social-media-lookup` (single for live-gen, batch for coverage). Brain must prefer a *non-obvious* angle drawn from a recent post.
- **Demo line:** "it saw what they literally posted Tuesday."

### D. Verifiable-on-judge live-gen — *P0, the unforgettable beat*
- **Build:** stream the reasoning during live-gen; pre-render backups for judges'/sponsors'/famous companies.
- **Demo line:** "name a company you know — tell me if it's right." (Let them validate it.)

### E. Niche It — *P1, beat the crowded track*
- **Commit:** **outbound for seed/Series-A startups that just raised or are hiring** — juiciest signal, literally the judges' world. Hardcode this ICP.
- **Demo line:** "we do X for Y," not "we do outbound."

### F. Curated (self-scoring) Pipeline — *P1, protect credibility*
- **Build:** scorer gates on specificity + brand-safety; only above-threshold cards display. "Every card in the pipeline is sound."

### G. 60-Second Business Pitch — *P1, GTM judges reward founder-thinking*
- **Moat answer (scripted):** "the model's a commodity; the moat is the **deepest live signal (incl. social) + the judgment-and-reply loop** that compounds into a data flywheel." Who pays: per-seat for SDR teams → judgment layer for all outbound.

### H. The Signal/Trigger Spine — *P1, the truest "growth engine" beat (replaces the cut bandit)*
- **Gap:** "rep types ICP" is pull-based; a growth *engine* is event-driven — it watches for the buying moment and acts.
- **Build (cheap):** `GET listAvailableTrackerRules` to show **"the 52 triggers our agent watches"** (funding, hiring, **job changes**). For the demo, don't wait for a live webhook — **replay real recent signals** (accounts that genuinely just raised/hired) and use `fireTrackerDummy`/`previewTrackerSignal` to demo the signal→reasoned-outbound path on stage. Job-change ("your champion moved to {co}") is the highest-converting trigger — feature it.
- **Demo line:** "It's not a tool you open — it watches for the moment someone becomes worth contacting, and acts. Here's the trigger firing → the reasoned outbound it produced."
- **Honesty guard:** triggers are *replayed real events* + dummy-fires for the demo path; never claim a live webhook fired if it didn't.

### Schedule deltas
- **C (social)** + **A (reasoning chain)** fold into the core loop (H2–6) · **B (reply loop)** into send (H6–8) · **H (trigger spine)** is mostly narrative + one free GET, fold into dashboard (H4–6) · **D (live-gen)** H15–17 · **E (niche)** decided H0 · **F + G** H17–23.

---

## Risks + Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Reasoning reads generic** ("congrats on the raise") | Med | **Critical** | Nail the SDR-brain prompt in H0; force *why-this-over-obvious*; push it to use social posts; 2 variants + auto-pick. |
| Social lookup async/slow | Med | Med | Trigger first, enrich in parallel, poll with timeout, degrade to firmo-only gracefully; batch for coverage. |
| gpt-image-1 latency tanks live demo | High | High | Pre-render pipeline + likely inputs; parallelize; cache by company; stream reasoning so wait feels productive; backup recording. |
| **Gen models mangle logo/text** (the slop trap) | High | High | **Never let a model draw logos/names/facts.** Render them from real data via **Satori (image) / Remotion (video)**; real Fiber logo + crisp template text. `gpt-image-1`/Sora are *backdrop only*. Template + real specifics = pro, not AI-slop. |
| Fiber access/credits/limits | Med | High | H0 by-hand test; `companyCount` + `get-org-credits` before batch; cap ≤300; budget social credits. |
| Reply loop has nothing to react to | Med | Med | Seed warm-reachable threads; manual "paste a reply" box always triggers the cyborg. |
| Cold email deliverability | High | Med | Low volume, high personalization, plain text, clean inbox; replies are loop-fuel, not headline. |
| "Creepy/surveillance" vibe | Med | High | Public professional info only; warm, never a roast; "sources" shows it's legit public data. |
| Reads as LARP / image-tool | Med | High | **Reasoning chain is the hero**; human-in-loop cyborg; real data; verifiable live; reply loop = real motion. |
| **Orange Slice surface unknown / flaky** | Med | Med | Thin `lib/orangeslice.ts` adapter (2 methods); confirm exact package in their Slack at H0; **Gmail send is the fallback** so the finale survives; execution gated behind Approve (stays a cyborg). |
| Solo fatigue / overnight | High | Med | Coverage runs while you sleep; priority ladder = partial is still a demo. |
| Wifi dies at judging | Med | High | Recorded backup demo + locally-cached assets + reasoning. |

---

## Scope-Cut / Fallback Ladder (graceful degradation)

- **Full**: reasoned pipeline + live-gen + send + reply loop + social signal.
- **Cut coverage scale** → live-gen + reply loop + 10 hand-picked reasoned cards. (Verifiability + depth carry it.)
- **Cut reply loop** → reasoned pipeline + verifiable live-gen. (Judgment + verifiability still win the track-fit.)
- **Cut Orange Slice execution** → fall back to the Gmail send (keep Orange Slice as enrichment-waterfall only, or cut it entirely). Judgment + live-gen still carry it.
- **Cut send** → reasoned pipeline + live-gen, framed as "research-and-judgment engine." (Still WOWs.)
- **Floor**: 10 hand-curated cards on real famous companies where the **reasoning is genuinely sharp** (incl. a social-post anchor) + the thesis + one live-gen. *Quality of the judgment > quantity of features. Even this beats a polished-but-brainless generator.*

---

## Validation Commands

```bash
npx convex dev            # EXPECT: schema pushes, no errors
npx tsc --noEmit          # EXPECT: zero type errors
node scripts/smoke-fiber.ts    # EXPECT: real email + signal + ≥1 recent post + chargeInfo
node scripts/smoke-meme.ts     # EXPECT: a proof artifact you'd actually send
node scripts/smoke-brain.ts    # EXPECT: a reasoning chain that reads like a sharp SDR, traceable to fields/posts
npm run dev               # EXPECT: pipeline renders, reasoning chain visible, cards stream in
node scripts/coverage.ts --limit 300   # EXPECT: reasoned cards fill pipeline, cost within credits
```

### Manual Validation
- [ ] H0: real email + real recent post + a sharp reasoning chain + an artifact you'd send, all by hand
- [ ] Core: 5 real companies → sharp, *traceably-true* reasoning + good artifacts
- [ ] Dashboard: reasoning chain is first-class; cards stream live; edit + approve works
- [ ] Send + reply: email arrives; open logs; a reply → contextual AI-drafted follow-up
- [ ] Coverage: hundreds of reasoned cards, cost logged, no crash
- [ ] Live-gen: company name → reasoning streams → card under ~90s; backups cached
- [ ] Repo public + README + backup demo recorded

---

## Secrets / Env (`.env.example`)
```
OPENAI_API_KEY=
FIBER_API_KEY=
CONVEX_DEPLOYMENT=
GMAIL_USER=
GMAIL_APP_PASSWORD=
ORANGESLICE_API_KEY=
```

## NOT Building (anti-scope-creep)
- Auth, multi-tenant, billing, settings UI
- CRM/Slack integrations
- Real A/B framework + multi-armed bandit (cut on purpose — theater on 24h data)
- Mobile/responsive beyond projector legibility
- "Fully autonomous" send (cyborg = human approves — on purpose)
- Video *beyond* the ONE Remotion hero clip (no per-lead video — too slow; images for the wall)
- **Shiny Fiber endpoints that don't serve the judgment**: TikTok/Reddit/YouTube, real estate & flights, local-business search, blue-collar jobs, saved-search scheduling, depth charts, typeaheads. (Fun, off-thesis, scope you don't have — YAGNI.)
- Anything not on screen during the 7-beat demo

## Risks of NOT following the ladder
Building features before the *reasoning* is genuinely sharp = a polished pipeline producing generic judgment = an image tool = loses. **The judgment quality is the moat; protect H0.**

## Notes
- Hackathon rules: brand-new codebase, open-source for the event, kickoff mandatory for credits, teams ≤4 (you're solo). Fresh repo at H0.
- Use Fiber **MCP v2** if your build agent drives it directly; use the **REST client** (`lib/fiber.ts`) for batch/live scripts — pick whichever unblocks fastest in H0.
- Social lookup is **async** (trigger → poll, or `social_media_lookup.completed` webhook). Single endpoint for live-gen; **batch** (X, Instagram) for the overnight coverage run.
- Confidence: single-pass implementable by a strong solo dev in 24h *if* the priority ladder is respected, H0 unblock passes, and the SDR-brain prompt is nailed before any scaling.
```
