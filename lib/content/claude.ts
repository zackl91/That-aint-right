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
export async function promptFromPhoto(
  photo: Buffer, alt: string, query: string, flaws: string[],
): Promise<{ prompt: string; subject: string }> {
  const text = await ask([
    img(photo),
    {
      type: 'text',
      text:
        `This is a real photo (search: "${query}", alt text: "${alt}"). It will be shown next to an AI image in a game ` +
        'where players must spot the real one. Write a text-to-image prompt for a DIFFERENT photo that is as hard as possible ' +
        'to tell apart from this one: same kind of subject, setting, time of day, lighting, lens, color palette and level of polish. ' +
        'Match the polish: if this looks like a professional shot, keep it professional; if it looks casual, keep it casual. ' +
        'Either way, add the ordinary imperfections real cameras produce, picking whichever of these fit: ' +
        `${flaws.join('; ')}. ` +
        'Include a few specific, mundane background details (clutter, signage without readable text, uneven surfaces). ' +
        'Avoid anything AI tends to get wrong: hands, readable text, reflections of people, crowds, symmetrical patterns. ' +
        'Describe it as an ordinary photograph with a named camera or phone. Never mention AI, rendering, illustration or art styles. ' +
        'Under 90 words. Also write a subject line of 3 to 8 lowercase words starting with "a" or "an", describing what both photos show. ' +
        'Reply with JSON only: {"prompt": "...", "subject": "..."}',
    },
  ], 500);
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
