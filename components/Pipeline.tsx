"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "./Card";
import type { CreativeCard, CreativeStatus } from "./types";

const FILTERS: { value: CreativeStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];

const SKELETON_COUNT = 3;

export function Pipeline() {
  const [filter, setFilter] = useState<CreativeStatus | "all">("all");

  // One unfiltered subscription drives both the status counts and the grid; we
  // filter client-side. A leads dashboard is small enough that this beats running
  // a second query just to count, and every tab can show a live count.
  const creatives = useQuery(api.creatives_read.list, {}) as
    CreativeCard[] | undefined;

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: creatives?.length ?? 0 };
    for (const cr of creatives ?? []) c[cr.status] = (c[cr.status] ?? 0) + 1;
    return c;
  }, [creatives]);

  const visible = useMemo(
    () =>
      filter === "all"
        ? (creatives ?? [])
        : (creatives ?? []).filter((c) => c.status === filter),
    [creatives, filter],
  );

  const isLoading = creatives === undefined;

  return (
    <>
      {!isLoading && creatives.length > 0 && (
        <p className="dash-summary">
          <strong>{counts.all}</strong> leads in the pipeline
          <span className="dash-summary-sep" aria-hidden>
            ·
          </span>
          <span className="dash-summary-stat">
            {counts.draft ?? 0} to review
          </span>
          <span className="dash-summary-sep" aria-hidden>
            ·
          </span>
          <span className="dash-summary-stat">
            {counts.approved ?? 0} approved
          </span>
          <span className="dash-summary-sep" aria-hidden>
            ·
          </span>
          <span className="dash-summary-stat">{counts.sent ?? 0} sent</span>
          {(counts.failed ?? 0) > 0 && (
            <>
              <span className="dash-summary-sep" aria-hidden>
                ·
              </span>
              <span className="dash-summary-stat dash-summary-stat--danger">
                {counts.failed} failed
              </span>
            </>
          )}
        </p>
      )}

      <nav className="dash-filters" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className="filter-tab"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            <span className="filter-count">{counts[f.value] ?? 0}</span>
          </button>
        ))}
      </nav>

      {isLoading ? (
        <section
          className="dash-grid"
          aria-busy="true"
          aria-label="Loading leads"
        >
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div key={i} className="card-skeleton" aria-hidden />
          ))}
        </section>
      ) : visible.length === 0 ? (
        <p className="dash-empty">
          {filter === "all" ? (
            <>
              No creatives yet. Run <code>npx convex run seed:run</code> to load
              sample leads, or generate one on the <a href="/live">Live</a>{" "}
              page.
            </>
          ) : (
            <>
              No <strong>{filter}</strong> leads right now.{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => setFilter("all")}
              >
                Show all {counts.all}
              </button>
            </>
          )}
        </p>
      ) : (
        <section className="dash-grid">
          {visible.map((creative) => (
            <Card key={creative._id} creative={creative} />
          ))}
        </section>
      )}
    </>
  );
}
