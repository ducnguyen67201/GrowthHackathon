export {};
// Branch A smoke test.  Usage: pnpm smoke:fiber "Series A devtools hiring SDRs"
// EXPECT: a real EnrichedLead { name, company, email?, ≥0 socialPosts } + a [fiber charge] log.
// Loads .env.local natively (Node 20.12+ / 24). Requires FIBER_API_KEY.

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — rely on exported env
}

async function main() {
  const query = process.argv[2];
  if (!query) throw new Error('Usage: pnpm smoke:fiber "<company or ICP sentence>"');
  if (!process.env.FIBER_API_KEY) throw new Error("FIBER_API_KEY not set (add to .env.local)");

  const { discoverAndEnrich, getCredits } = await import("../lib/fiber");
  console.log("credits before:", await getCredits());

  const lead = await discoverAndEnrich(query);
  console.log(JSON.stringify(lead, null, 2));

  if (!lead.email) console.warn("⚠ no work email revealed");
  if (lead.socialPosts.length === 0) console.warn("⚠ no social posts (timeout, none found, or post-fetch not wired)");
  console.log("credits after:", await getCredits());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
