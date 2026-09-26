'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generatePuzzle, regenerateRound } from '@/lib/content/pipeline';
import { isValidISODate } from '@/lib/dates';

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const allowed = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!user || user.is_anonymous || !user.email || !allowed.includes(user.email.toLowerCase())) {
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
  await regenerateRound(String(formData.get('id')));
  revalidatePath('/admin');
}

export async function generateForDate(formData: FormData) {
  await requireAdmin();
  const date = String(formData.get('date'));
  if (!isValidISODate(date)) throw new Error('Bad date');
  await generatePuzzle(date, { publish: formData.get('publish') === 'on', replace: formData.get('replace') === 'on' });
  revalidatePath('/admin');
}
