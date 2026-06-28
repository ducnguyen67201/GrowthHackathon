import { LivePanel } from "@/components/LivePanel";
import { FlowNext } from "@/components/FlowNext";
import "@/components/dashboard.css";

// The Live re-trigger demo as its own route. The interactive flow lives in <LivePanel /> so
// the same engine renders here (full, with the recent-runs wall) and inside the cockpit (`/`,
// compact). Convex gate mirrors the cockpit so `pnpm build` prerenders without Convex.
export default function LivePage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  return (
    <main className="live">
      {configured ? (
        <LivePanel />
      ) : (
        <p className="dash-empty">
          Connect Convex to run the live re-trigger. Run{" "}
          <code>npx convex dev</code>, then revisit.
        </p>
      )}
      <FlowNext current="/live" />
    </main>
  );
}
