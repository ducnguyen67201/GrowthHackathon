import { CallIntake } from "@/components/CallIntake";

// The front door of the loop — "I just got off a call." Server gate mirrors the cockpit so
// `pnpm build` (no NEXT_PUBLIC_CONVEX_URL) prerenders a shell instead of throwing.
export default function IntakePage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  if (!configured) {
    return (
      <main className="cockpit-fallback">
        <p className="dash-empty">
          Connect Convex to ingest a call. Run <code>npx convex dev</code>, then{" "}
          <code>npx convex run seed:run</code> to load the dead pipeline.
        </p>
      </main>
    );
  }

  return <CallIntake />;
}
