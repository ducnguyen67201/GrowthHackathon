import OpenAI from "openai";

// Reading-Minds re-aim — the "continuous learning" term (w4). NO model training:
// every re-won deal's objection text joins a set; an account scores higher the more it
// resembles deals you've already won back. As outcomes accumulate, the centroid shifts
// and scores sharpen. That IS the learning loop — embeddings + cosine, no weights.

const EMBED_MODEL = "text-embedding-3-small";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export async function embed(text: string): Promise<number[]> {
  const res = await client().embeddings.create({
    model: EMBED_MODEL,
    input: text,
  });
  const vec = res.data[0]?.embedding;
  if (!vec) throw new Error("embed: no embedding returned");
  return vec;
}

// --- pure math (no API — this is what the smoke test asserts) ---

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na === 0 || nb === 0) return 0;
  // clamp to [0,1]: cosine is [-1,1], but objection embeddings are non-negative-ish;
  // we only care about "how close", so floor negatives at 0.
  return Math.max(0, dot / (Math.sqrt(na) * Math.sqrt(nb)));
}

export function centroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = (vectors[0] ?? []).length;
  const out = new Array<number>(dim).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) out[i] = (out[i] ?? 0) + (vec[i] ?? 0);
  }
  for (let i = 0; i < dim; i++) out[i] = (out[i] ?? 0) / vectors.length;
  return out;
}

// similarity of an objection to the set of deals you've re-won. Empty won-set → 0
// (no prior to learn from yet — the cold start, honestly scored).
export async function similarityToWon(
  objectionText: string,
  wonObjectionTexts: string[],
): Promise<number> {
  if (wonObjectionTexts.length === 0) return 0;
  const [objVec, wonVecs] = await Promise.all([
    embed(objectionText),
    Promise.all(wonObjectionTexts.map(embed)),
  ]);
  return cosine(objVec, centroid(wonVecs));
}
