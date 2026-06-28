"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { CreativeCard } from "./types";

// The slim pipeline status strip for the cockpit — sent / approved / in-review counts pulled
// from the same realtime subscription the full Pipeline grid uses. A re-trigger sent on the
// Live panel lands here within a tick, closing the loop in one glance. Deep-links to /live to
// review the full set of cards.
type Stat = {
  key: string;
  label: string;
  value: number;
  tone?: "accent" | "warm" | "danger";
};

export function PipelineStrip() {
  const creatives = useQuery(api.creatives_read.list, {}) as
    | CreativeCard[]
    | undefined;

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const cr of creatives ?? []) c[cr.status] = (c[cr.status] ?? 0) + 1;
    return c;
  }, [creatives]);

  const loading = creatives === undefined;
  const total = creatives?.length ?? 0;

  const stats: Stat[] = [
    { key: "draft", label: "to review", value: counts.draft ?? 0 },
    {
      key: "approved",
      label: "approved",
      value: counts.approved ?? 0,
      tone: "accent",
    },
    { key: "sent", label: "sent", value: counts.sent ?? 0, tone: "warm" },
  ];
  if ((counts.failed ?? 0) > 0) {
    stats.push({
      key: "failed",
      label: "failed",
      value: counts.failed ?? 0,
      tone: "danger",
    });
  }

  return (
    <section className="pstrip" aria-label="Pipeline status">
      <div className="pstrip-total">
        <strong className="pstrip-total-num">{loading ? "—" : total}</strong>
        <span className="pstrip-total-label">in the pipeline</span>
      </div>

      <div className="pstrip-stats">
        {stats.map((s) => (
          <div
            key={s.key}
            className={`pstrip-stat${s.tone ? ` pstrip-stat--${s.tone}` : ""}`}
          >
            <span className="pstrip-stat-num">{loading ? "—" : s.value}</span>
            <span className="pstrip-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <Link className="pstrip-link" href="/live">
        Review &amp; send <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
