// Every roast, backhanded compliment and shame title lives here so it's easy to punch up.

export const FOOLED_ROASTS = [
  'You just got catfished by a graphics card.',
  'A computer made that in four seconds and you fell for it in one.',
  "Somewhere, a GPU is laughing at you. It doesn't even have a face.",
  'Your grandma would have caught that. Your grandma thinks the cloud is weather.',
  'That picture has never existed and you vouched for it.',
  'Congratulations, you are the target demographic for scam emails.',
  'Bold of you to trust your eyes.',
  "The robot didn't even try that hard.",
  "That's the kind of confidence that buys timeshares.",
  'You picked it like you meant it. That makes it worse.',
  'Please never become a juror.',
  "If that one fooled you, we need to talk about what's in your group chat.",
  'The AI would like to thank you for your support.',
  'Somebody check on this person. They believe everything.',
  'That was a coin flip and you lost to a computer anyway.',
  "You'd lose a staring contest with a JPEG.",
  'Filed under: reasons you should not be allowed on Facebook.',
  'Even the pixels were embarrassed for you.',
];

export const CORRECT_LINES = [
  'Fine. Even a broken clock is right twice a day.',
  'Correct. Congratulations on the bare minimum.',
  'You got one. Try not to make it your personality.',
  "Sure. Let's pretend that wasn't a guess.",
  'Right answer. Zero points. Still the best possible outcome for you.',
  'Nice. The robots will get you next round.',
  'Correct, but we saw you hesitate.',
  "You live to be embarrassed another round.",
  'Good job not believing a computer. This time.',
  "Correct. Don't let it go to your head, there's nothing up there to catch it.",
  'Nailed it. Statistically, this was bound to happen.',
];

export const GENERIC_TELLS = [
  'Look closer at the edges. AI loves to melt things into each other.',
  'Texture that smooth only exists in video games and AI images.',
  'Light coming from two directions at once is a classic giveaway.',
  'Background details that turn to mush are the AI tripping over its own feet.',
  'Real photos have boring, random clutter. AI makes everything a little too tidy.',
];

export function verdict(fooled: number, total: number): string {
  if (total === 0) return 'Not played yet';
  const r = fooled / total;
  if (fooled === 0) return 'Suspiciously competent. Are you a robot?';
  if (r <= 0.2) return 'Mostly human';
  if (r <= 0.4) return 'Mildly gullible';
  if (r <= 0.6) return 'Certified gullible';
  if (r < 1) return 'Chronically online, somehow still fooled';
  return 'Would wire money to a deepfake';
}

/** Compare to a coin flip, which loses 50 per round on average. */
export function coinLine(fooled: number, total: number): string {
  const you = -100 * fooled;
  const coin = -50 * total;
  if (you < coin) return `A coin flip averages ${fmt(coin)}. You scored ${fmt(you)}. The coin would like a word.`;
  if (you === coin) return `You scored exactly as well as a coin flip. The coin is honestly a little offended.`;
  if (fooled === 0) return `A coin flip averages ${fmt(coin)}. You scored 0. We're keeping an eye on you.`;
  return `A coin flip averages ${fmt(coin)}. You beat it. Barely a flex, but we'll allow it.`;
}

function fmt(n: number) {
  return n === 0 ? '0' : '\u2212' + Math.abs(n).toLocaleString('en-US');
}

export const PODIUM_TITLES = [
  'Would wire money to a deepfake',
  'Thinks hands have seven fingers',
  'Argued with an AI cat. Lost.',
  'Believes every sunset is real',
  "Forwards chain emails 'just in case'",
  'Has been to the Eiffel Tower in Ohio',
  'Trusts the vibes, not the pixels',
  'Once tipped a chatbot',
  'Asked the robot for a second opinion',
  'Legally shouldn’t be allowed a phone',
];

type TitleRule = { name: string; earned: (s: TitleStats) => boolean; hint: string };
export type TitleStats = { rounds: number; fooled: number; points: number; worst_day: number; longest_streak: number };

export const TITLES: TitleRule[] = [
  { name: 'First Blood', earned: (s) => s.fooled >= 1, hint: 'Get fooled once' },
  { name: 'Catfished by a Graphics Card', earned: (s) => s.fooled >= 5, hint: 'Get fooled 5 times' },
  { name: 'Six-Finger Truther', earned: (s) => s.fooled >= 10, hint: 'Get fooled 10 times' },
  { name: "Grandma Would've Known", earned: (s) => s.rounds >= 20 && s.fooled / s.rounds >= 0.3, hint: 'Get fooled on 30% of 20+ rounds' },
  { name: "Deepfake's Best Friend", earned: (s) => s.worst_day >= 5, hint: 'Get fooled on every round in a day' },
  { name: 'Serial Believer', earned: (s) => s.longest_streak >= 5, hint: 'Get fooled 5 days in a row' },
  { name: 'The Believer', earned: (s) => s.points <= -5000, hint: 'Reach −5,000' },
];
