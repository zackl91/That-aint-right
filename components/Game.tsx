'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Round, RoundResult, Side } from '@/lib/types';
import { pts, pickStable } from '@/lib/format';
import { FOOLED_ROASTS, CORRECT_LINES, TIMEOUT_ROASTS, verdict, coinLine } from '@/lib/copy';
import { formatShort } from '@/lib/dates';
import { CloseIcon, ZoomIcon, CheckIcon, XIcon } from './Icons';

type Props = {
  date: string;
  number: number;
  isToday: boolean;
  initialRounds: Round[];
  lifetimeStart: number;
};

type Phase = 'pick' | 'result' | 'recap';
type Pick = Side | 'TIMEOUT';

const ROUND_SECONDS = Math.max(3, Number(process.env.NEXT_PUBLIC_ROUND_SECONDS) || 10);

export default function Game({ date, number, isToday, initialRounds, lifetimeStart }: Props) {
  const [rounds, setRounds] = useState<Round[]>(initialRounds);
  const firstOpen = initialRounds.findIndex((r) => !r.result);
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [phase, setPhase] = useState<Phase>(firstOpen === -1 ? 'recap' : 'pick');
  const [zoom, setZoom] = useState<Side | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newlyFooled, setNewlyFooled] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, true>>({});
  const [msLeft, setMsLeft] = useState(ROUND_SECONDS * 1000);

  const round = rounds[index];
  const fooledToday = rounds.filter((r) => r.result && !r.result.correct).length;
  const lifetime = lifetimeStart - 100 * newlyFooled;

  async function pick(side: Pick) {
    if (busy || round.result) return;
    setBusy(true);
    setError(null);
    setZoom(null);
    try {
      const supabase = createClient();
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const { error: authErr } = await supabase.auth.signInAnonymously();
        if (authErr) throw new Error('Could not start a session. Check that anonymous sign-ins are enabled.');
      }
      const { data, error: rpcErr } = await supabase.rpc('submit_answer', { p_round: round.id, p_pick: side });
      if (rpcErr) throw new Error(rpcErr.message);
      const result = data as RoundResult;
      setRounds((rs) => rs.map((r, i) => (i === index ? { ...r, result } : r)));
      if (!result.correct) setNewlyFooled((n) => n + 1);
      setPhase('result');
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    const nextOpen = rounds.findIndex((r) => !r.result);
    if (nextOpen === -1) setPhase('recap');
    else {
      setIndex(nextOpen);
      setMsLeft(ROUND_SECONDS * 1000);
      setPhase('pick');
    }
    window.scrollTo({ top: 0 });
  }

  // ---- Timer: starts once both images are on screen, so slow connections aren't punished.
  const ready = Boolean(round && loaded[round.a_url] && loaded[round.b_url]);
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    if (phase !== 'pick' || !ready || busy || round?.result) return;
    const deadline = Date.now() + ROUND_SECONDS * 1000;
    setMsLeft(ROUND_SECONDS * 1000);
    const id = window.setInterval(() => {
      const left = deadline - Date.now();
      if (left <= 0) {
        window.clearInterval(id);
        setMsLeft(0);
        pickRef.current('TIMEOUT');
      } else {
        setMsLeft(left);
      }
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index, ready, busy]);

  const markLoaded = (url: string) => setLoaded((l) => (l[url] ? l : { ...l, [url]: true }));
  const secondsLeft = Math.ceil(msLeft / 1000);
  const urgent = ready && secondsLeft <= 3;
  const isBoss = round?.difficulty === 'boss';

  // While a result is showing, fetch the next pair so it appears instantly on Next.
  useEffect(() => {
    if (phase !== 'result') return;
    const upcoming = rounds.find((r) => !r.result);
    if (!upcoming || upcoming.media_type !== 'image') return;
    [upcoming.a_url, upcoming.b_url].forEach((u) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = u;
    });
  }, [phase, rounds]);

  // Stop the page behind the result from scrolling (it steals taps on iOS).
  useEffect(() => {
    if (phase !== 'result') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  if (phase === 'recap') {
    return <Recap date={date} number={number} isToday={isToday} rounds={rounds} />;
  }

  return (
    <div className="game">
      <main className="screen no-tabs">
        <div className="row">
          <Link href="/" className="icon-btn" aria-label="Quit and go home">
            <CloseIcon />
          </Link>
          <div className="progress" aria-label={`Round ${index + 1} of ${rounds.length}`}>
            {rounds.map((r, i) => (
              <span
                key={r.id}
                className={r.result ? (r.result.correct ? 'safe' : 'fooled') : i === index ? 'current' : ''}
              />
            ))}
          </div>
          <span className="mono" style={{ fontSize: 15, color: fooledToday ? 'var(--shame)' : 'var(--ink)' }}>
            {pts(-100 * fooledToday)}
          </span>
        </div>

        <div className="row between kicker">
          <span>ROUND {index + 1} OF {rounds.length}</span>
          {isBoss ? (
            <span className="boss-tag">BOSS ROUND</span>
          ) : (
            <span>{isToday ? `DAY ${number}` : `DAY ${number} · ${formatShort(date).toUpperCase()}`}</span>
          )}
        </div>
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <h1 className="display" style={{ fontSize: 30 }}>{isBoss ? 'The good fake. Which is real?' : 'Which one is real?'}</h1>
          <span className={`countdown${urgent ? ' urgent' : ''}`} aria-live="off">{ready ? secondsLeft : ROUND_SECONDS}</span>
        </div>
        <div
          className={`timer${urgent ? ' urgent' : ''}`}
          role="timer"
          aria-label={ready ? `${secondsLeft} seconds left` : 'Timer starts when both images load'}
        >
          <span style={{ transform: `scaleX(${ready ? msLeft / (ROUND_SECONDS * 1000) : 1})` }} />
        </div>

        <div className="pairs">
          {(['A', 'B'] as Side[]).map((side) => (
            <div key={side} style={{ position: 'relative' }}>
              <button
                type="button"
                className="pick"
                onClick={() => pick(side)}
                disabled={busy}
                aria-label={`Pick ${side} as the real one`}
              >
                <Media
                  key={side === 'A' ? round.a_url : round.b_url}
                  url={side === 'A' ? round.a_url : round.b_url}
                  type={round.media_type}
                  onReady={markLoaded}
                />
                <span className="letter">{side}</span>
              </button>
              <button type="button" className="zoom" aria-label={`Zoom in on ${side}`} onClick={() => setZoom(side)}>
                <ZoomIcon />
              </button>
            </div>
          ))}
        </div>

        {error && <p className="notice err" role="alert">{error}</p>}
        <p className="small center">{ROUND_SECONDS} seconds per pair. Run out and it counts as fooled.</p>
      </main>

      {zoom && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Option ${zoom}, zoomed`}>
          <Media url={zoom === 'A' ? round.a_url : round.b_url} type={round.media_type} controls />
          <p className={`countdown${urgent ? ' urgent' : ''}`} style={{ color: urgent ? 'var(--shame-bright)' : 'var(--paper)', textAlign: 'center', margin: 0 }}>
            {secondsLeft}
          </p>
          <div className="row">
            <button type="button" className="btn btn-shame" onClick={() => pick(zoom)} disabled={busy}>
              {zoom} IS REAL
            </button>
            <button type="button" className="btn btn-paper" onClick={() => setZoom(zoom === 'A' ? 'B' : 'A')}>
              SEE {zoom === 'A' ? 'B' : 'A'}
            </button>
            <button type="button" className="icon-btn" style={{ color: 'var(--paper)' }} aria-label="Close zoom" onClick={() => setZoom(null)}>
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

      {phase === 'result' && round.result && (
        <Result
          round={round}
          result={round.result}
          index={index}
          fooledToday={fooledToday}
          lifetime={lifetime}
          isLast={rounds.every((r) => r.result)}
          onNext={next}
        />
      )}
    </div>
  );
}

function Media({
  url, type, controls, onReady,
}: { url: string; type: 'image' | 'video'; controls?: boolean; onReady?: (url: string) => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!onReady) return;
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) onReady(url);
    if (vidRef.current && vidRef.current.readyState >= 2) onReady(url);
  }, [url, onReady]);

  if (type === 'video') {
    return (
      <video ref={vidRef} src={url} autoPlay muted loop playsInline controls={controls} preload="auto"
        onLoadedData={() => onReady?.(url)} />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={imgRef} src={url} alt="" draggable={false} onLoad={() => onReady?.(url)} onError={() => onReady?.(url)} />
  );
}

function Result({
  round, result, index, fooledToday, lifetime, isLast, onNext,
}: {
  round: Round; result: RoundResult; index: number; fooledToday: number; lifetime: number; isLast: boolean; onNext: () => void;
}) {
  const fooled = !result.correct;
  const timedOut = Boolean(result.timed_out);
  const aiSide: Side = result.real_side === 'A' ? 'B' : 'A';
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Focus for keyboard users without scrolling the panel down to the button.
    nextRef.current?.focus({ preventScroll: true });
  }, []);

  const social =
    result.friends_total && result.friends_total > 0
      ? `${result.friends_fooled} of your ${result.friends_total} friends who played got this wrong`
      : typeof result.global_fool_pct === 'number'
        ? `${result.global_fool_pct}% of players got this wrong`
        : null;

  return (
    <div className={`result ${fooled ? 'result-fooled' : 'result-safe'}`} role="dialog" aria-modal="true" aria-labelledby="verdict">
      <div className="result-scroll">
        <div className="result-inner">
          <p className="kicker">ROUND {index + 1}{round.difficulty === 'boss' ? ' · BOSS' : ''} · {timedOut ? 'TIME’S UP' : 'VERDICT'}</p>
          <div className="verdict-head">
            <div className={`stamp${fooled ? '' : ' safe'}`} aria-hidden="true">{timedOut ? 'TOO SLOW' : fooled ? 'FOOLED' : 'SURVIVED'}</div>
            <div className="big-num" aria-label={fooled ? 'minus 100 points' : 'zero points lost'}>{fooled ? '\u2212100' : '0'}</div>
          </div>
          <h1 id="verdict" className="display result-title">
            {timedOut
              ? pickStable(TIMEOUT_ROASTS, round.id)
              : fooled
                ? pickStable(FOOLED_ROASTS, round.id)
                : pickStable(CORRECT_LINES, round.id)}
          </h1>
          {result.tell && (
            <p className="result-copy">
              {`${aiSide} was the fake. `}
              {result.tell}
            </p>
          )}

          <div className="reveal">
            {(['A', 'B'] as Side[]).map((side) => (
              <figure key={side}>
                <Media url={side === 'A' ? round.a_url : round.b_url} type={round.media_type} />
                <figcaption>
                  <span>{side} · {side === result.real_side ? 'REAL' : 'AI'}</span>
                  {!timedOut && side === result.picked && <span className={`tag${fooled ? ' shame' : ''}`}>YOUR PICK</span>}
                </figcaption>
              </figure>
            ))}
          </div>
          {social && <p className="result-copy result-small">{social}.{fooled ? ' You\u2019re in company, at least.' : ''}</p>}
          {result.real_credit && <p className="result-copy result-small">Real photo: {result.real_credit}</p>}
        </div>
      </div>

      <div className="result-actions">
        <div className="result-totals">
          <span>TODAY {pts(-100 * fooledToday)}</span>
          <span>LIFETIME {pts(lifetime)}</span>
        </div>
        <button ref={nextRef} type="button" className={`btn ${fooled ? 'btn-paper' : 'btn-ink'}`} onClick={onNext}>
          {isLast ? 'SEE THE DAMAGE' : 'NEXT PAIR'}
        </button>
      </div>
    </div>
  );
}

function Recap({ date, number, isToday, rounds }: { date: string; number: number; isToday: boolean; rounds: Round[] }) {
  const fooled = rounds.filter((r) => r.result && !r.result.correct);
  const total = rounds.length;
  const score = -100 * fooled.length;
  const [shared, setShared] = useState<string | null>(null);

  const shareText = useMemo(() => {
    const squares = rounds.map((r) => (r.result?.correct ? '\u2B1C' : '\uD83D\uDFE5')).join('');
    return `That AIn't Right #${number}\n${squares}\n${pts(score)}. ${verdict(fooled.length, total)}.`;
  }, [rounds, number, score, fooled.length, total]);

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.origin : '';
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText, url });
        return;
      }
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      setShared('Copied. Paste it in the group chat.');
    } catch {
      /* user cancelled */
    }
  }

  const fooledBy = fooled.map((r) => r.result?.subject).filter(Boolean) as string[];

  return (
    <>
      <main className="screen no-tabs" style={{ gap: 18 }}>
        <div className="stack" style={{ gap: 6 }}>
          <p className="kicker">DAY {number} · {isToday ? 'DONE' : formatShort(date).toUpperCase()}</p>
          <h1 className="display" style={{ fontSize: 32 }}>The damage report</h1>
        </div>

        <section className="card-ink" style={{ borderRadius: 22, padding: 22 }} aria-label="Your result">
          <div className="row between mono" style={{ fontSize: 13, letterSpacing: '0.06em' }}>
            <span>THAT AIN&rsquo;T RIGHT #{number}</span>
            <span style={{ color: 'var(--dark-muted)' }}>{formatShort(date).toUpperCase()}</span>
          </div>
          <div className="squares" aria-label={rounds.map((r) => (r.result?.correct ? 'correct' : 'fooled')).join(', ')}>
            {rounds.map((r) => (
              <span key={r.id} className={`square ${r.result ? (r.result.correct ? 'safe' : 'fooled') : 'pending'}`}>
                {r.result && (r.result.correct ? <span style={{ color: 'var(--ink)' }}><CheckIcon /></span> : <span style={{ color: 'var(--card)' }}><XIcon /></span>)}
              </span>
            ))}
          </div>
          <div className="mono" style={{ fontSize: 64, lineHeight: 1, color: score ? 'var(--shame-bright)' : 'var(--paper)', letterSpacing: '-0.04em' }}>
            {pts(score)}
          </div>
          <div className="display" style={{ fontSize: 20, lineHeight: 1.15 }}>Verdict: {verdict(fooled.length, total)}</div>
          {fooledBy.length > 0 && (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--dark-muted)' }}>Fooled by {listify(fooledBy)}.</p>
          )}
        </section>

        <p style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>{coinLine(fooled.length, total)}</p>

        <div className="stack" style={{ gap: 10 }}>
          <button type="button" className="btn btn-shame" onClick={share}>SHARE MY SHAME</button>
          {shared && <p className="notice ok" role="status">{shared}</p>}
          <Link href="/archive" className="btn btn-outline">Play a missed day</Link>
          <Link href="/ranks" className="btn btn-outline">See where you rank</Link>
        </div>

        <section className="stack">
          <h2 className="section-title">THE EVIDENCE</h2>
          {rounds.map((r, i) =>
            r.result ? (
              <div key={r.id} className="card stack" style={{ padding: 10, gap: 8 }}>
                <div className="row between" style={{ fontSize: 14 }}>
                  <strong>{i + 1}. {capitalize(r.result.subject)}</strong>
                  <span className={`tag${r.result.correct ? '' : ' shame'}`}>{r.result.correct ? 'SURVIVED' : r.result.timed_out ? 'TOO SLOW' : 'FOOLED'}</span>
                </div>
                <div className="reveal">
                  {(['A', 'B'] as Side[]).map((side) => (
                    <figure key={side} style={{ border: 0, padding: 0 }}>
                      <Media url={side === 'A' ? r.a_url : r.b_url} type={r.media_type} />
                      <figcaption>
                        <span>{side} · {side === r.result!.real_side ? 'REAL' : 'AI'}</span>
                        {!r.result!.timed_out && side === r.result!.picked && <span className="tag">YOUR PICK</span>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
                {r.result.tell && <p className="small">{r.result.tell}</p>}
              </div>
            ) : null,
          )}
        </section>

        <Link href="/" className="btn btn-ink">BACK TO TODAY</Link>
      </main>
    </>
  );
}

function listify(items: string[]) {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
