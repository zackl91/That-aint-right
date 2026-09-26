import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { addDays, todayISO, puzzleNumber, formatLong } from '@/lib/dates';
import { requireAdmin, setStatus, deletePuzzle, swapSides, regenerate } from './actions';
import GenerateForm from './GenerateForm';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type AdminRound = {
  id: string; position: number; category: string; subject: string; a_url: string; b_url: string;
  real_side: 'A' | 'B'; tell: string | null; real_credit: string | null; ai_prompt: string | null;
};
type AdminPuzzle = { id: string; puzzle_date: string; status: string; rounds: AdminRound[] };

export default async function Admin() {
  try {
    await requireAdmin();
  } catch {
    return (
      <main className="screen no-tabs" style={{ justifyContent: 'center' }}>
        <h1 className="display h1">Admins only.</h1>
        <p className="lede">Sign in with an email listed in ADMIN_EMAILS.</p>
        <Link href="/login" className="btn btn-ink">SIGN IN</Link>
      </main>
    );
  }

  const today = todayISO();
  const from = addDays(today, -7);
  const to = addDays(today, 14);
  const { data } = await createAdminClient()
    .from('puzzles')
    .select('id, puzzle_date, status, rounds(id, position, category, subject, a_url, b_url, real_side, tell, real_credit, ai_prompt)')
    .gte('puzzle_date', from)
    .lte('puzzle_date', to)
    .order('puzzle_date', { ascending: false });
  const puzzles = (data as AdminPuzzle[] | null) ?? [];
  const have = new Set(puzzles.map((p) => p.puzzle_date));
  const missing = Array.from({ length: 15 }, (_, i) => addDays(today, i)).filter((d) => !have.has(d));

  return (
    <main className="admin">
      <div className="row between">
        <h1 className="display h1">Content desk</h1>
        <Link href="/" className="btn btn-outline btn-sm">Back to game</Link>
      </div>
      <p className="lede">Green border = real, red = AI. Swapping or regenerating a round clears any answers already given for it.</p>

      <section className="card stack">
        <h2 className="display h2">Build a day</h2>
        {missing.length > 0 && <p className="small">Missing in the next two weeks: {missing.map(formatLong).join(', ')}</p>}
        <GenerateForm defaultDate={missing[0] ?? addDays(today, 1)} />
      </section>

      {puzzles.map((p) => (
        <section key={p.id} className="card stack" style={{ gap: 14 }}>
          <div className="row between" style={{ flexWrap: 'wrap' }}>
            <h2 className="display h2">
              #{puzzleNumber(p.puzzle_date)} · {formatLong(p.puzzle_date)} {p.puzzle_date === today && '(today)'}
            </h2>
            <div className="row" style={{ gap: 8 }}>
              <span className={`tag${p.status === 'published' ? '' : ' shame'}`}>{p.status.toUpperCase()}</span>
              <form action={setStatus}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="status" value={p.status === 'published' ? 'draft' : 'published'} />
                <button className="btn btn-outline btn-sm" type="submit">{p.status === 'published' ? 'Unpublish' : 'Publish'}</button>
              </form>
              <form action={deletePuzzle}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn btn-outline btn-sm" type="submit">Delete</button>
              </form>
            </div>
          </div>
          <div className="admin-rounds">
            {[...p.rounds].sort((a, b) => a.position - b.position).map((r) => (
              <div key={r.id} className="stack" style={{ gap: 6 }}>
                <strong style={{ fontSize: 14 }}>{r.position}. {r.category}: {r.subject}</strong>
                <div className="admin-pair">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.a_url} alt={`A (${r.real_side === 'A' ? 'real' : 'AI'})`} className={r.real_side === 'A' ? 'real' : 'fake'} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.b_url} alt={`B (${r.real_side === 'B' ? 'real' : 'AI'})`} className={r.real_side === 'B' ? 'real' : 'fake'} />
                </div>
                {r.tell && <p className="small">Tell: {r.tell}</p>}
                <details className="small"><summary>Prompt and credit</summary><p>{r.ai_prompt}</p><p>{r.real_credit}</p></details>
                <div className="row" style={{ gap: 8 }}>
                  <form action={swapSides}><input type="hidden" name="id" value={r.id} /><button className="btn btn-outline btn-sm" type="submit">Swap A/B</button></form>
                  <form action={regenerate}><input type="hidden" name="id" value={r.id} /><button className="btn btn-outline btn-sm" type="submit">Regenerate</button></form>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
