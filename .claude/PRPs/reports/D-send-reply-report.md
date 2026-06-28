# Implementation Report: Branch D — feat/send-reply

## Summary
Implemented the **send → reply** half of the Wave 1 core loop: an approved creative
becomes a real Gmail send with an open-tracking pixel, and an inbound reply (pasted)
becomes an AI-drafted, context-aware follow-up. Built against Wave 0 contracts and the
seeded approved creative — ships alone.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Ships alone | ✅ | ✅ (seed creative) |
| Files Changed | 5 contract files | 5 modified + 3 new |
| IMAP auto-poll | "flaky optional" | Skipped (paste path covers loop) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | `lib/mail.ts` `sendCreative` (nodemailer) | Complete | Gmail app pw, inline artifact + pixel, HTML-escaped |
| 2 | `lib/reply.ts` `draftReply` (OpenAI) | Complete | `zodResponseFormat` structured output (intent/action/draft) |
| 3 | `convex/sends.ts` | Complete | `getForSend` query + `record`/`complete`/`markOpened` mutations |
| 4 | `convex/sendEmail.ts` `send` action | Complete | **Deviation** — Node action split out of `sends.ts` |
| 5 | `convex/replies.ts` | Complete | `record`/`setDraft` mutations, `context` query, `pasteReply` action |
| 6 | `app/pixel/[id]/route.ts` | Complete | 1×1 GIF + best-effort `markOpened` |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (tsc, lib+app) | Pass | `pnpm typecheck` clean |
| Convex files (standalone) | Pass* | Only `_generated`-derived `implicit any` remain — resolve at `convex dev` codegen |
| Unit/Smoke | Pass | `pnpm smoke:send` — HTML-escape + pixel-embed asserts |
| Build | Pass | `pnpm build` green; `/pixel/[id]` registered (dynamic) |
| Lint | Pass | via `next build` lint pass + prettier |

## Files Changed

| File | Action | Note |
|---|---|---|
| `lib/mail.ts` | UPDATED | nodemailer send + `buildHtml` (exported for test) |
| `lib/reply.ts` | UPDATED | OpenAI reply drafter |
| `convex/sends.ts` | UPDATED | V8 query + mutations |
| `convex/sendEmail.ts` | CREATED | `"use node"` send action |
| `convex/replies.ts` | UPDATED | reply mutations/query/action |
| `app/pixel/[id]/route.ts` | CREATED | open-tracking pixel |
| `scripts/smoke-send.ts` | CREATED | network-free HTML/escape check |
| `package.json` | UPDATED | `smoke:send` script |

## Deviations from Plan

1. **`send` action lives in `convex/sendEmail.ts`, not `convex/sends.ts`.**
   WHY: Convex forbids queries/mutations in a `"use node"` module, and nodemailer
   (net/tls) requires Node. So the Node `send` action is split out; `markOpened` and the
   other DB writes stay in `sends.ts` (where the pixel route expects `sends:markOpened`).

2. **IMAP auto-poll (imapflow) skipped.** WHY: the plan marks paste-a-reply as the
   must-work path and IMAP as the flaky optional. `replies.pasteReply` is the always-on
   loop; add imapflow as a separate `"use node"` poller later if live inbound is needed.

3. **`pasteReply` runs OpenAI in the default (V8) Convex runtime** (no `"use node"`),
   keeping `record`/`setDraft`/`pasteReply` in one file. Add when: if the OpenAI SDK
   fails to bundle in V8, move `pasteReply` to a `"use node"` file.

## Issues Encountered

- `app/` tsc pass can't see `convex/_generated`. The pixel route therefore references the
  mutation by name via `makeFunctionReference("sends:markOpened")` instead of importing
  `_generated/api`. No codegen dependency in the app bundle.

## Next Steps
- [ ] `npx convex dev` to generate `_generated` and deploy the functions, then:
- [ ] Send a seeded approved creative to your own inbox; confirm arrival + pixel open.
- [ ] `convex run replies:pasteReply '{"sendId":"…","inboundText":"…"}'` → contextual draft.
- [ ] Code review via `/code-review`; merge as part of Gate 2.
