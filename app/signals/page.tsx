import { TriggerPanel } from "@/components/TriggerPanel";
import "@/components/dashboard.css";

// Surfaces the signal spine that was built but never mounted. Mirrors the home
// page's Convex gate so `pnpm build` (no NEXT_PUBLIC_CONVEX_URL) prerenders cleanly.
export default function SignalsPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  return (
    <main className="dash">
      <header className="dash-head">
        <p className="dash-kicker">Cutthrough · Signals</p>
        <h1 className="dash-title">What we watch</h1>
        <p className="dash-sub">
          Every outreach starts with a trigger. These are the buying signals we
          track in real time — pick one and replay it on any company to see why
          it fires.
        </p>
      </header>

      {configured ? (
        <TriggerPanel />
      ) : (
        <p className="dash-empty">
          Connect Convex to load the live signal spine. Run{" "}
          <code>npx convex dev</code>, then revisit this page.
        </p>
      )}
    </main>
  );
}
