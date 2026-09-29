import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidISODate, todayISO } from '@/lib/dates';

/** Counts a click from a shared result, then drops the visitor straight into that day's puzzle. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const d = url.searchParams.get('d') ?? '';
  const date = isValidISODate(d) && d <= todayISO() ? d : todayISO();
  try {
    await createAdminClient().from('share_clicks').insert({ puzzle_date: date });
  } catch {
    /* tracking is best-effort */
  }
  const res = NextResponse.redirect(new URL(`/play/${date}`, url.origin));
  res.cookies.set('tar_welcomed', '1', { path: '/', maxAge: 63072000, sameSite: 'lax' });
  return res;
}
