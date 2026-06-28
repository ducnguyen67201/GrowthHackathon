"use client";

import { useState } from "react";
import { ReasoningChain } from "./ReasoningChain";
import type { CopyVariant, Reasoning } from "@/lib/schemas";
import type { LiveRetriggerEvent } from "@/lib/retrigger-live";
import "./live-score.css";

// Reading-Minds re-aim — THE live beat. A judge names a deal you lost + why; the engine
// reads → matches → scores → writes the re-engagement, streamed. Reuses ReasoningChain.

const EXAMPLES = [
  "Acme — passed last quarter, said no SSO, security blocked it",
  "Globex — too expensive, seat pricing didn't fit our usage",
  "Initech — no Salesforce sync, that was the dealbreaker",
];

const STEPS = [
  { key: "reading", label: "Reading the objection" },
  { key: "matching", label: "Matching what shipped" },
  { key: "scoring", label: "Scoring re-trigger" },
  { key: "writing", label: "Writing the re-engagement" },
] as const;

type Result = {
  reasoning: Reasoning;
  anchorFact: string;
  copy: CopyVariant[];
  score: number;
  feature: string;
};

export function LiveScore() {
  const [deal, setDeal] = useState("");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [objection, setObjection] = useState<string | null>(null);
  const [feature, setFeature] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  function handle(ev: LiveRetriggerEvent) {
    if ("step" in ev) {
      if (ev.step === "objection") setObjection(ev.text);
      else if (ev.step === "feature") setFeature(ev.text);
      else if (ev.step === "score") setScore(ev.value);
      return;
    }
    switch (ev.stage) {
      case "reading":
      case "matching":
      case "scoring":
      case "writing":
        setStage(ev.stage);
        break;
      case "notripe":
        setNotice({ tone: "info", text: `"${ev.objection}" — nothing you've shipped resolves this yet. Not ripe.` });
        break;
      case "skip":
        setNotice({ tone: "info", text: `Couldn't read a clear objection (${ev.why}). Add why they said no.` });
        break;
      case "error":
        setNotice({ tone: "error", text: ev.message });
        break;
      case "done":
        setResult({ reasoning: ev.reasoning, anchorFact: ev.anchorFact, copy: ev.copy, score: ev.score, feature: ev.feature });
        setStage(null);
        break;
    }
  }

  async function run(text: string) {
    if (!text.trim() || running) return;
    setRunning(true);
    setStage(null);
    setObjection(null);
    setFeature(null);
    setScore(null);
    setResult(null);
    setNotice(null);
    try {
      const res = await fetch("/api/retrigger-live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deal: text }),
      });
      if (!res.ok || !res.body) {
        setNotice({ tone: "error", text: `request failed (${res.status})` });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) handle(JSON.parse(line) as LiveRetriggerEvent);
        }
      }
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "stream failed" });
    } finally {
      setRunning(false);
    }
  }

  const activeIndex = STEPS.findIndex((s) => s.key === stage);
  const showSteps = (running || objection || feature) && !result;

  return (
    <section className="ls">
      <header className="ls-head">
        <span className="ls-kicker">Live · score a lost deal</span>
        <span className="ls-hint">name a deal you lost + why → watch it read, match, score</span>
      </header>

      <form
        className="ls-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(deal);
        }}
      >
        <input
          className="ls-input"
          value={deal}
          onChange={(e) => setDeal(e.target.value)}
          placeholder="Acme — passed last quarter, said no SSO"
          disabled={running}
          aria-label="Describe a lost deal and why it was lost"
        />
        <button className="ls-go" type="submit" disabled={running || !deal.trim()}>
          {running ? "Scoring…" : "Score it"}
        </button>
      </form>

      {!running && !result && !notice && (
        <div className="ls-examples">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="ls-example"
              onClick={() => {
                setDeal(ex);
                run(ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {showSteps && (
        <ol className="ls-steps">
          {STEPS.map((s, i) => {
            const state = activeIndex > i ? "done" : activeIndex === i ? "active" : "idle";
            return (
              <li key={s.key} className={`ls-step ls-step--${state}`}>
                <span className="ls-step-dot" aria-hidden />
                <span className="ls-step-label">{s.label}</span>
                {s.key === "reading" && objection && <span className="ls-step-val">{objection}</span>}
                {s.key === "matching" && feature && <span className="ls-step-val">{feature}</span>}
                {s.key === "scoring" && score !== null && <span className="ls-step-val">{Math.round(score * 100)}</span>}
              </li>
            );
          })}
        </ol>
      )}

      {notice && <p className={`ls-notice ls-notice--${notice.tone}`}>{notice.text}</p>}

      {result && (
        <div className="ls-result">
          <div className="ls-result-head">
            <span className="ls-result-score">{Math.round(result.score * 100)}</span>
            <span className="ls-result-feature">re-triggerable · you shipped {result.feature}</span>
          </div>
          <ReasoningChain reasoning={result.reasoning} anchorFact={result.anchorFact} />
          {result.copy.slice(0, 1).map((cv, i) => (
            <div key={i} className="ls-copy">
              <span className="ls-copy-subject">{cv.subject}</span>
              <span className="ls-copy-body">{cv.body}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
