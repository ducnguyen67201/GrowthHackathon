export {};
// Branch A (feat/fiber-data) implements this smoke test.
// Usage: pnpm smoke:fiber "Vercel"
// EXPECT: a real lead { name, company, email, ≥1 socialPost } + chargeInfo logged.
async function main() {
  const company = process.argv[2];
  if (!company) throw new Error('Usage: pnpm smoke:fiber "<company>"');
  throw new Error("not impl: smoke-fiber — implement in branch feat/fiber-data");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
