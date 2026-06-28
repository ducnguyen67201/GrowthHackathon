"use client";

import { useState } from "react";
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

export function Pipeline() {
  const [filter, setFilter] = useState<CreativeStatus | "all">("all");

  // `api` is loose (anyApi) until `convex dev` regenerates precise types; cast
  // the realtime result to the known view shape. useQuery auto-subscribes — no polling.
  const creatives = useQuery(
    api.creatives_read.list,
    filter === "all" ? {} : { status: filter },
  ) as CreativeCard[] | undefined;

  const isLoading = creatives === undefined;

  return (
    <>
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
          </button>
        ))}
      </nav>

      {isLoading ? (
        <p className="dash-empty">Loading pipeline…</p>
      ) : creatives.length === 0 ? (
        <p className="dash-empty">
          No creatives in this view. Run <code>npx convex run seed:run</code> to
          load sample leads.
        </p>
      ) : (
        <section className="dash-grid">
          {creatives.map((creative) => (
            <Card key={creative._id} creative={creative} />
          ))}
        </section>
      )}
    </>
  );
}
