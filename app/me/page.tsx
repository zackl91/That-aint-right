import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Summary } from '@/lib/types';
import { pts, initials } from '@/lib/format';
import { TITLES } from '@/lib/copy';
import TabBar from '@/components/TabBar';
import ProfileForm from '@/components/ProfileForm';
import AccountBox from '@/components/AccountBox';

export const dynamic = 'force-dynamic';

export default async function Me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: summary }] = await Promise.all([
    user ? supabase.from('profiles').select('display_name, handle, phone_e164, invite_code').eq('id', user.id).single() : Promise.resolve({ data: null }),
    supabase.rpc('my_summary'),
  ]);
  const s = (summary as Summary | null) ?? {
    rounds: 0, fooled: 0, points: 0, shame_streak: 0, longest_streak: 0, worst_day: 0,
    yesterday: null, unplayed_days: 0, categories: [], rank_global: null, rank_friends: null, rank_worst: null,
  };
  const name = profile?.display_name ?? 'Loading your shame…';
  const rate = s.rounds ? Math.round((100 * s.fooled) / s.rounds) : 0;
  const ranks = [
    s.rank_global && `#${s.rank_global} global`,
    s.rank_friends && `#${s.rank_friends} among friends`,
    s.rank_worst && `#${s.rank_worst} by worst %`,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <main className="screen" style={{ gap: 18 }}>
        <header className="row" style={{ gap: 14 }}>
          <span className="avatar" style={{ width: 64, height: 64, fontFamily: 'var(--display)', fontSize: 22 }}>{initials(name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display" style={{ fontSize: 24, lineHeight: 1.1 }}>{name}</div>
            <div className="small">{profile?.handle ? `@${profile.handle}` : 'No handle yet'}{user?.is_anonymous ? ' · guest' : ''}</div>
          </div>
        </header>

        <section className="score-hero">
          <span className="kicker">LIFETIME SCORE</span>
          <span className="big">{pts(s.points)}</span>
          <span style={{ fontSize: 14, color: 'var(--on-shame)' }}>{ranks || 'Unranked. Play a round to fix that.'}</span>
        </section>

        <h2 className="display h2">Your gullibility report</h2>
        <div className="grid2" style={{ gap: 10 }}>
          <Stat label="ROUNDS" value={String(s.rounds)} />
          <Stat label="TIMES FOOLED" value={String(s.fooled)} shame />
          <Stat label="FOOLED RATE" value={`${rate}%`} sub={s.rounds ? 'of your picks were AI' : undefined} />
          <Stat label="LONGEST STREAK" value={`${s.longest_streak} ${s.longest_streak === 1 ? 'day' : 'days'}`} sub="of being fooled daily" />
        </div>

        {s.categories.length > 0 && (
          <section className="stack" style={{ gap: 10 }}>
            <h3 className="section-title">WHERE YOU GET GOT</h3>
            {s.categories.slice(0, 5).map((c) => (
              <div key={c.category} className="stack" style={{ gap: 4 }}>
                <div className="row between" style={{ fontSize: 14 }}>
                  <strong>{c.category}</strong>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{c.fooled} of {c.total}</span>
                </div>
                <div className="meter"><span style={{ width: `${Math.round((100 * c.fooled) / c.total)}%` }} /></div>
              </div>
            ))}
          </section>
        )}

        <section className="stack" style={{ gap: 10 }}>
          <h3 className="section-title">TITLES OF DISHONOR</h3>
          <div className="chips">
            {TITLES.map((t) =>
              t.earned(s) ? (
                <span key={t.name} className="chip">{t.name}</span>
              ) : (
                <span key={t.name} className="chip locked" title={t.hint}>Locked · {t.hint}</span>
              ),
            )}
          </div>
        </section>

        {profile && user && (
          <>
            <ProfileForm initial={{ display_name: profile.display_name, handle: profile.handle, phone: profile.phone_e164 }} />
            <section className="card stack">
              <h3 className="display" style={{ fontSize: 18 }}>Friends</h3>
              <p className="small">Share your invite link or add people by phone number.</p>
              <Link href="/friends" className="btn btn-ink" style={{ minHeight: 48, fontSize: 16 }}>MANAGE FRIENDS</Link>
            </section>
            <AccountBox email={user.email ?? null} isAnonymous={Boolean(user.is_anonymous)} />
          </>
        )}
      </main>
      <TabBar active="me" />
    </>
  );
}

function Stat({ label, value, sub, shame }: { label: string; value: string; sub?: string; shame?: boolean }) {
  return (
    <div className="card stack" style={{ gap: 2, padding: 12, borderRadius: 14 }}>
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={shame ? { color: 'var(--shame)' } : undefined}>{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}
