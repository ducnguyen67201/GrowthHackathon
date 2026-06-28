"use client";

import { useEffect, useState } from "react";
import "./agent-activity.css";

// The "always-on" cue: a console line that streams plausible background-agent events so the
// board feels like a continuously-running system — scanning the graveyard, watching the
// Federal Register, re-scoring as it learns. ponytail: scripted rotation, not a real feed;
// wire to a live job log if/when the batch scorer runs on a schedule.
const EVENTS = [
  "Scanning 14 dead accounts for dissolved blockers…",
  "Federal Register watch — no new mandates this cycle",
  "Re-checked Lumen Health · “no SOC2” still unresolved elsewhere",
  "Matched HIPAA Security Rule → 9 deals now forced",
  "Re-scored Veritas Health · 0.81 → 0.84",
  "Learned from 6 re-won deals · winnability centroid updated",
  "New signal · Riverside Oncology expanding to 3 states",
  "Re-clustered objections · 4 compliance categories active",
  "Watching 3 regulations · HHS · SAMHSA · WA State",
  "Embedded 14 objections · nearest-won recomputed",
];

const ROTATE_MS = 2800;

export function AgentActivity() {
  const [i, setI] = useState(0);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const rotate = setInterval(() => {
      setI((v) => (v + 1) % EVENTS.length);
      setSecs(0);
    }, ROTATE_MS);
    const tick = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => {
      clearInterval(rotate);
      clearInterval(tick);
    };
  }, []);

  return (
    <div className="agent" role="status" aria-live="polite" aria-label="Agent activity">
      <span className="agent-dot" aria-hidden />
      <span className="agent-label">agent</span>
      <span key={i} className="agent-event">
        {EVENTS[i]}
      </span>
      <span className="agent-time">{secs === 0 ? "just now" : `${secs}s ago`}</span>
    </div>
  );
}
