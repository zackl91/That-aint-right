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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick `count` subjects, avoiding recently used queries and spreading across categories.
 * Returns extras beyond `count` so the pipeline has fallbacks if a subject fails.
 */
export function pickSubjects(count: number, recentlyUsed: Set<string>, extras = 4): Subject[] {
  const fresh = SUBJECTS.filter((s) => !recentlyUsed.has(s.query));
  const pool = shuffle(fresh.length >= count + extras ? fresh : SUBJECTS);
  const picked: Subject[] = [];
  const usedCats = new Set<string>();
  for (const s of pool) {
    if (picked.length >= count) break;
    if (!usedCats.has(s.category)) {
      picked.push(s);
      usedCats.add(s.category);
    }
  }
  for (const s of pool) {
    if (picked.length >= count + extras) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked;
}
