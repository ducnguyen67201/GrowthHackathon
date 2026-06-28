"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CaseFile, type BoardItem } from "./CaseFile";
import { RetriggerBoard } from "./RetriggerBoard";
import type { RadarBlip } from "./SignalRadar";
import "./radar-console.css";

// The 3D view. Radar scene + a docked case file: the sweep pings re-triggerable deals and
// surfaces them here; click any blip to pin it. WebGL-only — falls back to the list board.

const SignalRadar = dynamic(() => import("./SignalRadar"), {
  ssr: false,
  loading: () => <div className="radar-skel" aria-hidden />,
});

const DWELL_MS = 2600; // min time a pinged deal holds the panel before the sweep can swap it

// stable 0..1 hash → a deal always sits at the same spot on the scope
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

type LostDeal = { account: string };

export function RadarConsole() {
  const board = useQuery(api.lostDeals.board, {}) as BoardItem[] | undefined;
  const all = useQuery(api.lostDeals.listLostDeals, {}) as LostDeal[] | undefined;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const lastChange = useRef(0);

  const [canRender, setCanRender] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const ok = (() => {
      try {
        const c = document.createElement("canvas");
        return Boolean(
          window.WebGLRenderingContext &&
            (c.getContext("webgl") || c.getContext("experimental-webgl")),
        );
      } catch {
        return false;
      }
    })();
    setCanRender(ok);
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, BoardItem>();
    (board ?? []).forEach((b) => m.set(b._id, b));
    return m;
  }, [board]);

  const blips = useMemo<RadarBlip[]>(() => {
    const live = board ?? [];
    const liveAccounts = new Set(live.map((b) => b.dealAccount ?? b.account));
    const liveBlips: RadarBlip[] = live.map((b) => ({
      id: b._id,
      account: b.account,
      angle: hash01(b.dealAccount ?? b.account),
      score: b.score,
      live: true,
    }));
    const dimBlips: RadarBlip[] = (all ?? [])
      .filter((d) => !liveAccounts.has(d.account))
      .map((d) => ({
        id: `dim:${d.account}`,
        account: d.account,
        angle: hash01(d.account),
        score: 0.2,
        live: false,
      }));
    return [...liveBlips, ...dimBlips];
  }, [board, all]);

  const handlePing = (id: string) => {
    if (pinned) return;
    const now = Date.now();
    if (now - lastChange.current < DWELL_MS) return;
    lastChange.current = now;
    setActiveId(id);
  };

  const handleSelect = (id: string | null) => {
    if (id === null) {
      setPinned(false);
      return;
    }
    lastChange.current = Date.now();
    setActiveId(id);
    setPinned(true);
  };

  // WebGL missing → the list board is the full, accessible fallback
  if (!canRender) {
    return (
      <div className="radar-fallback">
        <p className="radar-fallback-note">
          3D scope needs WebGL — showing the ranked list instead.
        </p>
        <RetriggerBoard />
      </div>
    );
  }

  const active = activeId ? byId.get(activeId) ?? null : null;
  const liveCount = (board ?? []).length;

  return (
    <div className="radar-console">
      <div className="radar-stage">
        <div className="radar-canvas">
          {board === undefined ? (
            <div className="radar-skel" aria-hidden />
          ) : (
            <SignalRadar
              blips={blips}
              activeId={activeId}
              onPing={handlePing}
              onSelect={handleSelect}
              reduced={reduced}
            />
          )}
        </div>

        <div className="radar-hud" aria-hidden>
          <span className="radar-hud-title">Dead-pipeline scope</span>
          <span className="radar-hud-sweep">
            <i className="radar-hud-dot" /> sweeping · {liveCount} re-triggerable
          </span>
          <ul className="radar-legend">
            <li>
              <i className="radar-key radar-key--live" /> objection dissolved — winnable
            </li>
            <li>
              <i className="radar-key radar-key--dim" /> dormant in the graveyard
            </li>
            <li className="radar-legend-hint">click a blip to pin · click away to release</li>
          </ul>
        </div>
      </div>

      <aside
        className={`radar-panel${active ? " radar-panel--open" : ""}`}
        aria-live="polite"
      >
        {active ? (
          <div key={active._id} className="radar-panel-in">
            <header className="radar-panel-head">
              <div className="radar-panel-who">
                <strong className="radar-panel-acct">{active.account}</strong>
                <span className="radar-panel-contact">{active.contact}</span>
              </div>
              <span className="radar-panel-score" title="re-trigger score">
                {Math.round(active.score * 100)}
                {pinned && <span className="radar-panel-pin">pinned</span>}
              </span>
            </header>
            {active.objection && (
              <span className="rt-chip rt-chip--no radar-panel-obj">
                said no: {active.objection}
              </span>
            )}
            <CaseFile item={active} compact />
          </div>
        ) : (
          <div className="radar-panel-idle">
            <span className="radar-panel-idle-pulse" aria-hidden />
            <p>The sweep is reading the graveyard.</p>
            <p className="radar-panel-idle-sub">
              A deal surfaces here the instant its objection dissolves — or click any green
              blip to open its case file.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
