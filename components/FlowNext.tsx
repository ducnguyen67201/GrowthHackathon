import Link from "next/link";
import { FLOW } from "./flow";
import "./flow-next.css";

// The forward button that chains the surfaces into one walkthrough. Drop
// <FlowNext current="/signals" /> at the bottom of a page; it finds the next step in
// FLOW. On the last step it shows the loop closing back to the start.
export function FlowNext({ current }: { current: string }) {
  const i = FLOW.findIndex((s) => s.href === current);
  const next = i >= 0 ? FLOW[i + 1] : undefined;

  if (!next) {
    return (
      <aside className="flow-next flow-next--loop">
        <span className="flow-next-kicker">The loop closes</span>
        <p className="flow-next-copy">
          Every open re-scores the graveyard — the board sharpens itself.
        </p>
        <Link href={FLOW[0]?.href ?? "/signals"} className="flow-next-cta">
          <span className="flow-next-num" aria-hidden>
            ↻
          </span>
          Back to the Dead Pipeline
          <span className="flow-next-arrow" aria-hidden>
            →
          </span>
        </Link>
      </aside>
    );
  }

  return (
    <aside className="flow-next">
      <span className="flow-next-kicker">Next step</span>
      <Link href={next.href} className="flow-next-cta" title={next.hint}>
        <span className="flow-next-num" aria-hidden>
          {i + 2}
        </span>
        {next.cta}
        <span className="flow-next-arrow" aria-hidden>
          →
        </span>
      </Link>
    </aside>
  );
}
