# Impl: Branch D — `feat/send-reply` (send + open tracking + Reply Cyborg)

> **Agent:** one. **Base:** `main@wave-0-done`. **Parallel-safe with** A/B/C/H.
> **JTBD:** approved creative → real email sent + open tracked; inbound reply → AI-drafted follow-up. Builds against a **seeded approved creative**.
> **Prereq:** `GMAIL_USER` + `GMAIL_APP_PASSWORD` (Gmail app password, NOT login pw), `OPENAI_API_KEY`, `APP_BASE_URL`, `npx convex dev` + seed.

## Files
| File | Action |
|---|---|
| `lib/mail.ts` | IMPLEMENT `sendCreative` (nodemailer) |
| `lib/reply.ts` | IMPLEMENT `draftReply` (OpenAI) |
| `convex/sends.ts` | `sendApproved` action + `markOpened` mutation + `bySend` query |
| `convex/replies.ts` | `handleInbound` action (record + draft) + `record`/`setDraft` mutations |
| `app/pixel/[id]/route.ts` | 1×1 open pixel → markOpened |
| `app/api/paste-reply/route.ts` | fallback: paste a reply → handleInbound |
| `scripts/reply-poll.ts` | IMAP poller (imapflow) → handleInbound |

## Contract (from Wave 0)
- `lib/mail.ts` / `lib/reply.ts` signatures exist — implement bodies.
- `api` from `convex/_generated/api`. `ConvexHttpClient` from `convex/browser` for calling Convex from Next routes/scripts.

## `lib/mail.ts` (nodemailer, Gmail app password)
```ts
"use node";
import nodemailer from "nodemailer";
const transport = () => nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
});
export async function sendCreative(a: { to: string; subject: string; body: string; pngUrl?: string; pixelUrl: string }) {
  const html = `<div style="font:15px/1.5 -apple-system,sans-serif">
    ${a.pngUrl ? `<img src="${a.pngUrl}" alt="" style="max-width:520px;border-radius:10px"/>` : ""}
    <p>${a.body.replace(/\n/g, "<br/>")}</p>
    <img src="${a.pixelUrl}" width="1" height="1" style="opacity:0"/></div>`;
  const info = await transport().sendMail({ from: process.env.GMAIL_USER!, to: a.to, subject: a.subject, html, text: a.body });
  return { messageId: info.messageId };
}
```
> Low volume (20–40), plain + one image, warmed Gmail. Deliverability is real; replies are loop-fuel, not the headline metric.

## `lib/reply.ts` (Reply Cyborg)
```ts
import OpenAI from "openai";
const openai = new OpenAI();
export async function draftReply(inbound: string, ctx: { reasoning: unknown; copy: string }) {
  const c = await openai.beta.chat.completions.parse({
    model: "gpt-4o", temperature: 0.6,
    messages: [
      { role: "system", content: "You are an SDR carrying a live conversation. Read the prospect's reply and the original context. Draft the next message: acknowledge what they said, advance toward a 15-min call, stay specific and warm. Also classify intent and suggest the action." },
      { role: "user", content: JSON.stringify({ inbound, ...ctx }) },
    ],
    response_format: zodResponseFormat(z.object({ draftReply: z.string(), intent: z.string(), suggestedAction: z.string() }), "reply"),
  });
  return c.choices[0]!.message.parsed!;
}
```

## `convex/sends.ts`
```ts
"use node"; // nodemailer
export const sendApproved = action({ args: { creativeId: v.id("creatives"), to: v.string() }, handler: async (ctx, a) => {
  const c = await ctx.runQuery(api.creatives_read.list, {}); // or a get-by-id
  const creative = c.find(x => x._id === a.creativeId); if (!creative) throw new Error("no creative");
  const copy = creative.copyVariants[creative.chosenCopyIndex ?? 0]!;
  const sendId = await ctx.runMutation(api.sends.createRow, { creativeId: a.creativeId, to: a.to, subject: copy.subject });
  const pixelUrl = `${process.env.APP_BASE_URL}/pixel/${sendId}`;
  const { messageId } = await sendCreative({ to: a.to, subject: copy.subject, body: copy.body, pngUrl: creative.artifactUrl ?? undefined, pixelUrl });
  await ctx.runMutation(api.sends.setMessageId, { sendId, messageId });
  await ctx.runMutation(api.creatives_read /* or _write */ .markSent, { id: a.creativeId }); // coordinate w/ B if needed
  return sendId;
}});
export const createRow = mutation({ args: {...}, handler: (ctx,a)=>ctx.db.insert("sends",{...a, channel:"email", sentAt:Date.now()}) });
export const setMessageId = mutation({ args: { sendId: v.id("sends"), messageId: v.string() }, handler: (ctx,a)=>ctx.db.patch(a.sendId,{messageId:a.messageId}) });
export const markOpened = mutation({ args: { sendId: v.id("sends") }, handler: (ctx,a)=>ctx.db.patch(a.sendId,{openedAt:Date.now()}) });
export const get = query({ args: { sendId: v.id("sends") }, handler: (ctx,a)=>ctx.db.get(a.sendId) });
```
> If `markSent` on the creative collides with branch B's `creatives_write`, just add it there or patch status in a read-side mutation you own. Coordinate the one line.

## `app/pixel/[id]/route.ts`
```ts
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { await new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!).mutation(api.sends.markOpened, { sendId: id as any }); } catch {}
  return new Response(GIF, { headers: { "content-type": "image/gif", "cache-control": "no-store" } });
}
```

## `convex/replies.ts` + paste-reply fallback
```ts
export const handleInbound = action({ args: { sendId: v.id("sends"), text: v.string() }, handler: async (ctx, a) => {
  const send = await ctx.runQuery(api.sends.get, { sendId: a.sendId }); /* find creative + context */
  const draft = await draftReply(a.text, { reasoning: /* creative.reasoning */ {}, copy: /* chosen copy */ "" });
  const replyId = await ctx.runMutation(api.replies.record, { sendId: a.sendId, inboundText: a.text });
  await ctx.runMutation(api.replies.setDraft, { replyId, ...draft });
  await ctx.runMutation(api.sends.markReplied, { sendId: a.sendId });
  return draft;
}});
export const record = mutation({...insert reply, draftStatus:"drafted"});
export const setDraft = mutation({...patch draftReply/intent/suggestedAction});
```
- `app/api/paste-reply/route.ts`: POST `{sendId, text}` → `handleInbound`. **This is the demo-safe path** — always works even if IMAP is flaky.
- `scripts/reply-poll.ts`: imapflow connects to Gmail, watches INBOX, matches inbound sender→open send, calls `handleInbound`. Nice-to-have; the paste route is the guarantee.

## GOTCHAs
- `"use node"` on files importing nodemailer/imapflow.
- Gmail **app password**, not login. Low volume.
- The paste-a-reply route MUST work — it's how the reply loop demos on stage regardless of IMAP.
- Calling Convex from a Next route/script → `ConvexHttpClient(NEXT_PUBLIC_CONVEX_URL)`.

## VALIDATE / Acceptance
- `npx convex run sends:sendApproved '{"creativeId":"<seed approved id>","to":"<your inbox>"}'` → email arrives with the artifact + copy.
- Open the email → `/pixel/<id>` logs `openedAt`.
- POST to `/api/paste-reply` (or reply from your inbox) → a contextual `draftReply` appears on the reply row.
- `pnpm typecheck` green.
