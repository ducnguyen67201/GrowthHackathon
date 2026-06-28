// CONTRACT (Wave 0). Branch D (feat/send-reply) implements via nodemailer (Gmail app pw).
// Embed the open pixel; inline the artifact PNG + copy. Low volume, plain text.

export async function sendCreative(_a: {
  to: string;
  subject: string;
  body: string;
  pngUrl?: string;
  pixelUrl: string;
}): Promise<{ messageId: string }> {
  throw new Error("not impl: sendCreative — implement in branch feat/send-reply");
}
