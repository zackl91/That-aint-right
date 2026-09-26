// AI images via Replicate. Default model is FLUX schnell (cheap, fast).
// Swap REPLICATE_IMAGE_MODEL for something more convincing when you want harder puzzles.

type Prediction = {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get: string };
};

export const imageModel = () => process.env.REPLICATE_IMAGE_MODEL || 'black-forest-labs/flux-schnell';
/** Round 5 each day. Set REPLICATE_BOSS_MODEL to the same as the normal model to turn boss rounds off. */
export const bossModel = () => process.env.REPLICATE_BOSS_MODEL || 'black-forest-labs/flux-1.1-pro';

export async function generateImage(prompt: string, model: string = imageModel()): Promise<Buffer> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'wait=55' },
    body: JSON.stringify({
      input: { prompt, aspect_ratio: '3:2', output_format: 'jpg', output_quality: 90 },
    }),
  });
  if (!res.ok) throw new Error(`Replicate request failed (${res.status}): ${await res.text()}`);
  let pred = (await res.json()) as Prediction;

  const started = Date.now();
  while ((pred.status === 'starting' || pred.status === 'processing') && Date.now() - started < 90_000) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(pred.urls!.get, { headers });
    pred = (await poll.json()) as Prediction;
  }
  if (pred.status !== 'succeeded') throw new Error(`Image generation ${pred.status}: ${pred.error ?? 'timed out'}`);

  const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!out) throw new Error('Image generation returned no output');
  const img = await fetch(out);
  if (!img.ok) throw new Error(`Could not download generated image (${img.status})`);
  return Buffer.from(await img.arrayBuffer());
}
