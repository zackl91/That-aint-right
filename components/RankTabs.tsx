'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { BoardRow } from '@/lib/types';
import { pts, initials } from '@/lib/format';

type Board = 'friends' | 'global' | 'worst';
const LABELS: Record<Board, string> = { friends: 'Friends', global: 'Global', worst: 'Worst %' };
const BLURBS: Record<Board, string> = {
  friends: 'You and the people you added. Most points lost wins, sadly.',
  global: 'Everyone, all time, by total points lost.',
  worst: 'Share of picks that were AI. Minimum 20 rounds, so no hiding.',
};

export default function RankTabs({ start, boards }: { start: Board; boards: Record<Board, BoardRow[]> }) {
  const [tab, setTab] = useState<Board>(start);
  const rows = boards[tab];
  const onlyMe = tab === 'friends' && rows.length <= 1;

  return (
    <>
      <div className="segmented" role="group" aria-label="Leaderboard">
        {(Object.keys(LABELS) as Board[]).map((b) => (
          <button key={b} type="button" aria-pressed={b === tab} onClick={() => setTab(b)}>
            {LABELS[b]}
          </button>
        ))}
      </div>
      <div className="row between" style={{ minHeight: 44 }}>
        <p className="small" style={{ color: 'var(--muted-2)' }}>{BLURBS[tab]}</p>
        {tab === 'friends' && <Link href="/friends" className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>Add friends</Link>}
      </div>

      {rows.length === 0 ? (
        <p className="empty">
          {tab === 'worst' ? 'Nobody has played 20 rounds yet. Be the first to be terrible at scale.' : 'Nobody has played yet. Go set the bar low.'}
        </p>
      ) : (
        <ol className="board">
          {rows.map((r, i) => {
            const prev = rows[i - 1];
            const gap = prev && r.rank - prev.rank > 1 && r.is_me;
            return (
              <FragmentRow key={r.user_id} gap={Boolean(gap)} row={r} worst={tab === 'worst'} />
            );
          })}
        </ol>
      )}
      {onlyMe && <p className="empty">It&rsquo;s just you here. Send your invite link and find out who&rsquo;s worse.</p>}
    </>
  );
}

function FragmentRow({ row, gap, worst }: { row: BoardRow; gap: boolean; worst: boolean }) {
  return (
    <>
      {gap && <li className="gap" aria-hidden="true">···</li>}
      <li className={row.is_me ? 'me' : undefined}>
        <span className="rank">#{row.rank}</span>
        <span className="avatar">{initials(row.display_name)}</span>
        <span className="who">
          <span className="name" style={{ display: 'block' }}>{row.is_me ? `${row.display_name} (you)` : row.display_name}</span>
          <span className="meta">
            {worst ? `fooled ${row.fooled} of ${row.rounds}` : `${row.rounds} rounds · ${row.pct}% fooled`}
          </span>
        </span>
        <span className="val">{worst ? `${row.pct}%` : pts(row.points)}</span>
      </li>
    </>
  );
}
