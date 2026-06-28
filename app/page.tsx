import { AgentActivity } from "@/components/AgentActivity";
import { RegulatoryRadar } from "@/components/RegulatoryRadar";
import { RetriggerBoard } from "@/components/RetriggerBoard";
import { BrainGraph } from "@/components/BrainGraph";
import { LivePanel } from "@/components/LivePanel";
import { PipelineStrip } from "@/components/PipelineStrip";
import "@/components/cockpit.css";

// The cockpit — one full-bleed, single-viewport "mission control" that shows every surface
// at once: the always-on agent ticker, the Regulatory Radar (a law → a forced cohort, the
// focal $2.06M · 9-deals headline), the ranked dead-pipeline board, a live re-trigger, the
// company brain, and the pipeline status strip. Server gate mirrors ConvexClientProvider so
// `pnpm build` (no NEXT_PUBLIC_CONVEX_URL) prerenders the shell instead of throwing.
export default function Home() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  if (!configured) {
    return (
      <main className="cockpit-fallback">
        <p className="dash-empty">
          Connect Convex to wake the cockpit. Run <code>npx convex dev</code>{" "}
          (sets <code>NEXT_PUBLIC_CONVEX_URL</code>), then{" "}
          <code>npx convex run seed:run</code> to load the dead pipeline.
        </p>
      </main>
    );
  }

  return (
    <main className="cockpit" aria-label="Cutthrough mission control">
      <div className="cockpit-agent">
        <AgentActivity />
      </div>

      <section className="panel panel--radar" aria-labelledby="ck-radar">
        <header className="panel-head">
          <div className="panel-head-text">
            <span className="panel-eyebrow">Regulatory radar</span>
            <h2 className="panel-title" id="ck-radar">
              What just woke up
            </h2>
          </div>
          <span className="panel-tag">
            <span className="panel-tag-dot" aria-hidden />
            monitoring
          </span>
        </header>
        <div className="panel-body">
          <RegulatoryRadar />
        </div>
      </section>

      <section className="panel panel--board" aria-labelledby="ck-board">
        <header className="panel-head">
          <div className="panel-head-text">
            <span className="panel-eyebrow">Dead pipeline</span>
            <h2 className="panel-title" id="ck-board">
              Who&rsquo;s worth a call
            </h2>
          </div>
          <span className="panel-tag">ranked by re-win</span>
        </header>
        <div className="panel-body">
          <RetriggerBoard />
        </div>
      </section>

      <section className="panel panel--live" aria-labelledby="ck-live">
        <header className="panel-head">
          <div className="panel-head-text">
            <span className="panel-eyebrow">Live re-trigger</span>
            <h2 className="panel-title" id="ck-live">
              Watch it work
            </h2>
          </div>
          <span className="panel-tag">~90s</span>
        </header>
        <div className="panel-body">
          <LivePanel compact />
        </div>
      </section>

      <section className="panel panel--brain" aria-labelledby="ck-brain">
        <header className="panel-head">
          <div className="panel-head-text">
            <span className="panel-eyebrow">Company brain</span>
            <h2 className="panel-title" id="ck-brain">
              How it all connects
            </h2>
          </div>
          <span className="panel-tag">green = re-trigger</span>
        </header>
        <div className="panel-body panel-body--clip">
          <BrainGraph />
        </div>
      </section>

      <PipelineStrip />
    </main>
  );
}
