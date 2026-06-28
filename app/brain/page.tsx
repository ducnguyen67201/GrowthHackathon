import { BrainGraph } from "@/components/BrainGraph";
import { FlowNext } from "@/components/FlowNext";
import "@/components/dashboard.css";

// Reading-Minds re-aim — the "company brain": every lost deal, objection, shipped feature
// and Fiber signal as one linked knowledge graph (Danylo's Obsidian thesis). Mirrors the
// Convex gate so `pnpm build` prerenders without NEXT_PUBLIC_CONVEX_URL.
export default function BrainPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  return (
    <main className="dash">
      <header className="dash-head">
        <p className="dash-kicker">Reading Minds · Company Brain</p>
        <h1 className="dash-title">Everything your dead pipeline knows, linked</h1>
        <p className="dash-sub">
          Accounts, the objections that killed each deal, what you&rsquo;ve shipped, and the
          fresh Fiber signals on each account — one graph. The green{" "}
          <strong>resolved&nbsp;by</strong> edges are re-triggers: an objection a shipped
          feature now dissolves. Hover any node to trace its path.
        </p>
      </header>

      {configured ? (
        <BrainGraph />
      ) : (
        <p className="dash-empty">
          Connect Convex to load the brain. Run <code>npx convex dev</code>, then revisit.
        </p>
      )}

      <FlowNext current="/brain" />
    </main>
  );
}
