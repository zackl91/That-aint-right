import { createAdminClient } from '@/lib/supabase/admin';
import { formatShort } from '@/lib/dates';
import { pts } from '@/lib/format';

type Row = { puzzle_date: string; position: number; subject: string; category: string; difficulty: string; answers: number; fool_pct: number };
type Group = { answers: number; fool_pct: number | null };
type Stats = {
  today: string;
  players: { all_time: number; this_month: number; today: number; returning: number };
  accounts: { total: number; registered: number; guests: number; new_month: number; new_today: number; with_phone: number; friend_links: number };
  answers: { all_time: number; this_month: number; today: number; fool_pct: number | null; fool_pct_month: number | null; timeout_pct: number | null; points_lost: number };
  today_puzzle: { rounds: number | null; started: number; finished: number; perfect: number; avg_score: number | null };
  content: { published: number; drafts: number; days_ahead: number; last_date: string | null; first_date: string | null; rounds_built_month: Record<string, number> | null };
  by_difficulty: (Group & { difficulty: string })[];
  by_category: (Group & { category: string })[];
  by_model: (Group & { model: string; rounds: number })[];
  hardest: Row[];
  easiest: Row[];
  trend: { d: string; players: number; answers: number; fool_pct: number | null }[];
  engagement?: {
    shares_today: number; shares_month: number; shares_all: number; invites_all: number; sharers_all: number;
    clicks_today: number; clicks_month: number; clicks_all: number;
    next_day_pct: number | null; next_day_base: number;
    cohorts: { day: string; new_players: number; came_back: number; complete: boolean }[];
  };
};

// Rough Replicate prices per image. Estimates only; check replicate.com for current pricing.
const PRICE: Record<string, number> = {
  'black-forest-labs/flux-schnell': 0.003,
  'black-forest-labs/flux-dev': 0.025,
  'black-forest-labs/flux-1.1-pro': 0.04,
};

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString('en-US');
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);

export default async function Stats() {
  const { data, error } = await createAdminClient().rpc('admin_stats');
  if (error || !data) {
    return (
      <section className="card stack">
        <h2 className="display h2">Stats</h2>
        <p className="notice err">
          Stats aren&rsquo;t available yet{error ? `: ${error.message}` : ''}. Run the latest <code>supabase/schema.sql</code> in the Supabase SQL Editor.
        </p>
      </section>
    );
  }
  const s = data as Stats;
  const built = s.content.rounds_built_month ?? {};
  const spend = Object.entries(built).reduce((sum, [m, c]) => sum + (PRICE[m] ?? 0.003) * c, 0);
  const tp = s.today_puzzle;
  const maxPlayers = Math.max(1, ...s.trend.map((t) => t.players));

  return (
    <section className="stack" style={{ gap: 16 }}>
      <h2 className="display h2">Stats</h2>

      <StatGroup title="PLAYERS">
        <Stat label="Active today" value={n(s.players.today)} sub="picked on any day's puzzle" />
        <Stat label="This month" value={n(s.players.this_month)} />
        <Stat label="All time" value={n(s.players.all_time)} sub="made at least one pick" />
        <Stat label="Came back 2+ days" value={n(s.players.returning)} sub={s.players.all_time ? `${Math.round((100 * s.players.returning) / s.players.all_time)}% of players` : undefined} />
      </StatGroup>

      {s.engagement && (
        <StatGroup title="GROWTH">
          <Stat
            label="Came back next day"
            value={pct(s.engagement.next_day_pct)}
            sub={s.engagement.next_day_base ? `of ${n(s.engagement.next_day_base)} new players` : 'needs a full day of data'}
          />
          <Stat label="Result shares" value={n(s.engagement.shares_all)} sub={`${n(s.engagement.shares_today)} today · ${n(s.engagement.sharers_all)} people shared`} />
          <Stat label="Clicks on shared links" value={n(s.engagement.clicks_all)} sub={`${n(s.engagement.clicks_today)} today · ${n(s.engagement.clicks_month)} this month`} />
          <Stat
            label="Clicks per share"
            value={s.engagement.shares_all ? (s.engagement.clicks_all / s.engagement.shares_all).toFixed(1) : '—'}
            sub="how well shares pull people in"
          />
          <Stat label="Invite link shares" value={n(s.engagement.invites_all)} />
        </StatGroup>
      )}

      <StatGroup title={`TODAY'S PUZZLE · ${formatShort(s.today).toUpperCase()}`}>
        <Stat label="Started" value={n(tp.started)} sub="this puzzle specifically" />
        <Stat label="Finished" value={n(tp.finished)} sub={tp.started ? `${Math.round((100 * tp.finished) / tp.started)}% completion` : undefined} />
        <Stat label="Perfect 0" value={n(tp.perfect)} />
        <Stat label="Avg score" value={tp.avg_score == null ? '—' : pts(tp.avg_score)} sub="finished players" />
      </StatGroup>

      <StatGroup title="PICKS">
        <Stat label="Today" value={n(s.answers.today)} />
        <Stat label="This month" value={n(s.answers.this_month)} />
        <Stat label="All time" value={n(s.answers.all_time)} />
        <Stat label="Fooled rate" value={pct(s.answers.fool_pct)} sub={`${pct(s.answers.fool_pct_month)} this month · ${pct(s.answers.timeout_pct)} timeouts`} />
        <Stat label="Points lost, everyone" value={pts(s.answers.points_lost)} />
      </StatGroup>

      <StatGroup title="ACCOUNTS">
        <Stat label="Total" value={n(s.accounts.total)} sub={`${n(s.accounts.new_today)} new today · ${n(s.accounts.new_month)} this month`} />
        <Stat label="Never played" value={n(Math.max(0, s.accounts.total - s.players.all_time))} sub="visited, made no picks" />
        <Stat label="With email" value={n(s.accounts.registered)} />
        <Stat label="Guests" value={n(s.accounts.guests)} />
        <Stat label="Friend links" value={n(s.accounts.friend_links)} />
        <Stat label="Phone added" value={n(s.accounts.with_phone)} />
      </StatGroup>

      <StatGroup title="CONTENT">
        <Stat label="Days ahead" value={n(s.content.days_ahead)} sub={s.content.last_date ? `through ${formatShort(s.content.last_date)}` : 'none built'} />
        <Stat label="Published days" value={n(s.content.published)} sub={s.content.first_date ? `since ${formatShort(s.content.first_date)}` : undefined} />
        <Stat label="Drafts" value={n(s.content.drafts)} />
        <Stat label="Image spend, month" value={`≈ $${spend.toFixed(2)}`} sub="estimate from rounds built" />
      </StatGroup>

      <div className="card stack">
        <h3 className="section-title">LAST 14 DAYS · PLAYERS PER DAY</h3>
        <div className="trend" role="img" aria-label="Players per day for the last 14 days">
          {s.trend.map((t) => (
            <div key={t.d} className="trend-col" title={`${formatShort(t.d)}: ${t.players} players, ${t.answers} picks, ${pct(t.fool_pct)} fooled`}>
              <span className="trend-val">{t.players || ''}</span>
              <span className="trend-track"><span className="trend-bar" style={{ height: `${(100 * t.players) / maxPlayers}%` }} /></span>
              <span className="trend-label">{t.d.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-tables">
        {s.engagement && (
          <Table
            title="NEW PLAYERS · CAME BACK NEXT DAY"
            head={['First played', 'New', 'Came back']}
            rows={s.engagement.cohorts
              .filter((c) => c.new_players > 0)
              .map((c) => [
                formatShort(c.day),
                n(c.new_players),
                c.complete ? `${n(c.came_back)} (${Math.round((100 * c.came_back) / c.new_players)}%)` : `${n(c.came_back)} so far`,
              ])}
            empty="No new players in the last two weeks"
          />
        )}
        <Table title="FOOLED RATE BY ROUND TYPE" rows={s.by_difficulty.map((r) => [r.difficulty === 'boss' ? 'Boss (round 5)' : 'Normal', n(r.answers), pct(r.fool_pct)])} head={['Type', 'Picks', 'Fooled']} />
        <Table title="BY MODEL" rows={s.by_model.map((r) => [r.model.replace('black-forest-labs/', ''), n(r.rounds), n(r.answers), pct(r.fool_pct)])} head={['Model', 'Rounds', 'Picks', 'Fooled']} />
        <Table title="BY CATEGORY" rows={s.by_category.map((r) => [r.category, n(r.answers), pct(r.fool_pct)])} head={['Category', 'Picks', 'Fooled']} />
        <Table
          title="MOST CONVINCING FAKES"
          rows={s.hardest.map((r) => [`${formatShort(r.puzzle_date)} #${r.position}`, r.subject, pct(r.fool_pct)])}
          head={['Round', 'Subject', 'Fooled']}
          empty="Needs 5+ picks on a round"
        />
        <Table
          title="EASIEST FAKES"
          rows={s.easiest.map((r) => [`${formatShort(r.puzzle_date)} #${r.position}`, r.subject, pct(r.fool_pct)])}
          head={['Round', 'Subject', 'Fooled']}
          empty="Needs 5+ picks on a round"
        />
      </div>
    </section>
  );
}

function StatGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <h3 className="section-title">{title}</h3>
      <div className="admin-stats">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card stack" style={{ gap: 2, padding: 12, borderRadius: 14 }}>
      <span className="stat-label">{label.toUpperCase()}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

function Table({ title, head, rows, empty = 'No data yet' }: { title: string; head: string[]; rows: string[][]; empty?: string }) {
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <h3 className="section-title">{title}</h3>
      {rows.length === 0 ? (
        <p className="small">{empty}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
