'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Creates a guest account on demand (e.g. to get an invite link before playing). */
export default function StartSession({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function start() {
    setBusy(true);
    const { error } = await createClient().auth.signInAnonymously();
    setBusy(false);
    if (error) return setErr('Could not start a session. Try again.');
    router.refresh();
  }
  return (
    <div className="stack">
      <button type="button" className="btn btn-shame" onClick={start} disabled={busy}>{busy ? 'ONE SEC…' : label}</button>
      {err && <p className="notice err" role="alert">{err}</p>}
    </div>
  );
}
