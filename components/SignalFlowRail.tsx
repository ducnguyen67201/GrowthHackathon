"use client";

import { Fragment } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCountUp } from "./useCountUp";
import "./signal-flow-rail.css";

// Reading-Minds re-aim — the Signal Flow rail. Lead with the money: "$X recovered
// pipeline" (the founder hook), then the batch→board flow. Each node's funnel bar fills
// against the FULL graveyard, so the narrowing 12 → 5 → 1 reads as a visible shrink; the
// connectors carry the drop (−7, −4) so the "5 → 5" plateau reads as survivors, not a bug.

type Counts = {
  graveyard: number;
  scored: number;
  sent: number;
  recoveredValue: number;
  graveyardValue: number;
};

type Stage = {
  key: string;
  label: string;
  sub: string;
  value: number;
  ratio: number;
  den?: number;
  active?: boolean;
};

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

export function SignalFlowRail() {
  const counts = useQuery(api.lostDeals.flowCounts) as Counts | undefined;
  const loading = counts === undefined;
  const c = counts ?? { graveyard: 0, scored: 0, sent: 0, recoveredValue: 0, graveyardValue: 0 };
  const denom = Math.max(c.graveyard, 1);

  // motion: count the $ up, and a 0→1 reveal that wipes the funnel fills in on load
  const shownValue = useCountUp(c.recoveredValue, 1100);
  const reveal = useCountUp(loading ? 0 : 1, 700);

  const stages: Stage[] = [
    { key: "graveyard", label: "Graveyard", sub: "lost in", value: c.graveyard, ratio: 1 },
    { key: "scoring", label: "Scoring", sub: "ripe/read", value: c.scored, ratio: c.scored / denom, den: c.graveyard, active: true },
    { key: "ranked", label: "Ranked", sub: "on board", value: c.scored, ratio: c.scored / denom },
    { key: "act", label: "Act", sub: "sent", value: c.sent, ratio: c.sent / denom },
  ];

  return (
    <section
      className="sfr"
      aria-label="Signal flow: the engine turns a lost-deal graveyard into ranked pipeline"
      data-loading={loading}
    >
      <header className="sfr-head">
        <span className="sfr-kicker">Signal flow</span>
        <span className="sfr-live" aria-label="updates live">
          <span className="sfr-live-dot" aria-hidden />
          live
        </span>
        <span className="sfr-note">batch scorer → live board</span>
      </header>

      <div className="sfr-recovered">
        <span className="sfr-rec-value">{loading ? "—" : fmtMoney(shownValue)}</span>
        <span className="sfr-rec-label">
          recovered pipeline · from {c.scored} deals you&rsquo;d written off
        </span>
      </div>

      <div className="sfr-track">
        {stages.map((s, i) => {
          const next = stages[i + 1];
          const drop = next ? s.value - next.value : 0;
          const fill = Math.max(s.ratio, 0.03) * (loading ? 0 : reveal);
          return (
            <Fragment key={s.key}>
              <div className={`sfr-node${s.active ? " sfr-node--active" : ""}`}>
                <span className="sfr-stage">{s.label}</span>
                <span className="sfr-count" key={loading ? "load" : `${s.key}-${s.value}`}>
                  {loading ? (
                    "—"
                  ) : s.den !== undefined ? (
                    <>
                      {s.value}
                      <span className="sfr-den">/{s.den}</span>
                    </>
                  ) : (
                    s.value
                  )}
                </span>
                <span className="sfr-funnel-track" aria-hidden>
                  <span className="sfr-funnel" style={{ transform: `scaleX(${fill})` }} />
                </span>
                <span className="sfr-sub">{s.sub}</span>
              </div>
              {next && (
                <span className="sfr-arrow" aria-hidden>
                  <span className="sfr-arrow-glyph">▸</span>
                  {drop > 0 && <span className="sfr-drop">−{drop}</span>}
                </span>
              )}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
