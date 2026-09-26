import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { todayISO, formatLong, puzzleNumber } from '@/lib/dates';
import { pts, initials } from '@/lib/format';
import type { Puzzle, Summary, FriendRow } from '@/lib/types';
import Logo from '@/components/Logo';
import TabBar from '@/components/TabBar';
import { ArrowIcon } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: puzzle }, { data: summary }, { data: friends }] = await Promise.all([
    supabase.rpc('get_puzzle', { p_date: today }),
    supabase.rpc('my_summary'),
    supabase.rpc('my_friends'),
  ]);
  const p = puzzle as Puzzle | null;
  const s = summary as Summary | null;
  const f = ((friends as FriendRow[] | null) ?? []).filter((x) => x.today_answered > 0).slice(0, 3);

  const rounds = p?.rounds ?? [];
  const answered = rounds.filter((r) => r.result).length;
  const fooledToday = rounds.filter((r) => r.result && !r.result.correct).length;
  const done = rounds.length > 0 && answered === rounds.length;
  const photos = rounds.filter((r) => r.media_type === 'image').length;
  const videos = rounds.length - photos;

  return (
    <>
      <main className="screen">
        <header className="row between" style={{ minHeight: 44 }}>
          <Logo />
          <Link href="/me" className={`score-chip${(s?.points ?? 0) === 0 ? ' zero' : ''}`} aria-label={`Your score ${pts(s?.points)}. Open profile`}>
            {pts(s?.points)}
          </Link>
        </header>

        <p className="kicker">DAY {puzzleNumber(today)} · {formatLong(today).toUpperCase()}</p>

        <section className="card-ink">
          {!p || rounds.length === 0 ? (
            <>
              <h1 className="display h1">Today&rsquo;s pairs aren&rsquo;t ready yet.</h1>
              <p style={{ margin: 0, color: 'var(--dark-muted)' }}>They show up at midnight Eastern. Go fail a past day while you wait.</p>
              <Link href="/archive" className="btn btn-shame">OPEN THE ARCHIVE</Link>
            </>
          ) : done ? (
            <>
              <h1 className="display h1">{fooledToday === 0 ? 'Clean sheet. Suspicious.' : `Fooled ${fooledToday} of ${rounds.length} times today.`}</h1>
              <Pips rounds={rounds} />
              <p style={{ margin: 0, color: 'var(--dark-muted)' }}>{pts(-100 * fooledToday)} today. New pairs at midnight Eastern.</p>
              <Link href={`/play/${today}`} className="btn btn-shame">SEE THE DAMAGE</Link>
            </>
          ) : (
            <>
              <h1 className="display h1" style={{ fontSize: 34 }}>
                {rounds.length} pairs.<br />{rounds.length} fresh chances<br />to embarrass<br />yourself.
              </h1>
              <Pips rounds={rounds} />
              <p style={{ margin: 0, fontSize: 14, color: 'var(--dark-muted)' }}>
                {[photos && `${photos} photo${photos === 1 ? '' : 's'}`, videos && `${videos} video${videos === 1 ? '' : 's'}`].filter(Boolean).join(', ')}.
                {' '}About 90 seconds of self-doubt.
              </p>
              <Link href={`/play/${today}`} className="btn btn-shame">{answered > 0 ? 'KEEP GOING' : 'PLAY TODAY'}</Link>
            </>
          )}
        </section>

        <div className="grid2">
          <div className="card stack" style={{ gap: 4, padding: 14 }}>
            <span className="stat-label">SHAME STREAK</span>
            <span className="stat-value">{s?.shame_streak ?? 0} {s?.shame_streak === 1 ? 'day' : 'days'}</span>
            <span className="stat-sub">fooled at least once, daily</span>
          </div>
          <div className="card stack" style={{ gap: 4, padding: 14 }}>
            <span className="stat-label">YESTERDAY</span>
            {s?.yesterday && s.yesterday.answered > 0 ? (
              <>
                <span className="stat-value">{s.yesterday.fooled} of {s.yesterday.total}</span>
                <span className="stat-sub">{s.yesterday.fooled === 0 ? 'wrong. Unbearable.' : 'wrong. Bold strategy.'}</span>
              </>
            ) : (
              <>
                <span className="stat-value">Skipped</span>
                <span className="stat-sub">Scared? It&rsquo;s in the archive.</span>
              </>
            )}
          </div>
        </div>

        {s && s.unplayed_days > 0 && (
          <Link href="/archive" className="card-soft nudge">
            <span className="stack" style={{ gap: 2 }}>
              <strong style={{ fontSize: 16 }}>{s.unplayed_days} unplayed {s.unplayed_days === 1 ? 'day' : 'days'}</strong>
              <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>They&rsquo;re not going to fail themselves.</span>
            </span>
            <ArrowIcon />
          </Link>
        )}

        <section className="stack" style={{ gap: 10 }}>
          <h2 className="section-title">MEANWHILE, YOUR FRIENDS</h2>
          {f.length === 0 ? (
            <p className="small">
              Nobody to compare notes with yet. <Link href="/friends">Add friends</Link> and misery gets company.
            </p>
          ) : (
            f.map((fr) => (
              <div className="row" key={fr.user_id} style={{ gap: 10 }}>
                <span className="avatar">{initials(fr.display_name)}</span>
                <span style={{ flex: 1, fontSize: 14, lineHeight: 1.3 }}>
                  <strong>{fr.display_name}</strong>{' '}
                  {fr.today_fooled === 0
                    ? `is ${fr.today_answered} for ${fr.today_answered} today. Frankly, suspicious.`
                    : `got fooled ${fr.today_fooled} ${fr.today_fooled === 1 ? 'time' : 'times'} today.`}
                </span>
                <span className="mono" style={{ fontSize: 14, color: fr.today_fooled ? 'var(--shame)' : 'var(--muted)' }}>
                  {pts(-100 * fr.today_fooled)}
                </span>
              </div>
            ))
          )}
        </section>
      </main>
      <TabBar active="today" />
    </>
  );
}

function Pips({ rounds }: { rounds: Puzzle['rounds'] }) {
  return (
    <div className="pips" aria-label={`${rounds.filter((r) => r.result).length} of ${rounds.length} rounds played`}>
      {rounds.map((r) => (
        <span key={r.id} className={`pip${r.result ? (r.result.correct ? ' safe' : ' fooled') : ''}`} />
      ))}
    </div>
  );
}
