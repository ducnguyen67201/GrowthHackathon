import nodemailer from "nodemailer";

// Branch D (feat/send-reply). Real send via Gmail app password. Low volume,
// plain text + one inline image (the artifact) + a 1x1 open-tracking pixel.
// Node-only (net/tls): only import this from a Convex `"use node"` action.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildHtml(
  body: string,
  pixelUrl: string,
  pngUrl?: string,
): string {
  const text = escapeHtml(body).replace(/\n/g, "<br>");
  const art = pngUrl
    ? `<p><img src="${escapeHtml(pngUrl)}" alt="" style="max-width:520px;width:100%;border-radius:8px"></p>`
    : "";
  // ponytail: remote <img> for the pixel; Gmail proxies it, so opens log coarse
  // (once on first open). Switch to a CID attachment if per-open fidelity matters.
  const pixel = `<img src="${escapeHtml(pixelUrl)}" width="1" height="1" alt="" style="display:none">`;
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.5">${text}${art}${pixel}</div>`;
}

let transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER / GMAIL_APP_PASSWORD not set — needed for sendCreative",
    );
  }
  if (!transport) {
    transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transport;
}

export async function sendCreative(a: {
  to: string;
  subject: string;
  body: string;
  pngUrl?: string;
  pixelUrl: string;
}): Promise<{ messageId: string }> {
  const info = await getTransport().sendMail({
    from: process.env.GMAIL_USER,
    to: a.to,
    subject: a.subject,
    text: a.body,
    html: buildHtml(a.body, a.pixelUrl, a.pngUrl),
  });
  return { messageId: info.messageId };
}
