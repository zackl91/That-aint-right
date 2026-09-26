import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { GENERIC_TELLS } from '@/lib/copy';
import { pickSubjects, steeringFrom, NEUTRAL, type Subject, type Steering } from './subjects';
import { pickPhoto, download } from './pexels';
import { generateImage, imageModel, bossModel } from './replicate';
import { hasClaude, promptFromPhoto, findTell } from './claude';
import { normalize, upload, randomLook } from './media';

export const ROUNDS_PER_DAY = 5;
type Log = (msg: string) => void;
type Difficulty = 'normal' | 'boss';

type BuiltRound = {
  media_type: 'image';
  difficulty: Difficulty;
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

/** Real-camera flaws to nudge the fake toward. Claude picks the ones that fit. */
const FLAWS = [
  'slight motion blur', 'a little out of focus in the foreground', 'blown-out highlights in the sky',
  'crushed shadows', 'a slightly crooked horizon', 'harsh midday light', 'mixed indoor lighting with a warm cast',
  'visible sensor noise from low light', 'mild lens distortion at the edges', 'a busy, ordinary background',
  'subject not perfectly centered', 'faint chromatic aberration on high-contrast edges', 'dust or smudges on the lens',
  'uneven, patchy lighting', 'a bit of haze',
];

function pickFlaws(n = 4): string[] {
  return [...FLAWS].sort(() => Math.random() - 0.5).slice(0, n);
}

async function recentlyUsed(db: SupabaseClient) {
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data, error } = await db.from('rounds').select('source_query').gte('created_at', since);
  if (error) throw new Error(`Could not read recent rounds: ${error.message}`);
  const { data: allIds } = await db.from('rounds').select('real_source_id');
  return {
    queries: new Set((data ?? []).map((r) => r.source_query).filter(Boolean) as string[]),
    sourceIds: new Set((allIds ?? []).map((r) => r.real_source_id).filter(Boolean) as string[]),
  };
}

/** Weights from past results. Falls back to neutral if the stats function isn't installed yet. */
async function loadSteering(db: SupabaseClient, log: Log): Promise<Steering> {
  const { data, error } = await db.rpc('content_stats', { p_days: 120 });
  if (error) {
    log(`  steering unavailable (${error.message}); picking subjects evenly`);
    return NEUTRAL;
  }
  const steering = steeringFrom(data ?? []);
  if (steering.categoryWeights.size || steering.retired.size) {
    const w = [...steering.categoryWeights].map(([c, v]) => `${c}=${v.toFixed(2)}`).join(', ');
    log(`  steering: ${w || 'not enough data yet'}${steering.retired.size ? `; retired ${steering.retired.size} too-easy subjects` : ''}`);
  }
  return steering;
}

function fallbackPrompt(alt: string, query: string, flaws: string[]) {
  const base = alt && alt.length > 12 ? alt : query;
  return `${base}. Ordinary photo taken on an iPhone, ${flaws.slice(0, 2).join(', ')}, natural colors, everyday setting.`;
}

/** Build one real-vs-AI pair. Throws on any failure so the caller can try another subject. */
export async function buildRound(
  db: SupabaseClient, subject: Subject, usedSourceIds: Set<string>, difficulty: Difficulty, log: Log,
): Promise<BuiltRound> {
  const photo = await pickPhoto(subject.query, usedSourceIds);
  const sourceId = `pexels:${photo.id}`;
  usedSourceIds.add(sourceId);
  const model = difficulty === 'boss' ? bossModel() : imageModel();
  log(`  [${difficulty}] [${subject.category}] "${subject.query}" → Pexels ${photo.id} by ${photo.photographer}`);

  const realRaw = await download(photo.src.large2x);
  const flaws = pickFlaws();

  let prompt = fallbackPrompt(photo.alt, subject.query, flaws);
  let subjectLine = photo.alt?.toLowerCase() || subject.query;
  if (hasClaude()) {
    try {
      const p = await promptFromPhoto(realRaw, photo.alt, subject.query, flaws);
      prompt = p.prompt;
      subjectLine = p.subject;
    } catch (e) {
      log(`  prompt writer failed, using fallback: ${(e as Error).message}`);
    }
  }

  const aiRaw = await generateImage(prompt, model);

  let tell = GENERIC_TELLS[Math.floor(Math.random() * GENERIC_TELLS.length)];
  if (hasClaude()) {
    try {
      tell = await findTell(aiRaw, realRaw);
    } catch (e) {
      log(`  tell finder failed, using generic: ${(e as Error).message}`);
    }
  }

  const look = randomLook();
  const [realImg, aiImg] = await Promise.all([normalize(realRaw, look), normalize(aiRaw, look)]);
  const [realUrl, aiUrl] = await Promise.all([upload(db, realImg), upload(db, aiImg)]);
  const realSide: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';

  return {
    media_type: 'image',
    difficulty,
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
    ai_model: model,
  };
}

/**
 * Build one round per slot, in parallel. Each slot pulls subjects from a shared
 * queue, so a failed subject falls through to a spare. Results keep slot order.
 */
async function buildSlots(db: SupabaseClient, slots: Difficulty[], log: Log): Promise<BuiltRound[]> {
  const recent = await recentlyUsed(db);
  const steering = await loadSteering(db, log);
  const queue = pickSubjects(slots.length, recent.queries, 5, steering);
  const built: (BuiltRound | undefined)[] = new Array(slots.length);
  const failures: string[] = [];

  await Promise.all(
    slots.map(async (difficulty, i) => {
      while (queue.length > 0) {
        const subject = queue.shift()!;
        try {
          built[i] = await buildRound(db, subject, recent.sourceIds, difficulty, log);
          return;
        } catch (e) {
          const msg = (e as Error).message;
          failures.push(msg);
          log(`  skipped "${subject.query}": ${msg}`);
        }
      }
    }),
  );

  const done = built.filter(Boolean) as BuiltRound[];
  if (done.length < slots.length) {
    const reasons = [...new Set(failures)].slice(0, 3).join(' | ');
    throw new Error(`Only built ${done.length} of ${slots.length} rounds. ${reasons ? 'Reasons: ' + reasons : ''}`);
  }
  return done;
}

/** Normal rounds, with the last one as the boss round. */
function dailySlots(count: number): Difficulty[] {
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? 'boss' : 'normal'));
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

  log(`${date}: building ${count} rounds (last one is the boss round)`);
  const rounds = await buildSlots(db, dailySlots(count), log);

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
  if (rErr) {
    await db.from('puzzles').delete().eq('id', puzzle.id);
    throw new Error(`Could not save rounds: ${rErr.message}`);
  }

  log(`${date}: saved as ${status}`);
  return { date, status: 'created' as const, puzzleId: puzzle.id };
}

/** Swap one round for a fresh pair at the same difficulty. Clears any answers already given for it. */
export async function regenerateRound(roundId: string, log: Log = () => {}) {
  const db = createAdminClient();
  const { data: round, error } = await db.from('rounds').select('id, difficulty').eq('id', roundId).single();
  if (error || !round) throw new Error('Round not found');
  const [fresh] = await buildSlots(db, [(round.difficulty as Difficulty) ?? 'normal'], log);
  await db.from('answers').delete().eq('round_id', roundId);
  const { error: uErr } = await db.from('rounds').update(fresh).eq('id', roundId);
  if (uErr) throw new Error(`Could not update round: ${uErr.message}`);
}
