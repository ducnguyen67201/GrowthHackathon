"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ReasoningChain } from "@/components/ReasoningChain";
import { Card } from "@/components/Card";
import { TargetDossier } from "@/components/TargetDossier";
import { DealMoment, type Moment } from "@/components/DealMoment";
import { getPersona, type Persona } from "@/lib/demoPersonas";
import type { CreativeCard } from "@/components/types";
import type { Reasoning } from "@/lib/schemas";
import type { LiveRetriggerEvent } from "@/lib/retrigger-live";
import "@/components/dashboard.css"; // reuse .reasoning* + .card-artifact styling
import "./live-panel.css";

// The live proof of the one engine, extracted into a reusable panel so it can live BOTH on
// the /live route (full, with the recent-runs wall) and inside the cockpit (`compact`). Name
// a deal you lost → stream the re-trigger as it's built (read why it died → check what we
// shipped → score → write) → finished card. The persisted creative also lands on the
// Pipeline in realtime, closing the funnel: Brain → Signals → Live → Pipeline.

const STAGE_TEXT: Record<string, string> = {
  reading: "Reading why it died…",
  matching: "Checking what you've shipped since…",
  scoring: "Scoring how re-winnable it is…",
  writing: "Writing the re-open…",
  rendering: "Rendering the card…",
};

type StageKey = "reading" | "matching" | "scoring" | "writing" | "done";
const STAGE_STEPS: { key: StageKey; label: string }[] = [
  { key: "reading", label: "Read" },
  { key: "matching", label: "Match" },
  { key: "scoring", label: "Score" },
  { key: "writing", label: "Write" },
];
const STAGE_PCT: Record<string, number> = {
  reading: 24,
  matching: 50,
  scoring: 70,
  writing: 88,
  rendering: 94,
  done: 100,
};

// Seeded dead deals that carry a real call transcript AND a shipped fix — clicking one
// pulls the actual moment it slipped (lostDeals.byAccount) and goes ripe.
const EXAMPLES = [
  'Veritas Health — "no SOC2 Type II"',
  'Lumen Health — "compliance won\'t sign off"',
  'Beacon Behavioral — "won\'t sign a BAA"',
];

// The account is the head of "Company — reason" — same split the engine uses. Pulled out so
// the transcript lookup keys on exactly what runRetriggerLive reads.
function accountOf(input: string): string {
  return input.split(/[—:–-]/)[0]?.trim() ?? "";
}

// Initials for the dossier avatar, skipping an honorific so "Dr. Huy Ngo" → "HN".
function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter((w) => !/^(dr|mr|mrs|ms|prof)\.?$/i.test(w));
  return parts
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

type LivePanelProps = {
  /** Compact = cockpit panel: drops the hero header + recent-runs wall, tightens the rail. */
  compact?: boolean;
};

export function LivePanel({ compact = false }: LivePanelProps) {
  const [deal, setDeal] = useState("");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [stageKey, setStageKey] = useState<string | null>(null);
  const [objection, setObjection] = useState("");
  const [feature, setFeature] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [reasoning, setReasoning] = useState<Reasoning | null>(null);
  const [anchorFact, setAnchorFact] = useState("");
  const [creativeId, setCreativeId] = useState<string | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  // The account being re-triggered right now — keys the transcript lookup. Set on run so
  // "the moment it slipped" tracks the active deal, not what's half-typed in the box.
  const [activeAccount, setActiveAccount] = useState("");
  // "empty" = a clean non-result (objection unclear, or not winnable yet) — neutral, on
  // thesis, never a failure. "error" = something actually broke.
  const [notice, setNotice] = useState<{
    tone: "empty" | "error";
    text: string;
  } | null>(null);

  // Every live run persists to Convex (a re-trigger is a normal creative). Subscribe to
  // the newest few so this page survives a refresh instead of looking empty.
  const recent = useQuery(api.creatives_read.list, {}) as
    | CreativeCard[]
    | undefined;

  // Pull the actual call where this deal died — the transcript moment behind the re-trigger.
  // Seeded today (lostDeals.transcript); swap for real call reads later, shape unchanged.
  const moment = useQuery(
    api.lostDeals.byAccount,
    activeAccount ? { account: activeAccount } : "skip",
  ) as Moment | null | undefined;

  // When the DB knows this deal, let its truth win over the demo-persona fallback so the
  // dossier and the moment name the SAME real person (e.g. Dr. Huy Ngo, not a hash fallback).
  useEffect(() => {
    if (!moment) return;
    setPersona((p) =>
      p
        ? {
            ...p,
            name: moment.contact,
            title: moment.title ?? p.title,
            company: moment.account,
            avatar: initialsOf(moment.contact) || p.avatar,
            quote: moment.objection ?? p.quote,
            dealValue: moment.value
              ? `$${Math.round(moment.value / 1000)}k/yr`
              : p.dealValue,
            // Real "why now" when the DB has the trigger; keep the fallback otherwise.
            signals: moment.externalSignal
              ? [
                  moment.externalSignal[0]!.toUpperCase() +
                    moment.externalSignal.slice(1),
                  ...p.signals.slice(1),
                ]
              : p.signals,
            seeded: true,
          }
        : p,
    );
  }, [moment]);

  function handle(ev: LiveRetriggerEvent) {
    if ("step" in ev) {
      if (ev.step === "objection") setObjection(ev.text);
      if (ev.step === "feature") setFeature(ev.text);
      if (ev.step === "score") setScore(ev.value);
      return;
    }
    switch (ev.stage) {
      case "reading":
      case "matching":
      case "scoring":
      case "writing":
      case "rendering":
        setStage(STAGE_TEXT[ev.stage] ?? ev.stage);
        setStageKey(ev.stage);
        break;
      case "done":
        setReasoning(ev.reasoning);
        setAnchorFact(ev.anchorFact);
        setScore(ev.score);
        setFeature(ev.feature);
        setCreativeId(ev.creativeId);
        setStage(ev.cached ? "Done · instant (cached)" : "Done");
        setStageKey("done");
        break;
      case "notripe":
        setNotice({
          tone: "empty",
          text: `Not winnable yet — nothing you've shipped resolves “${ev.objection}”. The brain keeps watching; the day you ship it, this deal lights up.`,
        });
        break;
      case "skip":
        setNotice({
          tone: "empty",
          text: "Couldn't read a clear reason from that. Try “Company — the reason they said no”.",
        });
        break;
      case "error":
        setNotice({
          tone: "error",
          text: `Something went wrong: ${ev.message}`,
        });
        break;
    }
  }

  async function runDeal(dealStr: string) {
    if (!dealStr.trim() || running) return;
    setRunning(true);
    setStage(null);
    setStageKey(null);
    setObjection("");
    setFeature("");
    setScore(null);
    setReasoning(null);
    setAnchorFact("");
    setCreativeId(null);
    setNotice(null);
    setActiveAccount(accountOf(dealStr)); // key the transcript lookup to this deal
    setPersona(getPersona(dealStr)); // pull the target up immediately

    try {
      const res = await fetch("/api/retrigger-live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deal: dealStr.trim() }),
      });
      if (!res.ok || !res.body) {
        setNotice({ tone: "error", text: `Request failed (${res.status})` });
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
          if (line) handle(JSON.parse(line) as LiveRetriggerEvent);
        }
      }
    } catch (err: unknown) {
      setNotice({
        tone: "error",
        text: err instanceof Error ? err.message : "Stream failed",
      });
    } finally {
      setRunning(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runDeal(deal);
  }

  // Deep-link handoff: /live?deal=… pre-fills and auto-runs once, so clicking a ripe deal
  // anywhere in the app lands here already re-triggering. Read the URL in an effect (not
  // useSearchParams) to keep this page statically prerenderable. Skip in compact (cockpit)
  // mode so the cockpit doesn't auto-fire on a shared ?deal= query.
  const autoRan = useRef(false);
  useEffect(() => {
    if (compact || autoRan.current) return;
    const d = new URLSearchParams(window.location.search).get("deal");
    if (d && d.trim()) {
      autoRan.current = true;
      setDeal(d);
      void runDeal(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDone = stageKey === "done";
  const activeIndex = STAGE_STEPS.findIndex((s) => s.key === stageKey);
  const pct = stageKey ? (STAGE_PCT[stageKey] ?? 8) : running ? 8 : 0;
  const showProgress = (running || stageKey !== null) && notice === null;
  // Nothing in flight and no result yet — in the compact cockpit panel we fill the column
  // with a ghosted preview of what a run produces, so it reads as "ready" not "empty".
  const idle = !running && !reasoning && !stage && notice === null;

  // Interim signals as they stream in — replaced by the full chain on done.
  const interim: { label: string; text: string }[] = [];
  if (objection) interim.push({ label: "Why it died", text: objection });
  if (feature) interim.push({ label: "What we shipped", text: feature });
  if (score !== null)
    interim.push({ label: "Re-win score", text: `${Math.round(score * 100)}%` });

  const stageBody = (
    <>
      {!compact && (
        <header className="live-head">
          <p className="dash-kicker">Tombstone · Live</p>
          <h1 className="dash-title">Re-trigger a deal you lost — live</h1>
          <p className="dash-sub">
            Name a deal you lost and why. Watch the brain read why it died, check
            it against what you&rsquo;ve shipped since, score how re-winnable it
            is, and write the re-open — a finished card in under 90s.
          </p>
        </header>
      )}

      <form className="live-form" onSubmit={onSubmit}>
        <input
          className="live-input"
          type="text"
          value={deal}
          onChange={(e) => setDeal(e.target.value)}
          placeholder={
            compact
              ? "Name a dead deal — and why they passed"
              : 'A deal you lost — e.g. Veritas Health — "no SOC2 Type II"'
          }
          autoComplete="off"
          aria-label="A deal you lost"
        />
        <button
          type="submit"
          className="live-go"
          disabled={!deal.trim() || running}
        >
          {running ? (
            <>
              <span className="spinner" aria-hidden />
              Running…
            </>
          ) : (
            "Re-trigger"
          )}
        </button>
      </form>

      {!running && !reasoning && !stage && (
        <div className="live-examples">
          <span className="live-examples-label">Try a dead deal</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="live-example"
              onClick={() => setDeal(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {compact && idle && (
        <div className="livep-ghost" aria-hidden>
          <ol className="livep-ghost-chain">
            {["Saw", "Inferred", "Pain", "Angle"].map((label, i) => (
              <li key={label} className="livep-ghost-step">
                <span className="livep-ghost-label">{label}</span>
                <span
                  className="livep-ghost-bar"
                  style={{ width: `${[92, 74, 84, 66][i] ?? 80}%` }}
                />
              </li>
            ))}
          </ol>
          <div className="livep-ghost-card">
            <span className="livep-ghost-card-tag">re-open card</span>
            <span className="livep-ghost-card-line livep-ghost-card-line--lg" />
            <span className="livep-ghost-card-line" />
            <span className="livep-ghost-card-line livep-ghost-card-line--sm" />
          </div>
          <p className="livep-ghost-cap">
            Pick a dead deal above to watch it re-open in ~90s.
          </p>
        </div>
      )}

      {showProgress && (
        <div
          className="live-progress"
          role="status"
          aria-label={stage ?? "Working…"}
        >
          <div className="live-progress-track">
            <div
              className={`live-progress-fill${isDone ? " is-done" : " is-working"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <ol className="live-progress-steps">
            {STAGE_STEPS.map((s, i) => {
              const done = isDone || (activeIndex > -1 && i < activeIndex);
              const active = !isDone && i === activeIndex;
              return (
                <li
                  key={s.key}
                  className={`live-progress-step${done ? " is-done" : ""}${
                    active ? " is-active" : ""
                  }`}
                >
                  {s.label}
                </li>
              );
            })}
          </ol>
          {stage && <p className="live-progress-caption">{stage}</p>}
        </div>
      )}

      {persona && (running || reasoning || notice) && (
        <TargetDossier persona={persona} />
      )}

      {moment && (running || reasoning || notice) && (
        <DealMoment moment={moment} />
      )}

      {reasoning ? (
        <ReasoningChain reasoning={reasoning} anchorFact={anchorFact} />
      ) : (
        interim.length > 0 && (
          <ol className="live-steps">
            {interim.map(({ label, text }) => (
              <li key={label} className="live-step">
                <span className="reasoning-label">{label}</span>
                <span className="reasoning-text">{text}</span>
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
          alt={`Re-trigger artifact for ${deal}`}
        />
      )}

      {notice && (
        <div
          className={`live-notice live-notice--${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          <span className="live-notice-icon" aria-hidden>
            {notice.tone === "error" ? "!" : "∅"}
          </span>
          <span>{notice.text}</span>
        </div>
      )}

      {creativeId && (
        <a className="live-link" href="/">
          ↗ See it land on the cockpit
        </a>
      )}
    </>
  );

  // Compact (cockpit) — just the stage, the panel body owns the scroll.
  if (compact) {
    return <div className="livep livep--compact">{stageBody}</div>;
  }

  // Full (route) — the stage rail beside the recent-runs wall.
  return (
    <div className="live-cols">
      <section className="live-stage">{stageBody}</section>

      <aside className="live-side">
        {recent && recent.length > 0 && (
          <section className="live-recent">
            <h2 className="live-recent-title">Recent re-triggers</h2>
            <p className="live-recent-sub">
              Saved automatically — these survive a refresh. Full history under{" "}
              <a href="/">the cockpit</a>.
            </p>
            <div className="dash-grid">
              {recent.slice(0, 6).map((c) => (
                <Card key={c._id} creative={c} />
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
