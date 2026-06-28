"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import "./call-intake.css";

// "I just got off a call." The front door of the loop: a rep drops a raw transcript, the
// system reads why it died, and — live — the deal lands in the dead pipeline (brain grows a
// node, recovery $ ticks up). This is the visible "continuous learning": every call studied
// makes the graph bigger and the board longer. Staged reveal over one pure mutation (no key,
// no stream) so it's deterministic on stage; the cockpit panels update on their own (reactive).

type IngestResult = {
  account: string;
  contact: string;
  objection: string;
  category: string;
  quote: string;
  ripe: boolean;
  feature: string | null;
  featureShippedAt: string | null;
  value: number;
  score: number | null;
};

type Sample = {
  account: string;
  contact: string;
  title: string;
  value: number;
  externalSignal?: string;
  externalSignalType?: string;
  transcript: string;
};

// Three calls that just "happened". Two go ripe (a shipped feature dissolves the blocker) and
// light up the pipeline; one stays dead (we genuinely haven't shipped FHIR) — the radar has to
// discriminate or the whole thing reads as fake.
const SAMPLES: Sample[] = [
  {
    account: "Cedar Ridge Health",
    contact: "Dr. Lena Park",
    title: "CISO",
    value: 240000,
    externalSignal: "just closed a $50M Series C",
    externalSignalType: "funding_round",
    transcript: [
      "Rep: Before we talk rollout — anything that would stop security from signing off?",
      "Dr. Lena Park: One thing, and it's a hard one. No SOC2 Type II, no deal — our board won't put PHI anywhere near an unaudited vendor.",
      "Rep: We're SOC2 Type I today, and Type II is on the roadmap —",
      "Dr. Lena Park: A roadmap doesn't clear procurement. Get it certified and we'll restart the eval.",
    ].join("\n"),
  },
  {
    account: "Summit Pediatrics",
    contact: "Marcus Hale",
    title: "IT Director",
    value: 180000,
    externalSignal: "just hired their first CISO",
    externalSignalType: "hiring",
    transcript: [
      "Rep: How are you thinking about access for the clinical team?",
      "Marcus Hale: Clinicians can only see their own patients. You've got one permission level — everyone sees everything. That's a HIPAA problem for us.",
      "Rep: You could split it across separate workspaces —",
      "Marcus Hale: Twelve workspaces isn't a fix. We need real roles. Without role-based access it's a no.",
    ].join("\n"),
  },
  {
    account: "Atlas Health Partners",
    contact: "Priya Nair",
    title: "Head of Compliance",
    value: 300000,
    transcript: [
      "Rep: What would this need to plug into on your side?",
      "Priya Nair: Everything routes through Epic. Without a real FHIR integration it's an island, and an island doesn't get bought here.",
      "Rep: We have a generic REST API —",
      "Priya Nair: Generic REST isn't FHIR. Our integration team won't take it on.",
    ].join("\n"),
  },
];

// Where calls come from — the meeting recorders that auto-feed transcripts in. Connecting one
// is the "set it and forget it" surface: every call its bot joins auto-ingests the second it
// ends. Demo-real (no OAuth) — a connect simulates a call syncing in so you can ingest it live.
// Behind the scenes these are TranscriptSource adapters (lib/sources) — same seam as Gong.
type Provider = { id: string; name: string; mark: string; hue: number };
const PROVIDERS: Provider[] = [
  { id: "granola", name: "Granola", mark: "G", hue: 70 },
  { id: "circleback", name: "Circleback", mark: "↺", hue: 265 },
  { id: "gong", name: "Gong", mark: "◉", hue: 300 },
  { id: "fireflies", name: "Fireflies", mark: "✦", hue: 95 },
];

type Phase = "idle" | "reading" | "objection" | "matching" | "done";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const money = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : `$${Math.round(n / 1000)}k`;

export function CallIntake() {
  const ingest = useMutation(api.intake.ingestCall);
  const counts = useQuery(api.lostDeals.flowCounts, {}) as
    | {
        graveyard: number;
        scored: number;
        recoveredValue: number;
        graveyardValue: number;
      }
    | undefined;

  const [sample, setSample] = useState<Sample>(SAMPLES[0]!);
  const [transcript, setTranscript] = useState(SAMPLES[0]!.transcript);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<string[]>([]);
  const [incoming, setIncoming] = useState<string | null>(null);

  function loadSample(s: Sample) {
    if (running) return;
    setSample(s);
    setTranscript(s.transcript);
    setResult(null);
    setPhase("idle");
    setError(null);
    setIncoming(null);
  }

  // Connect a recorder. Connecting → a call "syncs in" from it (rotate to the next sample) so
  // the demo shows the hands-off path: you don't paste, the call just arrives. Click again to
  // disconnect. ponytail: simulated sync, not OAuth — the real adapter is a TranscriptSource.
  function connect(p: Provider) {
    if (running) return;
    if (connected.includes(p.id)) {
      setConnected(connected.filter((x) => x !== p.id));
      return;
    }
    setConnected([...connected, p.id]);
    const idx = SAMPLES.findIndex((s) => s.account === sample.account);
    loadSample(SAMPLES[(idx + 1) % SAMPLES.length]!);
    setIncoming(p.name);
  }

  async function run() {
    if (running || !transcript.trim()) return;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      setPhase("reading");
      await wait(900);
      const res = (await ingest({
        account: sample.account,
        contact: sample.contact,
        title: sample.title,
        value: sample.value,
        transcript: transcript.trim(),
        externalSignal: sample.externalSignal,
        externalSignalType: sample.externalSignalType,
      })) as IngestResult;
      setResult(res);
      setPhase("objection");
      await wait(900);
      setPhase("matching");
      await wait(900);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ingest failed");
      setPhase("idle");
    } finally {
      setRunning(false);
    }
  }

  const showObjection = result && phase !== "reading";
  const showMatch = result && (phase === "matching" || phase === "done");

  return (
    <main className="intake" aria-label="Call intake">
      <header className="intake-head">
        <p className="intake-kicker">Reading Minds · the loop starts here</p>
        <h1 className="intake-title">Just got off a call?</h1>
        <p className="intake-sub">
          Drop the transcript. The system reads why the deal died, checks it
          against everything you&rsquo;ve shipped, and files it into the
          pipeline — and the company brain grows a node for it. Every call
          studied makes the next re-trigger sharper.
        </p>
      </header>

      <section className="intake-sources" aria-label="Connected call recorders">
        <div className="intake-sources-head">
          <span className="intake-sources-title">Where calls come from</span>
          <span className="intake-sources-sub">
            {connected.length ? (
              <>
                <span className="intake-live-dot" aria-hidden />
                Live · auto-ingesting from {connected.length} source
                {connected.length > 1 ? "s" : ""} the moment a call ends
              </>
            ) : (
              "Connect your call recorder — every call auto-ingests the second it ends"
            )}
          </span>
        </div>
        <div className="intake-providers">
          {PROVIDERS.map((p) => {
            const on = connected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={`intake-provider${on ? " is-on" : ""}`}
                style={{ ["--hue" as string]: String(p.hue) }}
                onClick={() => connect(p)}
                disabled={running}
                aria-pressed={on}
              >
                <span className="intake-provider-mark" aria-hidden>
                  {p.mark}
                </span>
                <span className="intake-provider-name">{p.name}</span>
                <span className="intake-provider-state">
                  {on ? "Connected ✓" : "Connect"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="intake-grid">
        <section className="intake-left" aria-label="Transcript">
          {incoming && !result && (
            <div className="intake-incoming" role="status">
              <span className="intake-live-dot" aria-hidden />
              {incoming} synced a call · just now — review &amp; ingest
            </div>
          )}
          <div className="intake-samples">
            <span className="intake-samples-label">
              A call that just happened
            </span>
            {SAMPLES.map((s) => (
              <button
                key={s.account}
                type="button"
                className={`intake-chip${s.account === sample.account ? " is-on" : ""}`}
                onClick={() => loadSample(s)}
                disabled={running}
              >
                {s.account}
              </button>
            ))}
          </div>

          <div className="intake-meta">
            <span>
              <strong>{sample.contact}</strong> · {sample.title}
            </span>
            <span>{money(sample.value)}/yr</span>
            {sample.externalSignal && (
              <span className="intake-signal">
                ⚡ {sample.account} {sample.externalSignal}
              </span>
            )}
          </div>

          <textarea
            className="intake-transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            spellCheck={false}
            aria-label="Call transcript"
            rows={9}
          />

          <button
            type="button"
            className="intake-go"
            onClick={run}
            disabled={running || !transcript.trim()}
          >
            {running ? "Studying the call…" : "Ingest call →"}
          </button>
          {error && (
            <p className="intake-error" role="alert">
              {error}
            </p>
          )}
        </section>

        <section
          className="intake-right"
          aria-label="What the system found"
          aria-live="polite"
        >
          <ol className="intake-steps">
            <li className={`intake-step${phase !== "idle" ? " is-on" : ""}`}>
              <span className="intake-step-k">Read the call</span>
              <span className="intake-step-v">
                {phase === "reading"
                  ? "Reading why it died…"
                  : showObjection
                    ? `“${result!.quote}”`
                    : "—"}
              </span>
            </li>
            <li className={`intake-step${showObjection ? " is-on" : ""}`}>
              <span className="intake-step-k">Objection</span>
              <span className="intake-step-v intake-step-v--obj">
                {showObjection ? result!.objection : "—"}
              </span>
            </li>
            <li className={`intake-step${showMatch ? " is-on" : ""}`}>
              <span className="intake-step-k">Checked what you shipped</span>
              <span className="intake-step-v">
                {!showMatch
                  ? phase === "objection"
                    ? "Matching against the changelog…"
                    : "—"
                  : result!.ripe
                    ? `✓ ${result!.feature} — shipped ${result!.featureShippedAt}`
                    : "✗ nothing resolves this yet"}
              </span>
            </li>
          </ol>

          {phase === "done" && result && (
            <div
              className={`intake-verdict ${result.ripe ? "is-ripe" : "is-dead"}`}
            >
              {result.ripe ? (
                <>
                  <p className="intake-verdict-head">
                    Re-winnable · {Math.round((result.score ?? 0) * 100)}%
                  </p>
                  <p className="intake-verdict-body">
                    {money(result.value)} back in play. The exact blocker they
                    raised is gone, and a re-open draft is written. It&rsquo;s
                    on the board now.
                  </p>
                  <Link href="/" className="intake-cta">
                    See it land in the pipeline →
                  </Link>
                </>
              ) : (
                <>
                  <p className="intake-verdict-head">
                    Stays in the graveyard — honestly
                  </p>
                  <p className="intake-verdict-body">
                    Nothing you&rsquo;ve shipped resolves “{result.objection}”.
                    The brain keeps it on watch; the day you ship the fix, this{" "}
                    {money(result.value)} deal lights up on its own.
                  </p>
                  <Link href="/brain" className="intake-cta">
                    See it on the brain (no green edge yet) →
                  </Link>
                </>
              )}
            </div>
          )}

          {counts && (
            <div className="intake-counts" aria-label="Pipeline totals, live">
              <span>
                <b>{counts.graveyard}</b> in the graveyard
              </span>
              <span>
                <b>{counts.scored}</b> re-winnable
              </span>
              <span>
                <b>{money(counts.recoveredValue)}</b> recoverable
              </span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
