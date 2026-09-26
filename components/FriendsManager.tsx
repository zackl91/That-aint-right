'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { FriendRow } from '@/lib/types';
import { pts, initials, toE164 } from '@/lib/format';

export default function FriendsManager({ inviteCode, friends }: { inviteCode: string | null; friends: FriendRow[] }) {
  const router = useRouter();
  const [origin, setOrigin] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);
  const link = inviteCode && origin ? `${origin}/invite/${inviteCode}` : '';

  async function share() {
    if (!link) return;
    const text = "I keep getting fooled by AI pictures. Come be worse than me.";
    try {
      if (navigator.share) return await navigator.share({ text, url: link });
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* cancelled */
    }
  }

  async function addByPhone(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const e164 = toE164(phone);
    if (!e164) return setMsg({ ok: false, text: 'Enter a 10-digit US number, or include the country code with +.' });
    setBusy(true);
    const { data, error } = await createClient().rpc('add_friend_by_phone', { p_phone: e164 });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    if (!data) return setMsg({ ok: false, text: 'Nobody has that number on their profile yet. Send them your invite link instead.' });
    setMsg({ ok: true, text: `Added ${(data as { display_name: string }).display_name}.` });
    setPhone('');
    router.refresh();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove ${name}? They can still be terrible, just not where you can see it.`)) return;
    await createClient().rpc('remove_friend', { p_friend: id });
    router.refresh();
  }

  return (
    <>
      <section className="card-ink" style={{ gap: 12 }}>
        <h2 className="display" style={{ fontSize: 20 }}>Your invite link</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--dark-muted)' }}>Anyone who opens it becomes your friend here. It works for people who haven&rsquo;t played yet.</p>
        <code style={{ fontFamily: 'var(--mono)', fontSize: 13, wordBreak: 'break-all', color: 'var(--paper)' }}>{link || 'Loading…'}</code>
        <button type="button" className="btn btn-shame" onClick={share} disabled={!link}>{copied ? 'COPIED' : 'SHARE INVITE LINK'}</button>
      </section>

      <form className="card stack" onSubmit={addByPhone} style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="friend-phone">Add by phone number</label>
          <input id="friend-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" required />
          <span className="hint">Works if they&rsquo;ve added their number on their profile.</span>
        </div>
        {msg && <p className={`notice ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</p>}
        <button type="submit" className="btn btn-ink" disabled={busy} style={{ minHeight: 48, fontSize: 16 }}>ADD FRIEND</button>
      </form>

      <section className="stack">
        <h2 className="section-title">YOUR FRIENDS ({friends.length})</h2>
        {friends.length === 0 ? (
          <p className="small">None yet. Everyone&rsquo;s better at this with an audience.</p>
        ) : (
          <ul className="board">
            {friends.map((f) => (
              <li key={f.user_id}>
                <span className="avatar">{initials(f.display_name)}</span>
                <span className="who">
                  <span className="name" style={{ display: 'block' }}>{f.display_name}</span>
                  <span className="meta">{f.rounds} rounds{f.today_answered ? ` · ${pts(-100 * f.today_fooled)} today` : ''}</span>
                </span>
                <span className="val">{pts(f.points)}</span>
                <button type="button" className="icon-btn" style={{ width: 36, height: 36, borderWidth: 1.5 }} aria-label={`Remove ${f.display_name}`} onClick={() => remove(f.user_id, f.display_name)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
