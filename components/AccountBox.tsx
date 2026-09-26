'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AccountBox({ email, isAnonymous }: { email: string | null; isAnonymous: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const redirect = `${window.location.origin}/auth/callback?next=/me`;
    const { error } = await supabase.auth.updateUser({ email: value.trim() }, { emailRedirectTo: redirect });
    setBusy(false);
    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        return setMsg({ ok: false, text: 'That email already has an account. Use "Sign in on this device" instead. Scores from this guest session will not carry over.' });
      }
      return setMsg({ ok: false, text: error.message });
    }
    setMsg({ ok: true, text: `Check ${value.trim()} for a confirmation link. Your score stays put.` });
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push('/');
    router.refresh();
  }

  if (isAnonymous) {
    return (
      <form className="card stack" onSubmit={saveEmail} style={{ gap: 14 }}>
        <h3 className="display" style={{ fontSize: 18 }}>Keep your shame forever</h3>
        <p className="small">You&rsquo;re playing as a guest. Add an email to keep your score if you clear your browser or switch devices.</p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={value} onChange={(e) => setValue(e.target.value)} autoComplete="email" />
        </div>
        {msg && <p className={`notice ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</p>}
        <button type="submit" className="btn btn-ink" disabled={busy} style={{ minHeight: 48, fontSize: 16 }}>
          {busy ? 'SENDING…' : 'SAVE MY ACCOUNT'}
        </button>
        <a href="/login" className="link-btn" style={{ alignSelf: 'center' }}>Already have an account? Sign in on this device</a>
      </form>
    );
  }

  return (
    <section className="card stack">
      <h3 className="display" style={{ fontSize: 18 }}>Account</h3>
      <p className="small">Signed in as {email}</p>
      <button type="button" className="btn btn-outline" onClick={signOut}>Sign out</button>
    </section>
  );
}
