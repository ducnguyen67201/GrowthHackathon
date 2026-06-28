"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { CreativeCard } from "./types";
import { ReasoningChain } from "./ReasoningChain";
import { SourcesPopover } from "./SourcesPopover";

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

export function Card({ creative }: Props) {
  const approve = useMutation(api.creatives_read.approve);
  const pickVariant = useMutation(api.creatives_read.pickVariant);

  const company = creative.company;
  const person = creative.person;
  const activeIndex = creative.chosenCopyIndex ?? 0;
  const canApprove =
    creative.status === "draft" || creative.status === "failed";

  return (
    <article className="card" data-status={creative.status}>
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
        <span className={`badge badge-${creative.status}`}>
          {creative.status}
        </span>
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
        <button
          type="button"
          className="approve"
          disabled={!canApprove}
          onClick={() => approve({ id: creative._id })}
        >
          {creative.status === "approved" ? "Approved" : "Approve"}
        </button>
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
