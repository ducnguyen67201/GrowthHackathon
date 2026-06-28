import type { Reasoning } from "@/convex/validators";

// The visual hero of every card: saw → inferred → pain → angle → why.
// Deliberately NOT hidden in a popover — the reasoning is the product.
type Props = {
  reasoning: Reasoning;
  anchorFact: string;
};

const STEPS: { key: keyof Reasoning; label: string }[] = [
  { key: "saw", label: "Saw" },
  { key: "inferred", label: "Inferred" },
  { key: "pain", label: "Pain" },
  { key: "angle", label: "Angle" },
  { key: "whyThisAngle", label: "Why this angle" },
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
        {STEPS.map(({ key, label }) => (
          <li key={key} className="reasoning-step">
            <span className="reasoning-label">{label}</span>
            <span className="reasoning-text">{String(reasoning[key])}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
