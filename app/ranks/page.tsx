import { createClient } from '@/lib/supabase/server';
import type { BoardRow } from '@/lib/types';
import TabBar from '@/components/TabBar';
import RankTabs from '@/components/RankTabs';

export const dynamic = 'force-dynamic';

export default async function Ranks({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const [friends, global, worst] = await Promise.all([
    supabase.rpc('leaderboard', { p_board: 'friends', p_limit: 50 }),
    supabase.rpc('leaderboard', { p_board: 'global', p_limit: 25 }),
    supabase.rpc('leaderboard', { p_board: 'worst', p_limit: 25 }),
  ]);
  const start = tab === 'global' || tab === 'worst' ? tab : 'friends';

  return (
    <>
      <main className="screen" style={{ gap: 14 }}>
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="display h1">Rankings</h1>
          <p className="lede">The least gullible people you know. Allegedly.</p>
        </div>
        <RankTabs
          start={start}
          boards={{
            friends: (friends.data as BoardRow[] | null) ?? [],
            global: (global.data as BoardRow[] | null) ?? [],
            worst: (worst.data as BoardRow[] | null) ?? [],
          }}
        />
      </main>
      <TabBar active="ranks" />
    </>
  );
}
