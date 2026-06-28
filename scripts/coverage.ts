export {};
// Branch F (feat/overnight-batch) implements the overnight coverage run.
// Usage: pnpm coverage --limit 300
// companyCount -> cap -> credit check -> social batch -> enrich+reason+render @ concurrency 5,
// cached by companyId, retry once, idempotent, checkpointed to `runs`, chargeInfo logged.
async function main() {
  throw new Error("not impl: coverage — implement in branch feat/overnight-batch");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
