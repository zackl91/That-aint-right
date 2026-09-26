import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { todayISO, LAUNCH_DATE, formatShort } from '@/lib/dates';
import { pts } from '@/lib/format';
import TabBar from '@/components/TabBar';
import { ChevronLeft, ChevronRight } from '@/components/Icons';

export const dynamic = 'force-dynamic';

type Day = { puzzle_date: string; total: number; answered: number; fooled: number };

function monthStart(iso: string) {
  return iso.slice(0, 7) + '-01';
}
function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default async function Archive({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const launchMonth = LAUNCH_DATE.slice(0, 7);
  let ym = m && /^\d{4}-\d{2}$/.test(m) ? m : thisMonth;
  if (ym > thisMonth) ym = thisMonth;

  const [y, mo] = ym.split('-').map(Number);
  const first = monthStart(ym + '-01');
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const last = `${ym}-${String(daysInMonth).padStart(2, '0')}`;

  const supabase = await createClient();
  const { data } = await supabase.rpc('my_calendar', { p_from: first, p_to: last });
  const byDate = new Map(((data as Day[] | null) ?? []).map((d) => [d.puzzle_date, d]));

  const leading = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
  const cells: (string | null)[] = [...Array(leading).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${ym}-${String(d).padStart(2, '0')}`);

  let unplayed: string[] = [];
  for (const [date, d] of byDate) if (date < today && d.answered < d.total) unplayed.push(date);
  unplayed = unplayed.sort().reverse();
  const monthLabel = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <>
      <main className="screen">
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="display h1">The Archive</h1>
          <p className="lede">Missed a day? Go back and fail retroactively.</p>
        </div>

        <div className="row between">
          {ym > launchMonth ? (
            <Link href={`/archive?m=${shiftMonth(ym, -1)}`} className="icon-btn" aria-label="Previous month"><ChevronLeft /></Link>
          ) : (
            <span className="icon-btn" aria-hidden="true" style={{ opacity: 0.3 }}><ChevronLeft /></span>
          )}
          <h2 className="display" style={{ fontSize: 20 }}>{monthLabel}</h2>
          {ym < thisMonth ? (
            <Link href={`/archive?m=${shiftMonth(ym, 1)}`} className="icon-btn" aria-label="Next month"><ChevronRight /></Link>
          ) : (
            <span className="icon-btn" aria-hidden="true" style={{ opacity: 0.3 }}><ChevronRight /></span>
          )}
        </div>

        <div className="legend">
          <span><i style={{ background: 'var(--card)', border: '1.5px solid var(--ink)' }} />Played</span>
          <span><i style={{ background: 'var(--shame-soft)', border: '1.5px solid var(--ink)' }} />Rough day</span>
          <span><i style={{ border: '1.5px dashed var(--ink)' }} />Unplayed</span>
          <span><i style={{ background: 'var(--ink)' }} />Today</span>
        </div>

        <div>
          <div className="cal-head" aria-hidden="true">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="cal" style={{ marginTop: 8 }}>
            {cells.map((date, i) => {
              if (!date) return <span key={`b${i}`} />;
              const n = Number(date.slice(8));
              const d = byDate.get(date);
              if (date === today && d) {
                return (
                  <Link key={date} href={`/play/${date}`} className="day today" aria-label={`Today, ${d.answered} of ${d.total} played`}>
                    {n}<small>{d.answered === d.total ? pts(-100 * d.fooled) : 'TODAY'}</small>
                  </Link>
                );
              }
              if (!d) return <span key={date} className="day none">{n}</span>;
              if (d.answered === 0 || d.answered < d.total) {
                return (
                  <Link key={date} href={`/play/${date}`} className="day missed" aria-label={`Play ${formatShort(date)}`}>
                    {n}<small>{d.answered === 0 ? 'PLAY' : 'RESUME'}</small>
                  </Link>
                );
              }
              const rough = d.fooled / d.total >= 0.6;
              return (
                <Link key={date} href={`/play/${date}`} className={`day ${rough ? 'rough' : 'played'}`} aria-label={`${formatShort(date)}, ${pts(-100 * d.fooled)}`}>
                  {n}<small>{pts(-100 * d.fooled)}</small>
                </Link>
              );
            })}
          </div>
        </div>

        {unplayed.length > 0 ? (
          <section className="card stack">
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.4 }}>
              <strong>{unplayed.length} {unplayed.length === 1 ? 'day' : 'days'} unplayed this month.</strong>{' '}
              That&rsquo;s up to {pts(-500 * unplayed.length)} of shame just sitting there.
            </p>
            <Link href={`/play/${unplayed[0]}`} className="btn btn-ink" style={{ minHeight: 52, fontSize: 17 }}>
              PLAY {formatShort(unplayed[0]).toUpperCase()}
            </Link>
          </section>
        ) : (
          <p className="small center">Every day this month is played. Thorough. Still gullible, but thorough.</p>
        )}
      </main>
      <TabBar active="archive" />
    </>
  );
}
