import assert from "node:assert/strict";
import { buildHtml } from "../lib/mail";

// Branch D check: the email HTML must escape user/AI copy (XSS boundary) and embed
// the open pixel. Network-free — runs without Gmail creds. `pnpm smoke:send`.
function main() {
  const html = buildHtml(
    'Hi <script>alert(1)</script> & "quotes"',
    "http://localhost:3000/pixel/send123",
    "https://cdn.example/art.png",
  );

  assert.ok(!html.includes("<script>"), "raw <script> must be escaped");
  assert.ok(html.includes("&lt;script&gt;"), "body must be HTML-escaped");
  assert.ok(
    html.includes('src="http://localhost:3000/pixel/send123"'),
    "pixel must be embedded",
  );
  assert.ok(
    html.includes("art.png"),
    "artifact image must be embedded when provided",
  );
  assert.ok(
    !buildHtml("hi", "u").includes("border-radius"),
    "no artifact image when pngUrl omitted",
  );

  console.log("smoke:send OK");
}

main();
