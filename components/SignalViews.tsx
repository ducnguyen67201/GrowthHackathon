"use client";

import { useState } from "react";
import { RadarConsole } from "./RadarConsole";
import { RetriggerBoard } from "./RetriggerBoard";
import "./radar-console.css";

// One surface, two views: the 3D War-Room Radar (default) and the ranked List. The radar
// is the hero; the list stays one click away — same data, same case files, nothing lost.
type View = "radar" | "list";

export function SignalViews() {
  const [view, setView] = useState<View>("radar");
  return (
    <section className="sv">
      <div className="sv-tabs" role="tablist" aria-label="Signal view">
        <button
          type="button"
          role="tab"
          aria-selected={view === "radar"}
          className={`sv-tab${view === "radar" ? " sv-tab--on" : ""}`}
          onClick={() => setView("radar")}
        >
          <span className="sv-tab-glyph">◎</span> Radar
          <span className="sv-tab-badge">3D</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "list"}
          className={`sv-tab${view === "list" ? " sv-tab--on" : ""}`}
          onClick={() => setView("list")}
        >
          <span className="sv-tab-glyph">≣</span> List
        </button>
      </div>

      {view === "radar" ? <RadarConsole /> : <RetriggerBoard />}
    </section>
  );
}
