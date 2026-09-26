// Search queries for real photos. Each one should be something AI can fake
// convincingly and that Pexels has plenty of real photos for.
// No identifiable people, violence, or anything you wouldn't show a group chat.

export type Subject = { category: string; query: string };

const BANK: Record<string, string[]> = {
  Pets: [
    'dog catching frisbee', 'cat sleeping in sunlight', 'puppy in grass', 'cat on windowsill',
    'dog at the beach', 'golden retriever portrait', 'kitten playing', 'dog in snow',
    'parrot close up', 'hamster eating', 'rabbit in garden', 'dog wearing sweater',
  ],
  Wildlife: [
    'owl on branch', 'fox in snow', 'deer in forest', 'hummingbird feeding', 'elephant walking',
    'sea turtle swimming', 'squirrel eating nut', 'flamingo standing', 'butterfly on flower',
    'bee on flower macro', 'penguin colony', 'horse in field',
  ],
  Food: [
    'croissant on plate', 'pizza slice', 'bowl of ramen', 'stack of pancakes', 'sushi platter',
    'burger and fries', 'fresh bread loaf', 'cup of latte art', 'strawberries in bowl',
    'chocolate cake slice', 'tacos on plate', 'salad bowl overhead', 'donuts in box', 'grilled steak',
  ],
  Landscapes: [
    'mountain lake sunrise', 'desert sand dunes', 'waterfall in forest', 'foggy forest', 'beach at sunset',
    'snowy mountains', 'rolling green hills', 'canyon view', 'autumn trees road', 'lighthouse coast',
    'northern lights', 'lavender field',
  ],
  Architecture: [
    'old church interior', 'modern glass building', 'colorful houses street', 'spiral staircase',
    'bridge at night', 'cozy cabin', 'library interior', 'train station interior', 'barn in field',
    'european alley', 'skyscraper looking up',
  ],
  Objects: [
    'vintage camera on table', 'coffee mug on desk', 'stack of books', 'bicycle against wall',
    'old typewriter', 'houseplant in pot', 'candles burning', 'sneakers on floor', 'guitar on couch',
    'keys on table', 'umbrella in rain', 'vinyl record player',
  ],
  Streets: [
    'rainy city street night', 'neon signs street', 'food truck', 'farmers market stall',
    'vintage car parked', 'city crosswalk from above', 'cafe exterior', 'subway platform',
    'street lamp fog', 'bicycle parked street',
  ],
  Plants: [
    'succulent close up', 'sunflower field', 'mushrooms on forest floor', 'cactus desert',
    'cherry blossom branch', 'fern leaves', 'rose with water drops', 'tulip field', 'moss on rock',
  ],
};

export const SUBJECTS: Subject[] = Object.entries(BANK).flatMap(([category, queries]) =>
  queries.map((query) => ({ category, query })),
);

export type Steering = {
  /** category -> weight (1 = neutral). Higher = picked more often. */
  categoryWeights: Map<string, number>;
  /** queries that almost never fool anyone; skipped */
  retired: Set<string>;
};

export const NEUTRAL: Steering = { categoryWeights: new Map(), retired: new Set() };

type Stat = { category: string; source_query: string | null; answers: number; fooled: number };

/**
 * Turn past results into weights. Target: pairs that fool about half of players.
 * Categories need 30+ answers before they're weighted; queries need 20+ before retiring.
 */
export function steeringFrom(stats: Stat[]): Steering {
  const byCat = new Map<string, { a: number; f: number }>();
  const retired = new Set<string>();
  for (const s of stats) {
    const c = byCat.get(s.category) ?? { a: 0, f: 0 };
    c.a += s.answers;
    c.f += s.fooled;
    byCat.set(s.category, c);
    if (s.source_query && s.answers >= 20 && s.fooled / s.answers < 0.1) retired.add(s.source_query);
  }
  const categoryWeights = new Map<string, number>();
  for (const [cat, { a, f }] of byCat) {
    if (a < 30) continue;
    const rate = f / a;
    categoryWeights.set(cat, Math.max(0.2, 1.3 - Math.abs(rate - 0.5) * 2));
  }
  return { categoryWeights, retired };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Weighted order without replacement (Efraimidis–Spirakis). */
function weightedOrder<T>(items: T[], weight: (t: T) => number): T[] {
  return items
    .map((it) => ({ it, key: Math.pow(Math.random(), 1 / Math.max(weight(it), 0.01)) }))
    .sort((x, y) => y.key - x.key)
    .map((x) => x.it);
}

/**
 * Pick `count` subjects: one per category where possible, categories chosen by
 * weight, avoiding recently used and retired queries. Returns `extras` spares.
 */
export function pickSubjects(count: number, recentlyUsed: Set<string>, extras = 4, steering: Steering = NEUTRAL): Subject[] {
  const usable = SUBJECTS.filter((s) => !steering.retired.has(s.query));
  const fresh = usable.filter((s) => !recentlyUsed.has(s.query));
  const pool = fresh.length >= count + extras ? fresh : usable.length >= count + extras ? usable : SUBJECTS;

  const cats = weightedOrder([...new Set(pool.map((s) => s.category))], (c) => steering.categoryWeights.get(c) ?? 1);
  const byCat = new Map(cats.map((c) => [c, shuffle(pool.filter((s) => s.category === c))]));

  const picked: Subject[] = [];
  // round-robin through categories in weighted order until we have enough
  while (picked.length < count + extras) {
    let added = false;
    for (const c of cats) {
      const next = byCat.get(c)!.shift();
      if (next) {
        picked.push(next);
        added = true;
        if (picked.length >= count + extras) break;
      }
    }
    if (!added) break;
  }
  return picked;
}
