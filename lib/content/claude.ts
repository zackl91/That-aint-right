// Optional helpers using the Anthropic API. Everything here has a fallback,
// so the pipeline still works without ANTHROPIC_API_KEY (just less clever).

const model = () => process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
export const hasClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } };

async function ask(content: Block[], maxTokens = 400): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: model(), max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { content: { type: string; text?: string }[] };
  return json.content.map((c) => c.text ?? '').join('');
}

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

const img = (buf: Buffer): Block => ({
  type: 'image',
  source: { type: 'base64', media_type: 'image/jpeg', data: buf.toString('base64') },
});

/** Turn a real photo into a prompt for a look-alike fake, plus a short subject line. */
export async function promptFromPhoto(photo: Buffer, alt: string, query: string): Promise<{ prompt: string; subject: string }> {
  const text = await ask([
    img(photo),
    {
      type: 'text',
      text:
        `This is a real stock photo (search: "${query}", alt text: "${alt}"). ` +
        'Write a text-to-image prompt that would produce a DIFFERENT photo that could plausibly sit next to this one: ' +
        'same kind of subject, setting, time of day, lighting, lens and casual photographic feel (natural noise, imperfect framing). ' +
        'Describe it as an ordinary photograph. Never mention AI, rendering, illustration or art styles. Under 80 words. ' +
        'Also write a subject line of 3 to 8 lowercase words starting with "a" or "an", describing what both photos show. ' +
        'Reply with JSON only: {"prompt": "...", "subject": "..."}',
    },
  ]);
  const out = parseJson<{ prompt: string; subject: string }>(text);
  if (!out.prompt || !out.subject) throw new Error('Claude returned an incomplete prompt');
  return out;
}

/** One playful sentence on what gives the fake away. */
export async function findTell(ai: Buffer, real: Buffer): Promise<string> {
  const text = await ask([
    img(ai),
    img(real),
    {
      type: 'text',
      text:
        'The first image is AI-generated. The second is a real photo. ' +
        'In one playful sentence of at most 25 words, name the most concrete visual giveaway in the FIRST image ' +
        'that a sharp-eyed player could have spotted (hands, text, textures, lighting, physics, background mush, symmetry). ' +
        'Be specific to this image. Reply with JSON only: {"tell": "..."}',
    },
  ], 200);
  return parseJson<{ tell: string }>(text).tell;
}
