"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import "./deal-moment.css";

// The deal autopsy behind a /live re-trigger: the analysis on the card, the FULL call one
// click away in a popup. Pull the actual transcript up, mark the turn it died, then read it
// like a rep prepping to win it back — where we lost, what we learned, how to re-open.
// DB-backed (lostDeals.byAccount), seeded today, real call reads later — shape unchanged.

export type Moment = {
  account: string;
  contact: string;
  title: string | null;
  value: number | null;
  lostDate: string;
  objection: string | null;
  objectionCategory: string | null;
  lostReason: string;
  transcript: string | null;
  transcriptDate: string | null;
  externalSignal: string | null;
  fixFeature: string | null;
  fixShippedAt: string | null;
  fixDescription: string | null;
};

type Turn = { speaker: string; line: string; isRep: boolean };

const REP_SPEAKERS = new Set(["rep", "sales", "ae", "us", "cutthrough"]);
const STOP = new Set(["no", "not", "a", "the", "our", "for", "without", "missing", "wont", "cant", "ii"]);

// What to bring to the re-open, keyed to the objection category. Generic fallback otherwise.
const PROOF: Record<string, string> = {
  soc2: "the SOC2 Type II report and audited-controls summary",
  baa: "a counter-signed BAA and the HIPAA compliance pack",
  hipaa: "the HIPAA compliance pack and a signed BAA",
  "audit-logs": "a live PHI access-log trail — who saw which record, when",
  encryption: "the encryption-at-rest architecture note (AES-256)",
  rbac: "the role-based access config mapped to clinician roles",
  sso: "the SAML SSO + SCIM setup guide",
  pricing: "the usage-based pricing model run against their actual volume",
  salesforce: "a two-way Salesforce sync demo on their object model",
};

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Seeded transcripts carry a date but not per-turn times — synthesize a clock off a 10:04am
// start so the popup reads like a real timestamped call. Deterministic (index-based).
function turnTime(idx: number): string {
  const mins = 10 * 60 + 4 + idx; // 10:04, 10:05, …
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Split a transcript into speaker turns. Seeded as "Speaker: line" per row; a bare line
// (no real call yet) becomes a single attributed turn.
function parseTurns(transcript: string, fallbackSpeaker: string): Turn[] {
  const rows = transcript
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  return rows.map((row) => {
    const m = row.match(/^([^:]{1,48}):\s*(.+)$/s);
    const speaker = m ? m[1]!.trim() : fallbackSpeaker;
    const line = m ? m[2]!.trim() : row;
    return { speaker, line, isRep: REP_SPEAKERS.has(speaker.toLowerCase()) };
  });
}

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

// The turn the deal died on: the buyer line with the most overlap with the objection.
function deathTurnIndex(turns: Turn[], objection: string | null): number {
  if (!objection) return -1;
  const key = new Set(words(objection));
  let best = -1;
  let bestScore = 0;
  turns.forEach((t, i) => {
    if (t.isRep) return;
    const score = words(t.line).filter((w) => key.has(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return bestScore > 0 ? best : -1;
}

// Inline-mark the objection's core phrase (prefix stripped) inside the death line.
function highlight(line: string, objection: string | null): ReactNode {
  if (!objection) return line;
  const core = objection.replace(/^(no|missing|won'?t sign a|no native|lack of)\s+/i, "").trim();
  const i = line.toLowerCase().indexOf(core.toLowerCase());
  if (i === -1 || !core) return line;
  return (
    <>
      {line.slice(0, i)}
      <mark className="moment-mark">{line.slice(i, i + core.length)}</mark>
      {line.slice(i + core.length)}
    </>
  );
}

// First name only, honorific stripped — for the chat label ("Dr. Huy Ngo" → "Huy").
function shortName(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((w) => !/^(dr|mr|mrs|ms|prof)\.?$/i.test(w))[0] ?? name
  );
}

// --- the popup: the full call, them vs. us, timestamped ---
function TranscriptModal({
  moment,
  turns,
  deathIdx,
  open,
  onClose,
}: {
  moment: Moment;
  turns: Turn[];
  deathIdx: number;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const when = fmtDate(moment.transcriptDate) ?? fmtDate(moment.lostDate);
  const them = shortName(moment.contact);

  return (
    <dialog
      ref={ref}
      className="tx-modal"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
    >
      <div className="tx-panel">
        <header className="tx-head">
          <div>
            <p className="tx-title">Call transcript · {moment.account}</p>
            <p className="tx-sub">
              {moment.contact}
              {moment.title ? `, ${moment.title}` : ""}
              {when ? ` · ${when} · discovery call` : ""}
            </p>
          </div>
          <button
            type="button"
            className="tx-close"
            onClick={onClose}
            aria-label="Close transcript"
          >
            ✕
          </button>
        </header>

        <ol className="tx-thread">
          {turns.map((t, i) => {
            const isDeath = i === deathIdx;
            return (
              <li
                key={i}
                className={`tx-turn${t.isRep ? " is-us" : " is-them"}${
                  isDeath ? " is-death" : ""
                }`}
              >
                <div className="tx-meta">
                  <span className="tx-who">{t.isRep ? "Us" : them}</span>
                  <span className="tx-time">{turnTime(i)}</span>
                </div>
                <div className="tx-bubble">
                  {isDeath ? highlight(t.line, moment.objection) : t.line}
                  {isDeath && <span className="tx-death-tag">deal ended here</span>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </dialog>
  );
}

export function DealMoment({ moment }: { moment: Moment }) {
  const [open, setOpen] = useState(false);
  const transcript = moment.transcript ?? moment.lostReason;
  const turns = parseTurns(transcript, moment.contact);
  const deathIdx = deathTurnIndex(turns, moment.objection);
  const death = deathIdx > -1 ? turns[deathIdx] : turns.find((t) => !t.isRep) ?? turns[0];
  const when = fmtDate(moment.transcriptDate) ?? fmtDate(moment.lostDate);

  const buyerRole = moment.title ? `the ${moment.title}` : "the buyer";
  const proof =
    (moment.objectionCategory && PROOF[moment.objectionCategory]) ??
    "the changelog entry and a 60-second proof clip";
  const fixWhen = fmtDate(moment.fixShippedAt);
  const multiTurn = turns.length > 1;

  return (
    <section className="moment" aria-label={`Deal autopsy: ${moment.account}`}>
      <header className="moment-head">
        <span className="moment-kicker">Where the deal died</span>
        {when && (
          <span className="moment-when">
            {when} · {moment.transcriptDate ? "discovery call" : "deal notes"}
          </span>
        )}
      </header>

      {/* The one turn it died on — the full call is one click away in the popup. */}
      {death && (
        <div className="moment-death">
          <span className="moment-death-speaker">
            {death.isRep ? "Us" : shortName(moment.contact)}
          </span>
          <p className="moment-death-line">
            {deathIdx > -1 ? highlight(death.line, moment.objection) : death.line}
            <span className="moment-death-tag">deal ended here</span>
          </p>
        </div>
      )}

      {multiTurn && (
        <button
          type="button"
          className="moment-tx-open"
          onClick={() => setOpen(true)}
        >
          ▶ Play the full call · {turns.length} turns
        </button>
      )}

      <dl className="moment-read">
        <div className="moment-row">
          <dt>Where we lost</dt>
          <dd>
            {buyerRole} ({moment.contact}) gated it on one requirement
            {moment.objection ? (
              <>
                : <strong>&ldquo;{moment.objection}&rdquo;</strong>
              </>
            ) : (
              ""
            )}
            . Binary — no negotiating room, and it never reached pricing.
          </dd>
        </div>
        <div className="moment-row">
          <dt>What we learned</dt>
          <dd>
            They disengaged the second we couldn&rsquo;t clear it. The product was never
            in question — the blocker was{" "}
            {moment.objection ? moment.objection : "a hard requirement we hadn't met"}.
          </dd>
        </div>
      </dl>

      <div className="moment-prep">
        <span className="moment-prep-label">Prep for the re-open</span>
        <ul className="moment-prep-list">
          {moment.fixFeature && (
            <li>
              <span className="moment-prep-key">Lead with</span>
              <strong>{moment.fixFeature}</strong> is live{fixWhen ? ` (${fixWhen})` : ""} — the
              exact blocker is gone.
            </li>
          )}
          <li>
            <span className="moment-prep-key">Bring</span>
            {proof}.
          </li>
          {moment.externalSignal && (
            <li>
              <span className="moment-prep-key">Timing</span>
              {moment.externalSignal} — a reason to reach out now, not someday.
            </li>
          )}
          <li>
            <span className="moment-prep-key">Don&rsquo;t</span>
            re-pitch the product — they already wanted it. Open on the blocker, not the demo.
          </li>
          <li>
            <span className="moment-prep-key">Open with</span>
            <em>
              &ldquo;{moment.objection ?? "the blocker"} was the dealbreaker — it&rsquo;s
              resolved. Worth restarting the eval?&rdquo;
            </em>
          </li>
        </ul>
      </div>

      <TranscriptModal
        moment={moment}
        turns={turns}
        deathIdx={deathIdx}
        open={open}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}
