'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toE164 } from '@/lib/format';

type Initial = { display_name: string; handle: string | null; phone: string | null };

export default function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.display_name);
  const [handle, setHandle] = useState(initial.handle ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const cleanHandle = handle.trim().toLowerCase().replace(/^@/, '');
    if (name.trim().length < 2 || name.trim().length > 40) return setMsg({ ok: false, text: 'Display name needs 2 to 40 characters.' });
    if (cleanHandle && !/^[a-z0-9_]{3,20}$/.test(cleanHandle)) return setMsg({ ok: false, text: 'Handles use 3 to 20 lowercase letters, numbers or underscores.' });
    const e164 = phone.trim() ? toE164(phone) : null;
    if (phone.trim() && !e164) return setMsg({ ok: false, text: 'Enter a 10-digit US number, or include the country code with +.' });

    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim(), handle: cleanHandle || null, phone_e164: e164 })
      .eq('id', user!.id);
    setBusy(false);
    if (error) {
      const text = error.message.includes('handle') ? 'That handle is taken.'
        : error.message.includes('phone') ? 'That number is already on another account.'
        : error.message;
      return setMsg({ ok: false, text });
    }
    setMsg({ ok: true, text: 'Saved.' });
    router.refresh();
  }

  return (
    <form className="card stack" onSubmit={save} style={{ gap: 14 }}>
      <h3 className="display" style={{ fontSize: 18 }}>Your details</h3>
      <div className="field">
        <label htmlFor="name">Display name</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="nickname" />
        <span className="hint">This is what the Wall of Shame shows.</span>
      </div>
      <div className="field">
        <label htmlFor="handle">Handle</label>
        <input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="yourname" autoCapitalize="none" />
      </div>
      <div className="field">
        <label htmlFor="phone">Phone number</label>
        <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" autoComplete="tel" />
        <span className="hint">Optional. Lets friends add you by number. Never shown to anyone.</span>
      </div>
      {msg && <p className={`notice ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</p>}
      <button type="submit" className="btn btn-ink" disabled={busy} style={{ minHeight: 48, fontSize: 16 }}>
        {busy ? 'SAVING…' : 'SAVE DETAILS'}
      </button>
    </form>
  );
}
