import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isValidISODate, puzzleNumber, todayISO, formatLong } from '@/lib/dates';
import type { Puzzle, Summary } from '@/lib/types';
import Game from '@/components/Game';

export const dynamic = 'force-dynamic';

export default async function PlayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const supabase = await createClient();
  const valid = isValidISODate(date) && date <= todayISO();
  const [{ data: puzzle }, { data: summary }] = valid
    ? await Promise.all([supabase.rpc('get_puzzle', { p_date: date }), supabase.rpc('my_summary')])
    : [{ data: null }, { data: null }];
  const p = puzzle as Puzzle | null;

  if (!p || p.rounds.length === 0) {
    return (
      <main className="screen no-tabs" style={{ justifyContent: 'center' }}>
        <h1 className="display h1">Nothing to fail here.</h1>
        <p className="lede">
          {valid ? `There's no puzzle for ${formatLong(date)}.` : "That day hasn't happened yet. Nice try, time traveler."}
        </p>
        <Link href="/archive" className="btn btn-ink">PICK ANOTHER DAY</Link>
        <Link href="/" className="btn btn-outline">Back to today</Link>
      </main>
    );
  }

  return (
    <Game
      date={date}
      number={puzzleNumber(date)}
      isToday={date === todayISO()}
      initialRounds={p.rounds}
      lifetimeStart={(summary as Summary | null)?.points ?? 0}
    />
  );
}
