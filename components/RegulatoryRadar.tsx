"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  HEALTHCARE_REGS,
  cohortFor,
  regImpact,
  scoreForced,
  activeReg,
  type GraveDeal,
} from "@/lib/regulations";
import "./regulatory-radar.css";

// Reading-Minds re-aim — THE breakthrough beat. A regulation takes effect → every dead
// deal whose objection it now forces lights up at once. One law, a whole cohort revived:
// you didn't change, they didn't change — the world did. Sits atop the Dead Pipeline.

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function liveHref(d: GraveDeal) {
  return {
    pathname: "/live",
    query: { deal: `${d.account} — "${d.objection ?? d.objectionCategory ?? ""}"` },
  };
}

export function RegulatoryRadar() {
  const deals = useQuery(api.lostDeals.listLostDeals, {}) as
    | GraveDeal[]
    | undefined;
  const [regId, setRegId] = useState(activeReg().id);
  const reg = HEALTHCARE_REGS.find((r) => r.id === regId) ?? activeReg();

  const cohort = useMemo(() => {
    if (!deals) return [];
    return cohortFor(reg, deals)
      .map((d) => ({ deal: d, ...scoreForced(d) }))
      .sort((a, b) => b.score - a.score);
  }, [deals, reg]);

  const impact = useMemo(
    () => (deals ? regImpact(reg, deals) : { count: 0, value: 0 }),
    [deals, reg],
  );
  const top = cohort[0]?.deal;
  const loading = deals === undefined;

  return (
    <section className="reg-radar" aria-label="Regulatory radar">
      <header className="reg-head">
        <span className="reg-kicker">Regulatory radar</span>
        <span className="reg-live" aria-label="monitoring">
          <span className="reg-live-dot" aria-hidden />
          monitoring
        </span>
      </header>

      <div className="reg-tabs" role="tablist" aria-label="Regulations">
        {HEALTHCARE_REGS.map((r) => {
          const n = deals ? regImpact(r, deals).count : 0;
          return (
            <button
              key={r.id}
              role="tab"
              aria-selected={r.id === reg.id}
              className={`reg-tab${r.id === reg.id ? " reg-tab--on" : ""}`}
              onClick={() => setRegId(r.id)}
            >
              {r.title}
              <span className="reg-tab-count">{n}</span>
            </button>
          );
        })}
      </div>

      <div className={`reg-card reg-card--${reg.status}`}>
        <div className="reg-card-top">
          <span className={`reg-status reg-status--${reg.status}`}>
            {reg.status === "in_effect" ? "● in effect" : "○ upcoming"}
          </span>
          <span className="reg-meta">
            {reg.authority} · effective {reg.effectiveDate}
          </span>
        </div>
        <h2 className="reg-title">{reg.title}</h2>
        <p className="reg-summary">{reg.summary}</p>

        <div className="reg-impact">
          <div className="reg-impact-num">
            <strong>{loading ? "—" : impact.count}</strong>
            <span>dead deals now forced to act</span>
          </div>
          <div className="reg-impact-val">
            <strong>{loading ? "—" : money(impact.value)}</strong>
            <span>re-openable pipeline</span>
          </div>
          {top && (
            <Link className="reg-cta" href={liveHref(top)}>
              Re-trigger the cohort <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>

      {!loading && cohort.length === 0 && (
        <p className="reg-empty">
          No dead deals match this regulation yet — the radar keeps watching.
        </p>
      )}

      {cohort.length > 0 && (
        <ol className="reg-cohort">
          {cohort.map(({ deal, score }, i) => (
            <li key={deal.account} className="reg-row">
              <span className="reg-rank">{i + 1}</span>
              <span className="reg-score" title={`re-win score ${Math.round(score * 100)}%`}>
                {Math.round(score * 100)}
              </span>
              <span className="reg-who">
                <strong>{deal.account}</strong>
                <span className="reg-contact">
                  {deal.contact}
                  {deal.title ? ` · ${deal.title}` : ""}
                </span>
              </span>
              <span className="reg-objection">said no: {deal.objection}</span>
              <span className="reg-value">{money(deal.value ?? 0)}</span>
              <Link className="reg-relive" href={liveHref(deal)}>
                Re-trigger <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
