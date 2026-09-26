import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { ShameRow, Summary } from '@/lib/types';
import { pts, initials } from '@/lib/format';
import { PODIUM_TITLES } from '@/lib/copy';
import TabBar from '@/components/TabBar';

export const dynamic = 'force-dynamic';

export default async function Shame() {
  const supabase = await createClient();
  const [{ data }, { data: summary }] = await Promise.all([
    supabase.rpc('wall_of_shame', { p_limit: 10 }),
    supabase.rpc('my_summary'),
  ]);
  const rows = (data as ShameRow[] | null) ?? [];
  const top = rows.filter((r) => r.rank <= 10);
  const podium = top.slice(0, 3);
  const hall = top.slice(3);
  const me = rows.find((r) => r.is_me);
  const s = summary as Summary | null;
  const lastOnWall = top[top.length - 1];
  const order = [podium[1], podium[0], podium[2]]; // 2nd, 1st, 3rd

  return (
    <>
      <main className="screen dark" style={{ gap: 18 }}>
        <div className="stack" style={{ gap: 8 }}>
          <p className="kicker">LAST 7 DAYS · EVERYONE</p>
          <h1 className="display" style={{ fontSize: 50, lineHeight: 0.92 }}>WALL OF<br />SHAME</h1>
          <p className="lede">Enshrined for a week. The people most confidently wrong about what&rsquo;s real.</p>
        </div>

        {podium.length === 0 ? (
          <p className="empty" style={{ color: 'var(--dark-muted)' }}>The wall is empty. Somebody has to be first. Statistically, it&rsquo;s you.</p>
        ) : (
          <div className="podium">
            {order.map((r, i) => {
              if (!r) return <div key={i} />;
              const first = r === podium[0];
              const place = podium.indexOf(r) + 1;
              const height = place === 1 ? 108 : place === 2 ? 76 : 56;
              return (
                <div key={r.user_id} className={`spot${first ? ' first' : ''}`}>
                  <div className="mugshot">{initials(r.display_name)}</div>
                  <div className="nm">{r.is_me ? 'You' : r.display_name}</div>
                  <div className="pt">{pts(r.points)}</div>
                  <div className="ttl">{PODIUM_TITLES[(place - 1) % PODIUM_TITLES.length]}</div>
                  <div
                    className="block"
                    style={{ height, fontSize: place === 1 ? 38 : 28, background: place === 1 ? 'var(--shame)' : undefined, color: place === 1 ? 'var(--card)' : undefined }}
                  >
                    {place}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hall.length > 0 && (
          <ol className="hall">
            {hall.map((r) => (
              <li key={r.user_id} className={r.is_me ? 'me' : undefined}>
                <span className="r">{r.rank}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 15 }}>{r.is_me ? `${r.display_name} (you)` : r.display_name}</strong>
                  {r.worst_miss && <span className="miss">Worst miss: {r.worst_miss}</span>}
                </span>
                <span className="p">{pts(r.points)}</span>
              </li>
            ))}
          </ol>
        )}

        <section style={{ border: '2px solid var(--paper)', borderRadius: 16, padding: 16 }} className="stack">
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.4 }}>
            {me && me.rank <= 10
              ? `You're #${me.rank} on the wall. Frame it. Or don't, that's a lot of evidence.`
              : me && lastOnWall
                ? `You're #${me.rank} this week. ${pts(lastOnWall.points - me.points).replace('\u2212', '')} more points of bad judgment and you're on the wall.`
                : s && s.rounds > 0
                  ? "You haven't been fooled this week. Keep it up. We'll wait."
                  : "You haven't played yet. The wall is waiting."}
          </p>
          <Link href="/ranks?tab=global" className="btn btn-paper" style={{ minHeight: 48, fontFamily: 'var(--body)', fontSize: 15, fontWeight: 700 }}>
            See full rankings
          </Link>
        </section>
      </main>
      <TabBar active="shame" />
    </>
  );
}
