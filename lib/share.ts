import type { Round } from './types';

/** F = fooled, S = survived, T = too slow. One letter per round. */
export function patternFor(rounds: Round[]): string {
  return rounds.map((r) => (!r.result ? '' : r.result.correct ? 'S' : r.result.timed_out ? 'T' : 'F')).join('');
}

export function isValidPattern(p: string) {
  return /^[FST]{1,10}$/.test(p);
}

export function cleanName(n: string | null | undefined): string {
  return (n ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
}

export function shareUrl(origin: string, date: string, pattern: string, name?: string | null) {
  const n = cleanName(name);
  return `${origin}/s/${date}/${pattern}${n ? `?n=${encodeURIComponent(n)}` : ''}`;
}

export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:3000';
}
