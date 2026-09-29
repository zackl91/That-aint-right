import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isValidISODate, puzzleNumber, formatShort, todayISO } from '@/lib/dates';
import { isValidPattern, cleanName } from '@/lib/share';
import { verdict } from '@/lib/copy';
import { pts } from '@/lib/format';
import { CheckIcon, XIcon } from '@/components/Icons';

type Props = { params: Promise<{ date: string; pattern: string }>; searchParams: Promise<{ n?: string }> };

async function read({ params, searchParams }: Props) {
  const { date, pattern: raw } = await params;
  const { n } = await searchParams;
  const pattern = raw.toUpperCase();
  if (!isValidISODate(date) || !isValidPattern(pattern) || date > todayISO()) return null;
  const fooled = [...pattern].filter((c) => c !== 'S').length;
  return { date, pattern, name: cleanName(n), fooled, total: pattern.length };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const r = await read(props);
  if (!r) return {};
  const who = r.name || 'Someone';
  const title = r.fooled === 0 ? `${who} wasn't fooled once` : `${who} got fooled ${r.fooled} of ${r.total} times`;
  const description = `That AIn't Right, Day ${puzzleNumber(r.date)}. One photo is real, one is AI. Think you can do better?`;
  const img = `/api/og?d=${r.date}&p=${r.pattern}${r.name ? `&n=${encodeURIComponent(r.name)}` : ''}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: img, width: 1200, height: 630 }], type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: [img] },
  };
}

export default async function SharedResult(props: Props) {
  const r = await read(props);
  if (!r) notFound();
  const who = r.name || 'Your friend';

  return (
    <main className="screen no-tabs" style={{ justifyContent: 'center', gap: 20 }}>
      <Link href="/" className="logo">THAT <span className="ai">AI</span>N&rsquo;T RIGHT</Link>
      <p className="kicker">DAY {puzzleNumber(r.date)} · {formatShort(r.date).toUpperCase()}</p>
      <h1 className="display" style={{ fontSize: 38, lineHeight: 1 }}>
        {r.fooled === 0 ? `${who} wasn't fooled once.` : `${who} got fooled ${r.fooled} of ${r.total} times.`}
      </h1>
      <section className="card-ink" style={{ gap: 14 }}>
        <div className="squares">
          {[...r.pattern].map((c, i) => (
            <span key={i} className={`square ${c === 'S' ? 'safe' : 'fooled'}`}>
              {c === 'S' ? <span style={{ color: 'var(--ink)' }}><CheckIcon /></span> : <span style={{ color: 'var(--card)' }}><XIcon /></span>}
            </span>
          ))}
        </div>
        <div className="mono" style={{ fontSize: 56, lineHeight: 1, color: r.fooled ? 'var(--shame-bright)' : 'var(--paper)' }}>{pts(-100 * r.fooled)}</div>
        <div className="display" style={{ fontSize: 18 }}>Verdict: {verdict(r.fooled, r.total)}</div>
      </section>
      <p className="lede" style={{ fontSize: 17 }}>Two photos. One real, one AI. Pick the real one. Same {r.total} pairs they got.</p>
      <a href={`/go/share?d=${r.date}`} className="btn btn-shame btn-hero">THINK YOU CAN DO BETTER?</a>
    </main>
  );
}
