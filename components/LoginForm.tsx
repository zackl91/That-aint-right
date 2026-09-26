'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setSent(true);
  }

  if (sent) return <p className="notice ok" role="status">Link sent to {email}. Open it on this device.</p>;

  return (
    <form className="stack" onSubmit={submit} style={{ gap: 12 }}>
      <div className="field">
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      {err && <p className="notice err" role="alert">{err}</p>}
      <button type="submit" className="btn btn-ink" disabled={busy}>{busy ? 'SENDING…' : 'EMAIL ME A LINK'}</button>
    </form>
  );
}
