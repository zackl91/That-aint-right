'use client';
import { useActionState } from 'react';
import { generateForDate, type ActionState } from './actions';

export default function GenerateForm({ defaultDate }: { defaultDate: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(generateForDate, null);
  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="field">
          <label htmlFor="d">Date</label>
          <input id="d" name="date" type="date" defaultValue={defaultDate} required />
        </div>
        <label className="row" style={{ gap: 6 }}><input type="checkbox" name="publish" defaultChecked /> Publish</label>
        <label className="row" style={{ gap: 6 }}><input type="checkbox" name="replace" /> Replace if it exists</label>
        <button className="btn btn-ink btn-sm" type="submit" disabled={pending}>
          {pending ? 'BUILDING… (up to a minute)' : 'GENERATE'}
        </button>
      </div>
      {state && <p className={`notice ${state.ok ? 'ok' : 'err'}`} role="status">{state.message}</p>}
    </form>
  );
}
