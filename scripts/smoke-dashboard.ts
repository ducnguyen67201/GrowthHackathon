import assert from "node:assert/strict";
import { safeHref, replaceVariant } from "../lib/dashboard";

// Branch C check: the two non-trivial pure paths behind the dashboard —
// the URL-scheme guard (XSS) and the immutable variant replace (bounds + no mutation).
// Run: pnpm tsx scripts/smoke-dashboard.ts

// safeHref: allow http/https, reject everything else.
assert.equal(
  safeHref("https://x.com/jordanlee/status/1"),
  "https://x.com/jordanlee/status/1",
);
assert.equal(safeHref("http://acme.dev"), "http://acme.dev");
assert.equal(safeHref("javascript:alert(1)"), undefined);
assert.equal(safeHref("data:text/html,<script>1</script>"), undefined);
assert.equal(safeHref("not a url"), undefined);
assert.equal(safeHref(undefined), undefined);

// replaceVariant: immutable, in-range replace; original untouched.
const variants = [
  { subject: "a", body: "A" },
  { subject: "b", body: "B" },
];
const next = { subject: "b2", body: "B2" };
const result = replaceVariant(variants, 1, next);
assert.deepEqual(result, [variants[0], next]);
assert.deepEqual(variants[1], { subject: "b", body: "B" }); // not mutated
assert.notEqual(result, variants); // new array

// replaceVariant: out-of-range throws.
assert.throws(() => replaceVariant(variants, 2, next), /out of range/);
assert.throws(() => replaceVariant(variants, -1, next), /out of range/);

console.log("smoke-dashboard: all assertions passed");
