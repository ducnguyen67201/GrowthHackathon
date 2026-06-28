import type { Reasoning } from "@/convex/validators";

// The visual hero of every card: saw → inferred → pain → angle → why.
// Deliberately NOT hidden in a popover — the reasoning is the product.
type Props = {
  reasoning: Reasoning;
  anchorFact: string;
};

// hint = a plain-language gloss shown on hover, so the chain reads to someone
// who's never seen it before — not just to the team that named the steps.
const STEPS: { key: keyof Reasoning; label: string; hint: string }[] = [
  { key: "saw", label: "Saw", hint: "The concrete signal we observed" },
  {
    key: "inferred",
    label: "Inferred",
    hint: "What that signal implies about them",
  },
  {
    key: "pain",
    label: "Pain",
    hint: "The problem this creates for them right now",
  },
  { key: "angle", label: "Angle", hint: "The outreach hook we chose" },
  {
    key: "whyThisAngle",
    label: "Why this angle",
    hint: "Why this beats the obvious pitch",
  },
];

export function ReasoningChain({ reasoning, anchorFact }: Props) {
  const confidencePct = Math.round(reasoning.confidence * 100);
  return (
    <div className="reasoning">
      <div className="reasoning-head">
        <span className="reasoning-anchor">{anchorFact}</span>
        <span
          className="reasoning-confidence"
          title={`Model confidence ${confidencePct}%`}
        >
          {confidencePct}%
        </span>
      </div>
      <ol className="reasoning-chain">
        {STEPS.map(({ key, label, hint }) => (
          <li key={key} className="reasoning-step">
            <span className="reasoning-label" title={hint}>
              {label}
            </span>
            <span className="reasoning-text">{String(reasoning[key])}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
