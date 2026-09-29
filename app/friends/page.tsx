import { createClient } from '@/lib/supabase/server';
import type { FriendRow } from '@/lib/types';
import TabBar from '@/components/TabBar';
import FriendsManager from '@/components/FriendsManager';
import StartSession from '@/components/StartSession';

export const dynamic = 'force-dynamic';

export default async function Friends() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: friends }] = await Promise.all([
    user ? supabase.from('profiles').select('invite_code').eq('id', user.id).single() : Promise.resolve({ data: null }),
    supabase.rpc('my_friends'),
  ]);

  return (
    <>
      <main className="screen">
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="display h1">Friends</h1>
          <p className="lede">Add people so you can watch them get fooled in real time.</p>
        </div>
        {user ? (
          <FriendsManager inviteCode={profile?.invite_code ?? null} friends={(friends as FriendRow[] | null) ?? []} />
        ) : (
          <StartSession label="GET MY INVITE LINK" />
        )}
      </main>
      <TabBar active="ranks" />
    </>
  );
}
