/**
 * Build puzzles from your machine.
 *
 *   npm run content                          # today, if missing
 *   npm run content -- --days 14             # today + next 13 days
 *   npm run content -- --from 2026-09-12 --days 14   # backfill two weeks so the archive has history
 *   npm run content -- --date 2026-10-01 --replace --draft
 *
 * Flags: --date, --from, --days, --replace (rebuild existing), --draft (don't publish)
 */
import { generatePuzzle } from '@/lib/content/pipeline';
import { addDays, todayISO, isValidISODate } from '@/lib/dates';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const from = arg('date') ?? arg('from') ?? todayISO();
  const days = arg('date') ? 1 : Number(arg('days') ?? 1);
  if (!isValidISODate(from) || !Number.isFinite(days) || days < 1) {
    console.error('Usage: npm run content -- [--date YYYY-MM-DD | --from YYYY-MM-DD --days N] [--replace] [--draft]');
    process.exit(1);
  }
  const publish = !flag('draft');
  let failed = 0;
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    try {
      await generatePuzzle(date, { publish, replace: flag('replace'), log: console.log });
    } catch (e) {
      failed++;
      console.error(`${date}: FAILED — ${(e as Error).message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

main();
