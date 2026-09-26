/** Scores use a real minus sign. 0 stays 0. */
export function pts(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v === 0) return '0';
  return (v < 0 ? '\u2212' : '') + Math.abs(v).toLocaleString('en-US');
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

/** Loose US-first phone normalization to E.164. Returns null if it can't. */
export function toE164(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? '+' + digits : null;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return null;
}

/** Stable pseudo-random pick so the same round always gets the same roast. */
export function pickStable<T>(list: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return list[Math.abs(h) % list.length];
}
