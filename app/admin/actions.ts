'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generatePuzzle, regenerateRound } from '@/lib/content/pipeline';
import { isValidISODate } from '@/lib/dates';
import { isAdminEmail } from '@/lib/admin';

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !isAdminEmail(user.email)) {
    throw new Error('Not allowed');
  }
  return user;
}

export async function setStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id'));
  const status = formData.get('status') === 'published' ? 'published' : 'draft';
  await createAdminClient().from('puzzles').update({ status }).eq('id', id);
  revalidatePath('/admin');
}

export async function deletePuzzle(formData: FormData) {
  await requireAdmin();
  await createAdminClient().from('puzzles').delete().eq('id', String(formData.get('id')));
  revalidatePath('/admin');
}

export async function swapSides(formData: FormData) {
  await requireAdmin();
  const db = createAdminClient();
  const id = String(formData.get('id'));
  const { data: r } = await db.from('rounds').select('a_url, b_url, real_side').eq('id', id).single();
  if (!r) return;
  await db.from('answers').delete().eq('round_id', id);
  await db.from('rounds').update({ a_url: r.b_url, b_url: r.a_url, real_side: r.real_side === 'A' ? 'B' : 'A' }).eq('id', id);
  revalidatePath('/admin');
}

export async function regenerate(formData: FormData) {
  await requireAdmin();
  try {
    await regenerateRound(String(formData.get('id')));
  } catch (e) {
    console.error('Regenerate failed:', (e as Error).message);
  }
  revalidatePath('/admin');
}

export type ActionState = { ok: boolean; message: string } | null;

export async function generateForDate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const date = String(formData.get('date'));
    if (!isValidISODate(date)) return { ok: false, message: 'Pick a valid date.' };
    const logs: string[] = [];
    const res = await generatePuzzle(date, {
      publish: formData.get('publish') === 'on',
      replace: formData.get('replace') === 'on',
      log: (m) => logs.push(m),
    });
    revalidatePath('/admin');
    return res.status === 'exists'
      ? { ok: false, message: `${date} already exists. Tick "Replace if it exists" to rebuild it.` }
      : { ok: true, message: `Built ${date}.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
