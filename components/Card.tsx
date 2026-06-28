"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { CreativeCard } from "./types";
import { ReasoningChain } from "./ReasoningChain";
import { SourcesPopover } from "./SourcesPopover";
import { SendFunnel } from "./SendFunnel";
import { SendReview, type ReviewDraft, type ReviewFact } from "./SendReview";

type Props = {
  creative: CreativeCard;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function Card({ creative }: Props) {
  const approve = useMutation(api.creatives_read.approve);
  const pickVariant = useMutation(api.creatives_read.pickVariant);
  const editCopy = useMutation(api.creatives_read.editCopy);

  const [sending, setSending] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const company = creative.company;
  const person = creative.person;
  const activeIndex = creative.chosenCopyIndex ?? 0;
  const canApprove =
    creative.status === "draft" || creative.status === "failed";

  async function onApprove() {
    if (approving) return;
    setApproving(true);
    setActionError(null);
    try {
      // Flips draft → approved. On the Draft filter the card then leaves the view;
      // on All/Approved the button below becomes Send.
      await approve({ id: creative._id });
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setApproving(false);
    }
  }

  function onSend() {
    if (sending || reviewing) return;
    // Open the pre-send review first; its "Send now" runs the real funnel.
    setActionError(null);
    setReviewing(true);
  }

  // Review "Send now": persist any inline edit, then open the funnel.
  async function handleConfirm(edited: ReviewDraft) {
    if (sending) return;
    const orig = creative.copyVariants[activeIndex];
    try {
      if (
        orig &&
        (edited.subject !== orig.subject || edited.body !== orig.body)
      ) {
        await editCopy({
          id: creative._id,
          index: activeIndex,
          subject: edited.subject,
          body: edited.body,
        });
      }
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Save failed");
      return;
    }
    setReviewing(false);
    setSending(true);
  }

  const lost = creative.lostDeal;
  const reviewFacts: ReviewFact[] = [
    ...(company?.name ? [{ k: "Company", v: company.name }] : []),
    {
      k: "Contact",
      v: person
        ? `${person.name}${person.title ? ` · ${person.title}` : ""}`
        : "—",
    },
    ...(person?.email ? [{ k: "Email", v: person.email }] : []),
    ...(company?.domain ? [{ k: "Domain", v: company.domain }] : []),
    ...(lost?.value != null
      ? [{ k: "Deal value", v: `$${lost.value.toLocaleString()}` }]
      : []),
    ...(lost?.objection || lost?.lostReason
      ? [{ k: "Why it died", v: lost.objection ?? lost.lostReason }]
      : []),
    ...(creative.externalSignal
      ? [{ k: "Signal", v: creative.externalSignal }]
      : []),
  ];

  return (
    <article className="card" data-status={creative.status}>
      {reviewing && (
        <SendReview
          reasoning={creative.reasoning}
          anchorFact={creative.anchorFact}
          facts={reviewFacts}
          draft={creative.copyVariants[activeIndex]}
          toLabel={person?.name ?? company?.name ?? "lead"}
          pending={sending}
          briefTitle={`What we have on ${company?.name ?? "this lead"}`}
          transcript={lost?.transcript ?? undefined}
          transcriptDate={lost?.transcriptDate ?? undefined}
          onConfirm={handleConfirm}
          onClose={() => setReviewing(false)}
        />
      )}
      {sending && (
        <SendFunnel
          title={`Sending to ${company?.name ?? "lead"}`}
          creativeId={creative._id}
          onClose={(ok) => {
            setSending(false);
            if (!ok) setActionError("Send failed — see details and retry.");
          }}
        />
      )}
      <header className="card-head">
        <div className="card-logo" aria-hidden>
          {company?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt=""
              width={40}
              height={40}
              loading="lazy"
            />
          ) : (
            <span>{initials(company?.name ?? "?")}</span>
          )}
        </div>
        <div className="card-who">
          <strong>{company?.name ?? "Unknown company"}</strong>
          <span className="card-person">
            {person?.name ?? "—"}
            {person?.title ? ` · ${person.title}` : ""}
          </span>
        </div>
        <div className="card-meta">
          <span className={`badge badge-${creative.status}`}>
            {creative.status}
          </span>
          <time
            className="card-time"
            dateTime={new Date(creative._creationTime).toISOString()}
            title={new Date(creative._creationTime).toLocaleString()}
          >
            {timeAgo(creative._creationTime)}
          </time>
        </div>
      </header>

      <ReasoningChain
        reasoning={creative.reasoning}
        anchorFact={creative.anchorFact}
      />

      {creative.artifactUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="card-artifact"
          src={creative.artifactUrl}
          alt={`Outreach artifact for ${company?.name ?? "lead"}`}
          loading="lazy"
        />
      )}

      <div className="card-variants" role="group" aria-label="Copy variants">
        {creative.copyVariants.map((_, i) => (
          <button
            key={i}
            type="button"
            className="variant-pill"
            aria-pressed={i === activeIndex}
            onClick={() => pickVariant({ id: creative._id, index: i })}
          >
            V{i + 1}
          </button>
        ))}
      </div>

      <CopyEditor
        key={`${creative._id}-${activeIndex}`}
        id={creative._id}
        index={activeIndex}
        subject={creative.copyVariants[activeIndex]?.subject ?? ""}
        body={creative.copyVariants[activeIndex]?.body ?? ""}
      />

      <footer className="card-foot">
        <SourcesPopover sources={creative.sources} />
        <div className="card-actions">
          {actionError && (
            <span className="card-send-error" role="alert">
              {actionError}
            </span>
          )}
          {creative.status === "sent" ? (
            // Already sent, but re-sendable — handy for testing the send path repeatedly.
            <button
              type="button"
              className="approve is-resend"
              disabled={sending}
              onClick={onSend}
              title="Send this again (re-runs the real send)"
            >
              {sending ? (
                <>
                  <span className="spinner" aria-hidden />
                  Sending…
                </>
              ) : (
                "Sent ✓ · Send again"
              )}
            </button>
          ) : creative.status === "approved" ? (
            <button
              type="button"
              className="approve"
              disabled={sending}
              onClick={onSend}
            >
              {sending ? (
                <>
                  <span className="spinner" aria-hidden />
                  Sending…
                </>
              ) : (
                "Send"
              )}
            </button>
          ) : (
            <button
              type="button"
              className="approve"
              disabled={!canApprove || approving}
              onClick={onApprove}
            >
              {approving ? (
                <>
                  <span className="spinner" aria-hidden />
                  Approving…
                </>
              ) : (
                "Approve"
              )}
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

type EditorProps = {
  id: CreativeCard["_id"];
  index: number;
  subject: string;
  body: string;
};

// Remounted (via key) whenever the active variant changes, so initial state is
// always fresh — no resync effect, no stale closure.
function CopyEditor({ id, index, subject, body }: EditorProps) {
  const editCopy = useMutation(api.creatives_read.editCopy);
  const [draftSubject, setDraftSubject] = useState(subject);
  const [draftBody, setDraftBody] = useState(body);
  const dirty = draftSubject !== subject || draftBody !== body;

  return (
    <div className="copy-editor">
      <input
        className="copy-subject"
        value={draftSubject}
        onChange={(e) => setDraftSubject(e.target.value)}
        aria-label="Subject"
        placeholder="Subject"
      />
      <textarea
        className="copy-body"
        value={draftBody}
        onChange={(e) => setDraftBody(e.target.value)}
        aria-label="Body"
        rows={4}
        placeholder="Body"
      />
      <button
        type="button"
        className="copy-save"
        disabled={!dirty}
        onClick={() =>
          editCopy({ id, index, subject: draftSubject, body: draftBody })
        }
      >
        {dirty ? "Save edit" : "Saved"}
      </button>
    </div>
  );
}
