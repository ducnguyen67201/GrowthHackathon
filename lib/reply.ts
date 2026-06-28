// CONTRACT (Wave 0). Branch D (feat/send-reply) implements the Reply Cyborg:
// read the inbound reply + original reasoning/copy context -> draft the next message.

export async function draftReply(
  _inbound: string,
  _ctx: { reasoning: unknown; copy: string },
): Promise<{ draftReply: string; intent: string; suggestedAction: string }> {
  throw new Error("not impl: draftReply — implement in branch feat/send-reply");
}
