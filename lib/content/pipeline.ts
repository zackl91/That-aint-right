import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { GENERIC_TELLS } from '@/lib/copy';
import { pickSubjects, type Subject } from './subjects';
import { pickPhoto, download } from './pexels';
import { generateImage, imageModel } from './replicate';
import { hasClaude, promptFromPhoto, findTell } from './claude';
import { normalize, upload } from './media';

export const ROUNDS_PER_DAY = 5;
type Log = (msg: string) => void;

type BuiltRound = {
  media_type: 'image';
  category: string;
  subject: string;
  source_query: string;
  a_url: string;
  b_url: string;
  real_side: 'A' | 'B';
  tell: string;
  real_credit: string;
  real_source_id: string;
  ai_prompt: string;
  ai_model: string;
};

async function recentlyUsed(db: SupabaseClient) {
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data, error } = await db.from('rounds').select('source_query, real_source_id').gte('created_at', since);
  if (error) throw new Error(`Could not read recent rounds: ${error.message}`);
  const { data: allIds } = await db.from('rounds').select('real_source_id');
  return {
    queries: new Set((data ?? []).map((r) => r.source_query).filter(Boolean) as string[]),
    sourceIds: new Set((allIds ?? []).map((r) => r.real_source_id).filter(Boolean) as string[]),
  };
}

function fallbackPrompt(alt: string, query: string) {
  const base = alt && alt.length > 12 ? alt : query;
  return (
    `${base}. Candid photograph taken on a phone, natural light, realistic colors, ` +
    'slight noise and imperfect framing, everyday setting.'
  );
}

/** Build one real-vs-AI pair from a subject. Throws on any failure so the caller can try another subject. */
export async function buildRound(db: SupabaseClient, subject: Subject, usedSourceIds: Set<string>, log: Log): Promise<BuiltRound> {
  const photo = await pickPhoto(subject.query, usedSourceIds);
  const sourceId = `pexels:${photo.id}`;
  usedSourceIds.add(sourceId);
  log(`  [${subject.category}] "${subject.query}" → Pexels ${photo.id} by ${photo.photographer}`);

  const realRaw = await download(photo.src.large2x);

  let prompt = fallbackPrompt(photo.alt, subject.query);
  let subjectLine = photo.alt?.toLowerCase() || subject.query;
  if (hasClaude()) {
    try {
      const p = await promptFromPhoto(realRaw, photo.alt, subject.query);
      prompt = p.prompt;
      subjectLine = p.subject;
    } catch (e) {
      log(`  prompt writer failed, using fallback: ${(e as Error).message}`);
    }
  }

  const aiRaw = await generateImage(prompt);

  let tell = GENERIC_TELLS[Math.floor(Math.random() * GENERIC_TELLS.length)];
  if (hasClaude()) {
    try {
      tell = await findTell(aiRaw, realRaw);
    } catch (e) {
      log(`  tell finder failed, using generic: ${(e as Error).message}`);
    }
  }

  const [realImg, aiImg] = await Promise.all([normalize(realRaw), normalize(aiRaw)]);
  const [realUrl, aiUrl] = await Promise.all([upload(db, realImg), upload(db, aiImg)]);
  const realSide: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';

  return {
    media_type: 'image',
    category: subject.category,
    subject: subjectLine.slice(0, 120),
    source_query: subject.query,
    a_url: realSide === 'A' ? realUrl : aiUrl,
    b_url: realSide === 'A' ? aiUrl : realUrl,
    real_side: realSide,
    tell,
    real_credit: `Photo by ${photo.photographer} on Pexels`,
    real_source_id: sourceId,
    ai_prompt: prompt,
    ai_model: imageModel(),
  };
}

/** Build `count` rounds in parallel, pulling from a shared queue of subjects so failures fall through to spares. */
async function buildRounds(db: SupabaseClient, count: number, log: Log): Promise<BuiltRound[]> {
  const recent = await recentlyUsed(db);
  const queue = pickSubjects(count, recent.queries, 5);
  const built: BuiltRound[] = [];

  async function worker() {
    while (built.length < count && queue.length > 0) {
      const subject = queue.shift()!;
      try {
        const r = await buildRound(db, subject, recent.sourceIds, log);
        if (built.length < count) built.push(r);
        return;
      } catch (e) {
        log(`  skipped "${subject.query}": ${(e as Error).message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: count }, worker));
  if (built.length < count) throw new Error(`Only built ${built.length} of ${count} rounds`);
  return built;
}

export type GenerateOptions = { publish?: boolean; replace?: boolean; rounds?: number; log?: Log };

export async function generatePuzzle(date: string, opts: GenerateOptions = {}) {
  const log = opts.log ?? (() => {});
  const count = opts.rounds ?? ROUNDS_PER_DAY;
  const db = createAdminClient();

  const { data: existing } = await db.from('puzzles').select('id, status').eq('puzzle_date', date).maybeSingle();
  if (existing && !opts.replace) {
    log(`${date}: already exists (${existing.status}), skipping`);
    return { date, status: 'exists' as const };
  }

  log(`${date}: building ${count} rounds`);
  const rounds = await buildRounds(db, count, log);

  if (existing) {
    const { error } = await db.from('puzzles').delete().eq('id', existing.id);
    if (error) throw new Error(`Could not replace existing puzzle: ${error.message}`);
  }

  const status = opts.publish ? 'published' : 'draft';
  const { data: puzzle, error: pErr } = await db
    .from('puzzles')
    .insert({ puzzle_date: date, status })
    .select('id')
    .single();
  if (pErr || !puzzle) throw new Error(`Could not create puzzle: ${pErr?.message}`);

  const { error: rErr } = await db
    .from('rounds')
    .insert(rounds.map((r, i) => ({ ...r, puzzle_id: puzzle.id, position: i + 1 })));
  if (rErr) throw new Error(`Could not save rounds: ${rErr.message}`);

  log(`${date}: saved as ${status}`);
  return { date, status: 'created' as const, puzzleId: puzzle.id };
}

/** Swap one round for a fresh pair. Clears any answers already given for it. */
export async function regenerateRound(roundId: string, log: Log = () => {}) {
  const db = createAdminClient();
  const { data: round, error } = await db.from('rounds').select('id, puzzle_id, position').eq('id', roundId).single();
  if (error || !round) throw new Error('Round not found');
  const [fresh] = await buildRounds(db, 1, log);
  await db.from('answers').delete().eq('round_id', roundId);
  const { error: uErr } = await db.from('rounds').update(fresh).eq('id', roundId);
  if (uErr) throw new Error(`Could not update round: ${uErr.message}`);
}
