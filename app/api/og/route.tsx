import { ImageResponse } from 'next/og';
import { isValidISODate, puzzleNumber } from '@/lib/dates';
import { isValidPattern, cleanName } from '@/lib/share';
import { verdict } from '@/lib/copy';

export const runtime = 'nodejs';

const INK = '#16130f';
const PAPER = '#f3eee3';
const CARD = '#fffdf7';
const SHAME = '#c4321a';

/** Fetch a Google font subset as TTF (satori can't use woff2). Falls back to the default font. */
async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const date = u.searchParams.get('d') ?? '';
  const pattern = (u.searchParams.get('p') ?? '').toUpperCase();
  const name = cleanName(u.searchParams.get('n'));
  const generic = !isValidISODate(date) || !isValidPattern(pattern);

  const total = pattern.length;
  const fooled = [...pattern].filter((c) => c !== 'S').length;
  const score = fooled === 0 ? '0' : `\u2212${(fooled * 100).toLocaleString('en-US')}`;
  const who = name || 'Someone';
  const headline = generic
    ? 'One is real. One is AI. Pick the real one.'
    : fooled === 0
      ? `${who} wasn't fooled once.`
      : `${who} got fooled ${fooled} of ${total} times.`;
  const sub = generic ? 'Lose 100 points every time a computer fools you.' : `Day ${puzzleNumber(date)} · ${verdict(fooled, total)}. Think you can do better?`;

  const display = await googleFont('Archivo+Black', 400, `THAT AIN’T RIGHT ${headline} ${score} 0123456789\u2212`);
  const body = await googleFont('Work+Sans', 600, `${sub} ${headline}`);
  const fonts = [
    display && { name: 'Display', data: display, weight: 400 as const, style: 'normal' as const },
    body && { name: 'Body', data: body, weight: 600 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 600; style: 'normal' }[];

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: PAPER, color: INK, padding: '56px 64px', fontFamily: 'Body' }}>
        <div style={{ display: 'flex', fontFamily: 'Display', fontSize: 40, letterSpacing: -1 }}>
          THAT&nbsp;<span style={{ color: SHAME }}>AI</span>N&rsquo;T RIGHT
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', fontFamily: 'Display', fontSize: generic ? 64 : 58, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 1000 }}>{headline}</div>
          {!generic && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              <div style={{ display: 'flex', gap: 14 }}>
                {[...pattern].map((c, i) => (
                  <div key={i} style={{ width: 88, height: 88, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c === 'S' ? CARD : SHAME, border: `4px solid ${INK}`, color: c === 'S' ? INK : CARD, fontFamily: 'Display', fontSize: 44 }}>
                    {c === 'S' ? (
                      <svg width="48" height="48" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : (
                      <svg width="44" height="44" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke={CARD} strokeWidth="3.2" strokeLinecap="round" /></svg>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', fontFamily: 'Display', fontSize: 96, color: fooled ? SHAME : INK, letterSpacing: -3 }}>{score}</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 30 }}>
          <span>{sub}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: fonts.length ? fonts : undefined, headers: { 'Cache-Control': 'public, max-age=86400, immutable' } },
  );
}
