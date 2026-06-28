import type { Persona } from "@/lib/demoPersonas";
import "./target-dossier.css";

// The target the re-trigger is aimed at: who they are, the dead deal, and — the hero —
// "why now", the signals that flipped them back to winnable. Shown as soon as a run
// starts so the judge sees a real person being pulled up, not a mail merge.
export function TargetDossier({ persona }: { persona: Persona }) {
  return (
    <aside className="dossier" aria-label={`Target: ${persona.name}`}>
      <div className="dossier-head">
        <span className="dossier-avatar" aria-hidden>
          {persona.avatar}
        </span>
        <div className="dossier-id">
          <strong className="dossier-name">{persona.name}</strong>
          <span className="dossier-role">
            {persona.title} · {persona.company}
          </span>
          <span className="dossier-firmo">
            {persona.domain} · {persona.employees} employees
          </span>
        </div>
        <span className="dossier-tag">Target</span>
      </div>

      <dl className="dossier-deal">
        <div>
          <dt>Lost</dt>
          <dd>
            {persona.lostAgo} · deal was {persona.dealValue}
          </dd>
        </div>
        <div>
          <dt>Said</dt>
          <dd className="dossier-quote">&ldquo;{persona.quote}&rdquo;</dd>
        </div>
      </dl>

      <div className="dossier-why">
        <span className="dossier-why-label">Why now</span>
        <ul className="dossier-signals">
          {persona.signals.map((s) => (
            <li key={s} className="dossier-signal">
              {s}
            </li>
          ))}
        </ul>
      </div>

      {!persona.seeded && (
        <p className="dossier-note">
          Illustrative dossier — wire <code>lib/fiber.ts</code> for live enrichment.
        </p>
      )}
    </aside>
  );
}
