"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCountUp } from "./useCountUp";
import "./recovery-band.css";

// The money story on the cockpit: dead pipeline $ → re-winnable $ → expected recovery $, plus
// the single best "how we win it" callout (the Discover→Insight→Signal→shipped-fix chain). The
// whole point of the engine in one band: dead deals are money, and we know which we can win back.

type TopDeal = {
  account: string;
  contact: string;
  value: number;
  score: number;
  objection: string | null;
  externalSignal: string | null;
  fixFeature: string | null;
};
type Recovery = {
  deadValue: number;
  reWinnableValue: number;
  projected: number;
  graveyard: number;
  reWinnable: number;
  sent: number;
  topDeals: TopDeal[];
};

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

function Stat({
  label,
  value,
  kind,
  tone,
}: {
  label: string;
  value: number;
  kind: "money" | "count";
  tone?: "accent" | "dim";
}) {
  const v = useCountUp(value);
  return (
    <div className={`rec-stat${tone ? ` rec-stat--${tone}` : ""}`}>
      <span className="rec-stat-value">
        {kind === "money" ? money(v) : Math.round(v)}
      </span>
      <span className="rec-stat-label">{label}</span>
    </div>
  );
}

export function RecoveryBand() {
  const data = useQuery(api.lostDeals.recoveryDashboard, {}) as
    | Recovery
    | undefined;
  if (!data) return null;

  const pct = data.deadValue
    ? Math.round((data.reWinnableValue / data.deadValue) * 100)
    : 0;
  const top = data.topDeals[0];

  return (
    <div className="rec">
      <div className="rec-stats">
        <Stat label="In the graveyard" value={data.deadValue} kind="money" tone="dim" />
        <Stat label="Re-winnable now" value={data.reWinnableValue} kind="money" />
        <Stat
          label="Expected recovery"
          value={data.projected}
          kind="money"
          tone="accent"
        />
        <Stat label="Re-triggered" value={data.reWinnable} kind="count" />
        <Stat label="Sent" value={data.sent} kind="count" />
      </div>

      <div className="rec-bar-wrap">
        <div className="rec-bar" role="img" aria-label={`${pct}% of dead pipeline is re-winnable`}>
          <div className="rec-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="rec-bar-label">
          <strong>{pct}%</strong> of the dead pipeline is re-winnable today
        </span>
      </div>

      {top && (
        <p className="rec-top">
          <span className="rec-top-tag">How we win the biggest one</span>
          <strong>{top.account}</strong> — {money(top.value)} back.{" "}
          They said no to <em>{top.objection ?? "a hard requirement"}</em>;
          {top.fixFeature ? (
            <>
              {" "}
              we shipped <strong>{top.fixFeature}</strong>
            </>
          ) : null}
          {top.externalSignal ? <>, and {top.externalSignal}</> : null}.
        </p>
      )}
    </div>
  );
}
