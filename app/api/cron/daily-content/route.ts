import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generatePuzzle } from '@/lib/content/pipeline';
import { addDays, todayISO } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Runs daily (see vercel.json). Keeps puzzles built CONTENT_LEAD_DAYS ahead.
 * Builds at most one missing day per run so it stays inside Vercel's time limit;
 * use `npm run content -- --days N` to fill a bigger gap.
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
  const missing = window.find((d) => !have.has(d));
  if (!missing) return NextResponse.json({ ok: true, message: `All set through ${window[window.length - 1]}` });

  const logs: string[] = [];
  try {
    const result = await generatePuzzle(missing, {
      publish: process.env.AUTO_PUBLISH !== 'false',
      log: (m) => logs.push(m),
    });
    return NextResponse.json({ ok: true, result, logs });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, logs }, { status: 500 });
  }
}
