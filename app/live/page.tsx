"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ReasoningChain } from "@/components/ReasoningChain";
import { Card } from "@/components/Card";
import type { CreativeCard } from "@/components/types";
import type { Reasoning } from "@/lib/schemas";
import type { LiveEvent } from "@/lib/livegen";
import "@/components/dashboard.css"; // reuse .reasoning* + .card-artifact styling
import "./live.css";

// Branch E (feat/live-gen). Type a company → stream the reasoning chain as it's
// produced → finished card. The persisted creative also appears on the dashboard
// Pipeline in realtime, so this view stays focused on the live reveal.

const STEP_LABELS: { key: keyof Reasoning; label: string }[] = [
  { key: "saw", label: "Saw" },
  { key: "inferred", label: "Inferred" },
  { key: "pain", label: "Pain" },
  { key: "angle", label: "Angle" },
  { key: "whyThisAngle", label: "Why this angle" },
];

const STAGE_TEXT: Record<string, string> = {
  discovering: "Discovering the company…",
  reasoning: "Reasoning over real signals…",
  rendering: "Rendering the card…",
};

const EXAMPLES = ["Vercel", "Stripe", "Linear", "Notion"];

export default function LivePage() {
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [steps, setSteps] = useState<Partial<Record<keyof Reasoning, string>>>(
    {},
  );
  const [reasoning, setReasoning] = useState<Reasoning | null>(null);
  const [anchorFact, setAnchorFact] = useState("");
  const [creativeId, setCreativeId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Every live run is persisted to Convex (see lib/livegen persist()). Subscribe to
  // the newest few so this page survives a refresh instead of looking empty.
  const recent = useQuery(api.creatives_read.list, {}) as
    | CreativeCard[]
    | undefined;

  function handle(ev: LiveEvent) {
    if ("step" in ev) {
      setSteps((s) => ({ ...s, [ev.step]: ev.text }));
      return;
    }
    switch (ev.stage) {
      case "discovering":
      case "reasoning":
      case "rendering":
        setStage(STAGE_TEXT[ev.stage] ?? ev.stage);
        break;
      case "done":
        setReasoning(ev.reasoning);
        setAnchorFact(ev.anchorFact);
        setCreativeId(ev.creativeId);
        setStage(ev.cached ? "Done · instant (cached)" : "Done");
        break;
      case "skip":
        setMessage(`Skipped — too thin for a non-generic angle: ${ev.why}`);
        break;
      case "error":
        setMessage(`Error: ${ev.message}`);
        break;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || running) return;
    setRunning(true);
    setStage(null);
    setSteps({});
    setReasoning(null);
    setAnchorFact("");
    setCreativeId(null);
    setMessage(null);

    try {
      const res = await fetch("/api/live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (!res.ok || !res.body) {
        setMessage(`Request failed (${res.status})`);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line) handle(JSON.parse(line) as LiveEvent);
        }
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Stream failed");
    } finally {
      setRunning(false);
    }
  }

  const arrivedSteps = STEP_LABELS.filter(({ key }) => steps[key]);

  return (
    <main className="live">
      <header className="live-head">
        <p className="dash-kicker">Cutthrough · Live</p>
        <h1 className="dash-title">Reason about any company, live</h1>
        <p className="dash-sub">
          Type a company. Watch the chain build — what we saw, inferred, and why
          this angle beats the obvious one — then a finished card in under 90s.
        </p>
      </header>

      <form className="live-form" onSubmit={onSubmit}>
        <input
          className="live-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a company name…"
          autoComplete="off"
          aria-label="Company"
        />
        <button
          type="submit"
          className="live-go"
          disabled={!query.trim() || running}
        >
          {running ? "Running…" : "Run"}
        </button>
      </form>

      {!running && !reasoning && !stage && (
        <div className="live-examples">
          <span className="live-examples-label">Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="live-example"
              onClick={() => setQuery(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {stage && (
        <p className="live-stage" role="status">
          {stage}
        </p>
      )}

      {reasoning ? (
        <ReasoningChain reasoning={reasoning} anchorFact={anchorFact} />
      ) : (
        arrivedSteps.length > 0 && (
          <ol className="live-steps">
            {arrivedSteps.map(({ key, label }) => (
              <li key={key} className="live-step">
                <span className="reasoning-label">{label}</span>
                <span className="reasoning-text">{steps[key]}</span>
              </li>
            ))}
          </ol>
        )
      )}

      {creativeId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="card-artifact"
          src={`/api/artifact/${creativeId}`}
          alt={`Outreach artifact for ${query}`}
        />
      )}

      {message && (
        <p className="live-message" role="alert">
          {message}
        </p>
      )}

      {creativeId && (
        <a className="live-link" href="/">
          ↗ See it in the Pipeline
        </a>
      )}

      {recent && recent.length > 0 && (
        <section className="live-recent">
          <h2 className="live-recent-title">Recent runs</h2>
          <p className="live-recent-sub">
            Saved automatically — these survive a refresh. Full history under{" "}
            <a href="/">Pipeline</a>.
          </p>
          <div className="dash-grid">
            {recent.slice(0, 6).map((c) => (
              <Card key={c._id} creative={c} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
