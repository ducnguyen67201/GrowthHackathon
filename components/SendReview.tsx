"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { Reasoning } from "@/convex/validators";
import { PrepChat } from "./PrepChat";
import "./send-review.css";

// Pre-send review gate. Two steps before the real send funnel fires:
//   1. brief   — the intel we have (Fiber enrichment + context) and the model's
//                chosen play (saw → angle), so the operator sees the signal AND
//                how it becomes the pitch.
//   2. confirm — recipient + the exact draft, EDITABLE → tweak → "Send now".
// No new LLM call: `reasoning` was produced when the lead was scored; we surface
// it rather than regenerate (which would drift from the approved copy).
// Surface-agnostic: callers pass their own `facts` + `draft`; onConfirm receives
// the (possibly edited) draft so the parent persists it before sending.

export type ReviewDraft = { subject: string; body: string };
export type ReviewFact = { k: string; v: string };

const STRATEGY: { key: keyof Reasoning; label: string }[] = [
  { key: "saw", label: "Signal" },
  { key: "inferred", label: "Inferred" },
  { key: "pain", label: "Pain now" },
  { key: "angle", label: "Our angle" },
  { key: "whyThisAngle", label: "Why it lands" },
];

type Props = {
  reasoning: Reasoning;
  anchorFact: string;
  facts: ReviewFact[];
  draft?: ReviewDraft;
  toLabel: string; // who the mail addresses when no live recipient is set
  recipient?: string; // real address → live delivery
  pending: boolean; // parent is approving / sending — lock the trigger
  briefTitle?: string;
  transcript?: string; // the call where the deal died (re-trigger leads)
  transcriptDate?: string;
  onConfirm: (edited: ReviewDraft) => void;
  onClose: () => void;
};

// Everything the prep chat needs to be grounded, flattened to text.
function buildContext(
  facts: ReviewFact[],
  reasoning: Reasoning,
  anchorFact: string,
  draft?: ReviewDraft,
  transcript?: string,
  transcriptDate?: string,
): string {
  return [
    facts.map((f) => `${f.k}: ${f.v}`).join("\n"),
    `Anchor fact: ${anchorFact}`,
    `Model reasoning: ${JSON.stringify(reasoning)}`,
    draft ? `Drafted email\nSubject: ${draft.subject}\n${draft.body}` : null,
    transcript
      ? `Call transcript${transcriptDate ? ` (${transcriptDate})` : ""}:\n${transcript}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function SendReview({
  reasoning,
  anchorFact,
  facts,
  draft,
  toLabel,
  recipient,
  pending,
  briefTitle = "What we have on this lead",
  transcript,
  transcriptDate,
  onConfirm,
  onClose,
}: Props) {
  const [step, setStep] = useState<"brief" | "confirm">("brief");
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const dirty =
    !!draft && (subject !== draft.subject || body !== draft.body);
  const confidencePct = Math.round(reasoning.confidence * 100);
  // Chat sees live edits to the draft, so prep reflects what will actually ship.
  const chatContext = buildContext(
    facts,
    reasoning,
    anchorFact,
    draft ? { subject, body } : undefined,
    transcript,
    transcriptDate,
  );

  return (
    createPortal(
      <div
        className="sr-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Review before sending"
      >
        <div className={`sr-panel ${step === "brief" ? "sr-panel--wide" : ""}`}>
          <header className="sr-head">
            <span className="sr-eyebrow">
              Pre-send review · step {step === "brief" ? "1" : "2"} of 2
            </span>
            <h3 className="sr-title">
              {step === "brief" ? briefTitle : "Confirm & send"}
            </h3>
            <p className="sr-sub">
              {step === "brief"
                ? "Fiber enrichment + context, and the play the model chose from it."
                : recipient
                  ? `Live delivery via Orange Slice → ${recipient}`
                  : "Dry-run — no email leaves the building."}
            </p>
          </header>

          {step === "brief" ? (
            <>
              <div className="sr-cols">
                <div className="sr-main">
              <section className="sr-sec">
                <h4 className="sr-sec-h">The intel</h4>
                <dl className="sr-facts">
                  {facts.map((f) => (
                    <div key={f.k} className="sr-fact">
                      <dt className="sr-fact-k">{f.k}</dt>
                      <dd className="sr-fact-v">{f.v}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="sr-sec">
                <h4 className="sr-sec-h">
                  Signal strength
                  <span className="sr-strength-pct">{confidencePct}%</span>
                </h4>
                <div className="sr-strength" aria-hidden>
                  <span
                    className="sr-strength-fill"
                    style={{ width: `${confidencePct}%` }}
                  />
                </div>
                {anchorFact && <p className="sr-anchor">{anchorFact}</p>}
              </section>

              <section className="sr-sec">
                <h4 className="sr-sec-h">
                  The play — how the signal becomes the pitch
                </h4>
                <ol className="sr-chain">
                  {STRATEGY.map(({ key, label }) => (
                    <li key={key} className="sr-step">
                      <span className="sr-step-k">{label}</span>
                      <span className="sr-step-v">{String(reasoning[key])}</span>
                    </li>
                  ))}
                </ol>
              </section>
                </div>

                <aside className="sr-side">
                  {transcript && (
                    <section className="sr-sec sr-sec--flush">
                      <h4 className="sr-sec-h">
                        The call, in their words
                        {transcriptDate && (
                          <span className="sr-mode">{transcriptDate}</span>
                        )}
                      </h4>
                      <p className="sr-transcript">{transcript}</p>
                    </section>
                  )}
                  <PrepChat context={chatContext} />
                </aside>
              </div>

              <footer className="sr-foot">
                <button
                  type="button"
                  className="sr-btn sr-btn--ghost"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="sr-btn sr-btn--primary"
                  onClick={() => setStep("confirm")}
                >
                  Next: confirm send →
                </button>
              </footer>
            </>
          ) : (
            <>
              <section className="sr-sec">
                <h4 className="sr-sec-h">
                  The draft that ships
                  <span className={`sr-mode ${recipient ? "is-live" : ""}`}>
                    {recipient ? "live → your inbox" : "dry-run"}
                  </span>
                </h4>
                {draft ? (
                  <div className="sr-edit">
                    <div className="sr-mail-row">
                      <span className="sr-mail-k">To</span>
                      <span className="sr-mail-v">{recipient ?? toLabel}</span>
                    </div>
                    <label className="sr-field">
                      <span className="sr-field-k">Subject</span>
                      <input
                        className="sr-input"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Subject"
                      />
                    </label>
                    <label className="sr-field">
                      <span className="sr-field-k">Body</span>
                      <textarea
                        className="sr-textarea"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={7}
                        placeholder="Body"
                      />
                    </label>
                    {dirty && (
                      <p className="sr-edited">Edited — your changes ship.</p>
                    )}
                  </div>
                ) : (
                  <p className="sr-sub">No draft on file for this lead.</p>
                )}
              </section>

              <footer className="sr-foot">
                <button
                  type="button"
                  className="sr-btn sr-btn--ghost"
                  onClick={() => setStep("brief")}
                  disabled={pending}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="sr-btn sr-btn--primary"
                  onClick={() => onConfirm({ subject, body })}
                  disabled={pending || !draft}
                >
                  {pending ? "Sending…" : dirty ? "Save & send now →" : "Send now →"}
                </button>
              </footer>
            </>
          )}
        </div>
      </div>,
      document.body,
    )
  );
}
