import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generatePuzzle } from '@/lib/content/pipeline';
import { addDays, todayISO } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Runs daily (see vercel.json). Keeps puzzles built CONTENT_LEAD_DAYS ahead,
 * filling every missing day in that window while there's time left.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const lead = Number(process.env.CONTENT_LEAD_DAYS ?? 2);
  const today = todayISO();
  const window = Array.from({ length: lead + 1 }, (_, i) => addDays(today, i));

  const db = createAdminClient();
  const { data } = await db.from('puzzles').select('puzzle_date').in('puzzle_date', window);
  const have = new Set((data ?? []).map((p) => p.puzzle_date as string));
  const missing = window.filter((d) => !have.has(d));
  if (missing.length === 0) return NextResponse.json({ ok: true, message: `All set through ${window[window.length - 1]}` });

  const started = Date.now();
  const logs: string[] = [];
  const built: string[] = [];
  const errors: string[] = [];
  for (const date of missing) {
    if (Date.now() - started > 180_000) break; // leave headroom under the 300s limit
    try {
      await generatePuzzle(date, { publish: process.env.AUTO_PUBLISH !== 'false', log: (m) => logs.push(m) });
      built.push(date);
    } catch (e) {
      errors.push(`${date}: ${(e as Error).message}`);
    }
  }
  return NextResponse.json({ ok: errors.length === 0, built, errors, logs }, { status: errors.length && !built.length ? 500 : 200 });
}
