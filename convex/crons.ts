import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

// The dead pipeline analyzes itself. Every couple of minutes the autonomous worker fetches
// Fiber for any un-analyzed deal, refreshes its signal/score, and stamps it — so deals never
// just sit there waiting for a manual trigger. New ingests don't wait for this tick: they're
// also scheduled immediately by intake.ingestCall.
const crons = cronJobs();

crons.interval(
  "analyze dead pipeline",
  { minutes: 2 },
  api.pipeline.analyzePipeline,
  {},
);

export default crons;
