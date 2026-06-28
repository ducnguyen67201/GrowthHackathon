// The one pipeline, in order. Both the header stepper and the per-page "Next step"
// CTA read from this, so the four surfaces present as a single guided flow:
// Graveyard → Why → Re-trigger → Send & learn (and the loop closes back to the start).
export type FlowStep = {
  href: string;
  label: string; // the surface name (familiar nav label)
  step: string; // the role it plays in the flow
  hint: string; // hover gloss
  cta: string; // the forward action shown on the previous page's "Next" button
};

export const FLOW: FlowStep[] = [
  {
    href: "/intake",
    label: "Call In",
    step: "Talk",
    hint: "A call just ended — drop the transcript, the system studies it",
    cta: "Drop a call you just had",
  },
  {
    href: "/signals",
    label: "Dead Pipeline",
    step: "Graveyard",
    hint: "Lost deals, ranked by who's winnable again",
    cta: "See the deals you lost, ranked",
  },
  {
    href: "/brain",
    label: "Brain",
    step: "Why",
    hint: "Every deal, objection & shipped feature — linked",
    cta: "See why they're winnable again",
  },
  {
    href: "/live",
    label: "Live",
    step: "Re-trigger",
    hint: "Re-trigger one lost deal, live — in 90s",
    cta: "Watch one re-trigger, live in 90s",
  },
  {
    href: "/",
    label: "Pipeline",
    step: "Send & learn",
    hint: "Re-triggers sent — opens feed back into the score",
    cta: "Send it — and let opens re-score the board",
  },
];
