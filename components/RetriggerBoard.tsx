"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ReasoningChain } from "./ReasoningChain";
import { useCountUp } from "./useCountUp";
import { CaseFile, BAR_PARTS, type BoardItem } from "./CaseFile";
import "./retrigger-board.css";

// Reading-Minds re-aim — the ranked dead-pipeline board (the "List" view). Each row is a
// lost deal the engine scored re-triggerable: their objection, the moment it dissolved, and
// the score that ranks it. Open the case file → the shared dossier (also used by the 3D radar).

const SKELETON_COUNT = 4;
const STAGGER_MS = 70;

// score counts up on mount (and re-counts when Convex pushes a new score)
function ScoreNumber({ pct }: { pct: number }) {
  const shown = useCountUp(pct, 800);
  return (
    <span className="rt-score" title={`re-trigger score ${pct}%`}>
      {Math.round(shown)}
    </span>
  );
}

// native <details> → free keyboard + aria, no state. The reveal is the shared CaseFile.
function DrillDown({ item }: { item: BoardItem }) {
  const hasContent =
    Boolean(item.transcript) || Boolean(item.breakdown) || item.copyVariants.length > 0;
  if (!hasContent) return null;
  return (
    <details className="rt-drill">
      <summary className="rt-drill-toggle">
        <span className="rt-drill-open">Open the case file</span>
        <span className="rt-drill-hint">
          their words · the reversal · the play, ready to send
        </span>
      </summary>
      <CaseFile item={item} />
    </details>
  );
}

export function RetriggerBoard() {
  const board = useQuery(api.lostDeals.board, {}) as BoardItem[] | undefined;

  if (board === undefined) {
    return (
      <div className="rt-list">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <div key={i} className="rt-row rt-row--skeleton" />
        ))}
      </div>
    );
  }

  if (board.length === 0) {
    return (
      <p className="dash-empty">
        No re-triggers scored yet. Seed the graveyard with{" "}
        <code>npx convex run seed:seedRetrigger</code>, then run{" "}
        <code>pnpm retrigger</code>.
      </p>
    );
  }

  return (
    <ol className="rt-list">
      {board.map((item, i) => {
        const pct = Math.round(item.score * 100);
        return (
          <li
            key={item._id}
            className={`rt-row rt-row--enter${i === 0 && !item.isWatch ? " rt-row--top" : ""}${item.isLive && !item.isWatch ? " rt-row--live" : ""}${item.isWatch ? " rt-row--watch" : ""}`}
            style={{ animationDelay: `${i * STAGGER_MS}ms` }}
          >
            <div className="rt-rank">
              <span className="rt-rank-num">{i + 1}</span>
              {item.isWatch ? (
                <span className="rt-score rt-score--watch" title="On watch — not re-winnable yet">
                  ⏳
                </span>
              ) : (
                <ScoreNumber pct={pct} />
              )}
            </div>

            <div className="rt-body">
              <div className="rt-who">
                <strong className="rt-account">{item.account}</strong>
                {item.isLive && !item.isWatch && (
                  <span className="rt-new" title="Just ingested from a call">
                    NEW · just ingested
                  </span>
                )}
                {item.isWatch && (
                  <span className="rt-watch-badge" title="Ingested, but no shipped fix resolves it yet">
                    ON WATCH · no fix yet
                  </span>
                )}
                {item.isLive &&
                  (item.analyzedAt ? (
                    <span className="rt-analyzed" title="LLM analysis complete">
                      ✓ analyzed
                    </span>
                  ) : (
                    <span className="rt-analyzing" role="status">
                      <span className="rt-analyzing-spin" aria-hidden />
                      analyzing…
                    </span>
                  ))}
                <span className="rt-contact">{item.contact}</span>
                {item.lostDate && <span className="rt-lost">lost {item.lostDate}</span>}
              </div>

              <div className="rt-chips">
                {item.objection && (
                  <span className="rt-chip rt-chip--no">said no: {item.objection}</span>
                )}
                {item.externalSignal && (
                  <span className="rt-chip rt-chip--ext">
                    + {item.externalSignal}
                    {item.externalSignalType && (
                      <span className="rt-chip-src">· via Fiber · {item.externalSignalType}</span>
                    )}
                  </span>
                )}
              </div>

              {item.analysisInsight && (
                <p className="rt-ai-insight">
                  <span className="rt-ai-tag" aria-hidden>
                    AI read
                  </span>
                  {item.analysisInsight}
                </p>
              )}

              {item.isWatch ? (
                <p className="rt-watch-note">
                  Nothing you&rsquo;ve shipped resolves this yet — it&rsquo;s on the
                  brain, on watch. The day you ship the fix, it lights up here and
                  drafts its own re-open.
                </p>
              ) : (
                <>
                  <ReasoningChain reasoning={item.reasoning} anchorFact={item.anchorFact} />

                  {item.breakdown && (
                    <div className="rt-bar" aria-label="why this score">
                      {BAR_PARTS.map((p) => {
                        const w = item.breakdown ? item.breakdown[p.key] : 0;
                        return (
                          w > 0 && (
                            <span
                              key={p.key}
                              className={`rt-bar-seg rt-bar-seg--${p.key}`}
                              style={{ flexGrow: w }}
                              title={`${p.label}: +${Math.round(w * 100)}`}
                            />
                          )
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              <DrillDown item={item} />

              {!item.isWatch && item.objection && (
                <Link
                  className="rt-relive"
                  href={{
                    pathname: "/live",
                    query: { deal: `${item.account} — "${item.objection}"` },
                  }}
                >
                  Re-trigger this live <span aria-hidden>→</span>
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
