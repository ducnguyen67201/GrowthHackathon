import { prewarm } from "@/lib/livegen";

// Branch E. Pre-run the loop for demo inputs so they return instantly and survive
// an API flake on stage. Needs OPENAI_API_KEY, FIBER_API_KEY, and
// NEXT_PUBLIC_CONVEX_URL set. Run the night before / morning of the demo.
const COMPANIES = ["Vercel", "Stripe", "Linear", "Ramp", "Notion"];

prewarm(COMPANIES)
  .then(() => {
    console.log("✓ prewarm complete — .livecache/ populated.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
