import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AcceptInvite from '@/components/AcceptInvite';

export const dynamic = 'force-dynamic';

export default async function Invite({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const [{ data: info }, { data: { user } }] = await Promise.all([
    supabase.rpc('invite_info', { p_code: code }),
    supabase.auth.getUser(),
  ]);
  const inviter = info as { user_id: string; display_name: string } | null;

  return (
    <main className="screen no-tabs" style={{ justifyContent: 'center', gap: 20 }}>
      <p className="kicker">YOU&rsquo;VE BEEN INVITED</p>
      {inviter ? (
        <>
          <h1 className="display" style={{ fontSize: 40, lineHeight: 0.98 }}>{inviter.display_name} wants you to get fooled too.</h1>
          <p className="lede" style={{ fontSize: 17 }}>
            Every day there are two photos: one real, one AI. Pick the real one. Lose 100 points each time you don&rsquo;t.
            Friends see each other&rsquo;s scores.
          </p>
          {user?.id === inviter.user_id ? (
            <p className="notice ok">This is your own invite link. Send it to someone else.</p>
          ) : (
            <AcceptInvite code={code} name={inviter.display_name} />
          )}
        </>
      ) : (
        <>
          <h1 className="display h1">That invite link doesn&rsquo;t work.</h1>
          <p className="lede">Ask your friend to send it again, or add them by phone number.</p>
          <Link href="/" className="btn btn-ink">PLAY ANYWAY</Link>
        </>
      )}
    </main>
  );
}
