import { AgentActivity } from "@/components/AgentActivity";
import { RegulatoryRadar } from "@/components/RegulatoryRadar";
import { SignalFlowRail } from "@/components/SignalFlowRail";
import { LiveScore } from "@/components/LiveScore";
import { SignalViews } from "@/components/SignalViews";
import { FlowNext } from "@/components/FlowNext";
import "@/components/dashboard.css";

// Reading-Minds re-aim — the dead-pipeline board. Mirrors the home page's Convex gate so
// `pnpm build` (no NEXT_PUBLIC_CONVEX_URL) prerenders cleanly.
export default function SignalsPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  return (
    <main className="dash">
      <header className="dash-head">
        <p className="dash-kicker">Reading Minds · Healthcare SaaS</p>
        <h1 className="dash-title">When a law changes, your dead deals wake up</h1>
        <p className="dash-sub">
          Every row is a healthcare deal you lost to a compliance gap. The moment a
          regulation takes effect, every deal it now <em>forces</em> to act lights up at
          once — with the exact quote and date they told you no.
        </p>
      </header>

      {configured ? (
        <>
          <AgentActivity />
          <RegulatoryRadar />
          <SignalFlowRail />
          <LiveScore />
          <SignalViews />
        </>
      ) : (
        <p className="dash-empty">
          Connect Convex to load the board. Run <code>npx convex dev</code>, then
          revisit this page.
        </p>
      )}

      <FlowNext current="/signals" />
    </main>
  );
}
