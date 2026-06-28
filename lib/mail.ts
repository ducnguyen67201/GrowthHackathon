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
  videoUrl?: string,
): string {
  const text = escapeHtml(body).replace(/\n/g, "<br>");
  // Email clients can't autoplay mp4 — so the card image becomes a click-through to the
  // hosted 7-second clip, with an explicit "watch" link beneath it. That's the unique touch.
  const img = pngUrl
    ? `<img src="${escapeHtml(pngUrl)}" alt="" style="max-width:520px;width:100%;border-radius:8px;display:block">`
    : "";
  const watch = videoUrl
    ? `<a href="${escapeHtml(videoUrl)}" style="display:inline-block;margin-top:8px;color:#0a7d4b;font-weight:600;text-decoration:none">▶ Watch the 7-second walkthrough</a>`
    : "";
  const art =
    pngUrl && videoUrl
      ? `<p><a href="${escapeHtml(videoUrl)}" style="text-decoration:none">${img}</a>${watch}</p>`
      : pngUrl
        ? `<p>${img}</p>`
        : videoUrl
          ? `<p>${watch}</p>`
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
  videoUrl?: string;
  pixelUrl: string;
}): Promise<{ messageId: string }> {
  const info = await getTransport().sendMail({
    from: process.env.GMAIL_USER,
    to: a.to,
    subject: a.subject,
    text: a.videoUrl ? `${a.body}\n\n▶ Watch the 7-second walkthrough: ${a.videoUrl}` : a.body,
    html: buildHtml(a.body, a.pixelUrl, a.pngUrl, a.videoUrl),
  });
  return { messageId: info.messageId };
}
