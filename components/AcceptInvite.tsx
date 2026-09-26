'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AcceptInvite({ code, name }: { code: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setBusy(false);
        return setErr('Could not start a session. Try again in a moment.');
      }
    }
    const { error } = await supabase.rpc('add_friend_by_code', { p_code: code });
    if (error) {
      setBusy(false);
      return setErr(error.message);
    }
    document.cookie = 'tar_welcomed=1; path=/; max-age=63072000; samesite=lax';
    router.push('/');
    router.refresh();
  }

  return (
    <div className="stack">
      <button type="button" className="btn btn-shame" onClick={accept} disabled={busy}>
        {busy ? 'ADDING…' : `ADD ${name.toUpperCase()} AND PLAY`}
      </button>
      {err && <p className="notice err" role="alert">{err}</p>}
    </div>
  );
}
