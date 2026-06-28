"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Reasoning } from "@/convex/validators";
import { SendFunnel } from "./SendFunnel";
import { SendReview, type ReviewDraft, type ReviewFact } from "./SendReview";
import "./retrigger-board.css";

// The case file behind a re-trigger score — the deal's death reconstructed and reversed:
// their words on the call → the moment the objection dissolved → the send-ready play.
// Shared by the list board (drill-down) and the 3D radar (docked panel) so they never drift.

export type Breakdown = {
  solved: number;
  external: number;
  recency: number;
  simToWon: number;
};

export type BoardItem = {
  _id: string;
  score: number;
  breakdown: Breakdown | null;
  externalSignal: string | null;
  reasoning: Reasoning;
  anchorFact: string;
  status: string;
  account: string;
  dealAccount: string | null;
  contact: string;
  value: number | null;
  lostDate: string | null;
  objection: string | null;
  objectionCategory: string | null;
  copyVariants: { subject: string; body: string }[];
  transcript: string | null;
  transcriptDate: string | null;
  externalSignalType: string | null;
  fixFeature: string | null;
  fixShippedAt: string | null;
  fixSolves: string | null;
};

export const BAR_PARTS: { key: keyof Breakdown; label: string }[] = [
  { key: "solved", label: "shipped it" },
  { key: "external", label: "they changed" },
  { key: "recency", label: "still warm" },
  { key: "simToWon", label: "looks re-won" },
];

// max points each part can contribute = its weight ×100. Mirrors W_SOLVED / W_EXTERNAL /
// W_RECENCY / W_SIM in lib/retrigger.ts (kept here so the UI doesn't import the LLM module).
export const PART_MAX: Record<keyof Breakdown, number> = {
  solved: 40,
  external: 25,
  recency: 15,
  simToWon: 20,
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// human gap label for the dead stretch ("4 months cold")
export function gapLabel(fromIso: string, toMs: number): string {
  const months = Math.round((toMs - Date.parse(fromIso)) / (30 * 86_400_000));
  if (months <= 0) return "just now";
  if (months === 1) return "1 month cold";
  if (months < 12) return `${months} months cold`;
  const yrs = (months / 12).toFixed(1).replace(/\.0$/, "");
  return `${yrs} yr cold`;
}

// THE reversal, visualized: the deal died here ● ——— ◆ you shipped the fix ——— ● today.
// Nodes sit at their real date fractions, so the wait reads at a glance.
function ReversalTimeline({ item }: { item: BoardItem }) {
  if (!item.lostDate) return null;
  const now = Date.now();
  const lostMs = Date.parse(item.lostDate);
  const span = now - lostMs;
  if (!(span > 0)) return null;

  const shipMs = item.fixShippedAt ? Date.parse(item.fixShippedAt) : NaN;
  const shipFrac =
    Number.isFinite(shipMs) && shipMs > lostMs
      ? clamp((shipMs - lostMs) / span, 0.16, 0.84)
      : null;

  return (
    <div
      className="rt-tl"
      role="img"
      aria-label="deal timeline: lost, fix shipped, now re-triggerable"
    >
      <div className="rt-tl-track">
        <span className="rt-tl-fill" style={{ width: "100%" }} />
        {shipFrac !== null && (
          <span
            className="rt-tl-node rt-tl-node--fix"
            style={{ left: `${shipFrac * 100}%` }}
          >
            <span className="rt-tl-dot" />
            <span className="rt-tl-cap">
              <strong>shipped {item.fixFeature}</strong>
              {item.fixShippedAt && <em>{fmtDate(item.fixShippedAt)}</em>}
            </span>
          </span>
        )}
        <span className="rt-tl-node rt-tl-node--lost" style={{ left: "0%" }}>
          <span className="rt-tl-dot" />
          <span className="rt-tl-cap rt-tl-cap--start">
            <strong>lost</strong>
            <em>{fmtDate(item.lostDate)}</em>
          </span>
        </span>
        <span className="rt-tl-node rt-tl-node--now" style={{ left: "100%" }}>
          <span className="rt-tl-dot" />
          <span className="rt-tl-cap rt-tl-cap--end">
            <strong>re-triggerable</strong>
            <em>{gapLabel(item.lostDate, now)}</em>
          </span>
        </span>
      </div>
    </div>
  );
}

// The full dossier body. `compact` drops the score-math section for the tighter radar panel.
export function CaseFile({ item, compact = false }: { item: BoardItem; compact?: boolean }) {
  const pct = Math.round(item.score * 100);
  const hasTranscript = Boolean(item.transcript);
  const hasCopy = item.copyVariants.length > 0;
  const initial = item.contact.trim().charAt(0).toUpperCase() || "?";
  // item._id IS the creative id — fire the same streamed pipeline LiveScore uses.
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const approve = useMutation(api.creatives_read.approve);
  const editCopy = useMutation(api.creatives_read.editCopy);

  // Recipient picker — blank = simulate (dry-run); a real address = actually deliver to it.
  // Persisted so you only type your test inbox once.
  const [to, setTo] = useState("");
  useEffect(() => {
    const saved = localStorage.getItem("retrigger.recipient");
    if (saved) setTo(saved);
  }, []);
  function updateTo(next: string) {
    setTo(next);
    try {
      localStorage.setItem("retrigger.recipient", next);
    } catch {
      /* storage blocked — non-fatal, picker just won't persist */
    }
  }
  const recipient = to.includes("@") ? to.trim() : undefined;

  // "Send →" opens the pre-send review (intel + strategy → editable confirm). Its
  // "Send now" calls handleSend with the (maybe-edited) draft: persist any edit,
  // approve, then open the funnel. The send pipeline ships copyVariants[0] here.
  // ponytail: edits index 0 — board re-trigger creatives default chosenCopyIndex to 0.
  async function handleSend(edited: ReviewDraft) {
    if (busy || sending) return;
    setBusy(true);
    try {
      const orig = item.copyVariants[0];
      if (orig && (edited.subject !== orig.subject || edited.body !== orig.body)) {
        await editCopy({
          id: item._id as Id<"creatives">,
          index: 0,
          subject: edited.subject,
          body: edited.body,
        });
      }
      await approve({ id: item._id as Id<"creatives"> });
    } finally {
      setBusy(false);
      setReviewing(false);
      setSending(true);
    }
  }

  const reviewFacts: ReviewFact[] = [
    { k: "Account", v: item.account },
    { k: "Contact", v: item.contact },
    ...(item.value != null
      ? [{ k: "Deal value", v: `$${item.value.toLocaleString()}` }]
      : []),
    ...(item.lostDate ? [{ k: "Lost", v: fmtDate(item.lostDate) }] : []),
    ...(item.objection ? [{ k: "Why it died", v: item.objection }] : []),
    ...(item.fixFeature
      ? [
          {
            k: "What changed",
            v: item.fixSolves
              ? `Shipped ${item.fixFeature} — ${item.fixSolves}`
              : `Shipped ${item.fixFeature}`,
          },
        ]
      : []),
    ...(item.externalSignal
      ? [{ k: "Fresh signal", v: item.externalSignal }]
      : []),
  ];

  return (
    <div className="rt-drill-body">
      {hasTranscript && (
        <section className="rt-drill-sec">
          <h4 className="rt-drill-h">
            Why it died — in their words
            {item.transcriptDate && (
              <span className="rt-drill-date"> · call {fmtDate(item.transcriptDate)}</span>
            )}
          </h4>
          <article className="rt-call">
            <span className="rt-call-avatar" aria-hidden="true">
              {initial}
            </span>
            <div className="rt-call-bubble">
              <span className="rt-call-who">{item.contact}</span>
              <p className="rt-call-line">{item.transcript}</p>
            </div>
          </article>
        </section>
      )}

      <section className="rt-drill-sec">
        <h4 className="rt-drill-h">
          The reversal
          {item.fixFeature && (
            <span className="rt-drill-date"> · {item.fixFeature} closed the gap</span>
          )}
        </h4>
        <ReversalTimeline item={item} />
        {item.externalSignal && (
          <p className="rt-tl-ext">+ since then, {item.externalSignal}</p>
        )}
      </section>

      {!compact && item.breakdown && (
        <section className="rt-drill-sec">
          <h4 className="rt-drill-h">Why {pct} — the math, not a black box</h4>
          <ul className="rt-math">
            {BAR_PARTS.map((p) => {
              const pts = Math.round((item.breakdown?.[p.key] ?? 0) * 100);
              return (
                <li key={p.key} className="rt-math-row">
                  <span className={`rt-math-dot rt-bar-seg--${p.key}`} />
                  <span className="rt-math-label">{p.label}</span>
                  <span className="rt-math-pts">
                    +{pts}
                    <span className="rt-math-max"> / {PART_MAX[p.key]}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {hasCopy && (
        <section className="rt-drill-sec">
          <h4 className="rt-drill-h">The play, already drafted</h4>

          <div className="rt-send-to">
            <label className="rt-send-to-label" htmlFor={`to-${item._id}`}>
              Send to
            </label>
            <input
              id={`to-${item._id}`}
              type="email"
              inputMode="email"
              autoComplete="email"
              className="rt-send-to-input"
              placeholder="blank = simulate · your@email.com to actually receive it"
              value={to}
              onChange={(e) => updateTo(e.target.value)}
            />
            <span className="rt-send-to-mode">
              {recipient ? "live → your inbox" : "dry-run"}
            </span>
          </div>

          {item.copyVariants.map((v, i) => (
            <article key={i} className="rt-mail">
              <header className="rt-mail-head">
                <span className="rt-mail-field">To</span>
                <span className="rt-mail-to">{item.contact}</span>
              </header>
              <header className="rt-mail-head">
                <span className="rt-mail-field">Subject</span>
                <span className="rt-mail-subject">{v.subject}</span>
              </header>
              <p className="rt-mail-body">{v.body}</p>
              <footer className="rt-mail-foot">
                <button
                  type="button"
                  className="rt-mail-send"
                  onClick={() => setReviewing(true)}
                  disabled={busy || sending}
                >
                  {busy ? "Approving…" : sending ? "Sending…" : "Review & send →"}
                </button>
              </footer>
            </article>
          ))}
        </section>
      )}

      {reviewing && (
        <SendReview
          reasoning={item.reasoning}
          anchorFact={item.anchorFact}
          facts={reviewFacts}
          draft={item.copyVariants[0]}
          toLabel={item.contact}
          recipient={recipient}
          pending={busy || sending}
          briefTitle={`What we have on ${item.account}`}
          transcript={item.transcript ?? undefined}
          transcriptDate={
            item.transcriptDate ? fmtDate(item.transcriptDate) : undefined
          }
          onConfirm={handleSend}
          onClose={() => setReviewing(false)}
        />
      )}

      {sending && (
        <SendFunnel
          title={`Re-trigger · ${item.account}`}
          creativeId={item._id}
          to={recipient}
          onClose={() => setSending(false)}
        />
      )}
    </div>
  );
}
