'use client';
import { useEffect, useState } from 'react';
import { APP_TZ } from '@/lib/dates';

/** Milliseconds until the next midnight in the game's timezone. */
function msToMidnight(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_TZ, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' })
    .formatToParts(now)
    .reduce<Record<string, number>>((acc, p) => (p.type === 'literal' ? acc : { ...acc, [p.type]: Number(p.value) }), {});
  const elapsed = (parts.hour * 3600 + parts.minute * 60 + parts.second) * 1000 + now.getMilliseconds();
  return 86400000 - elapsed;
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(sec).padStart(2, '0')}s`;
}

export default function Countdown({ prefix = 'Next puzzle in' }: { prefix?: string }) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    setMs(msToMidnight());
    const id = window.setInterval(() => setMs(msToMidnight()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="countdown-line">
      {prefix} <strong className="mono">{ms === null ? '…' : fmt(ms)}</strong>
    </span>
  );
}
