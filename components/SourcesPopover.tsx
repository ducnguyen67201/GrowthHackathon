"use client";

import { useState } from "react";
import type { Source } from "@/convex/validators";
import { safeHref } from "@/lib/dashboard";

// Receipts. The reasoning claims things; this is where they're cited.
// Native <details> = a popover with zero JS state and full keyboard support...
// except we want click-outside-to-close, so a tiny controlled wrapper it is.
type Props = {
  sources: Source[];
};

export function SourcesPopover({ sources }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sources" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="sources-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {sources.length} source{sources.length === 1 ? "" : "s"}
      </button>
      {open && (
        <ul className="sources-list" role="list">
          {sources.map((source, i) => {
            const href = safeHref(source.url);
            return (
              <li key={`${source.field}-${i}`} className="sources-item">
                <span className="sources-field">{source.field}</span>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {source.value}
                  </a>
                ) : (
                  <span>{source.value}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
