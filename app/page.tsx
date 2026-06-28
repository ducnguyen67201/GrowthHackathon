import { Pipeline } from "@/components/Pipeline";
import "@/components/dashboard.css";

// Server gate: only mount the realtime grid when Convex is configured. Mirrors
// ConvexClientProvider's own guard so `pnpm build` (no NEXT_PUBLIC_CONVEX_URL)
// prerenders the shell instead of throwing inside useQuery.
export default function Home() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  return (
    <main className="dash">
      <header className="dash-head">
        <p className="dash-kicker">Cutthrough</p>
        <h1 className="dash-title">Pipeline</h1>
        <p className="dash-sub">
          Every card leads with the reasoning — what we saw, what we inferred,
          and why this angle beats the obvious one.
        </p>
      </header>

      {configured ? (
        <Pipeline />
      ) : (
        <p className="dash-empty">
          Convex isn’t connected yet. Run <code>npx convex dev</code> (sets{" "}
          <code>NEXT_PUBLIC_CONVEX_URL</code>), then{" "}
          <code>npx convex run seed:run</code> to load sample leads.
        </p>
      )}
    </main>
  );
}
