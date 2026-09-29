import { SkullIcon } from '@/components/Icons';

export default function Welcome() {
  return (
    <main className="screen no-tabs" style={{ gap: 20, paddingTop: 'calc(28px + env(safe-area-inset-top))' }}>
      <p className="kicker">DAILY · FREE · MILDLY HUMILIATING</p>
      <h1 className="display" style={{ fontSize: 58, lineHeight: 0.9, letterSpacing: '-0.035em' }}>
        THAT<br />
        <span className="shame-text">AI</span>N&rsquo;T<br />
        RIGHT
      </h1>
      <p style={{ margin: 0, fontSize: 17 }}>
        Every day: two photos. One is real. The other was made by a computer that has never touched grass. Pick the real one.
      </p>

      <a href="/welcome/start" className="btn btn-shame btn-hero">
        PLAY TODAY&rsquo;S PUZZLE
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </a>
      <p className="small center" style={{ marginTop: -8 }}>5 pairs · about a minute · no sign-up</p>

      <section className="card stack" style={{ gap: 14, borderRadius: 18, padding: 18 }}>
        <h2 className="display" style={{ fontSize: 18 }}>Scoring is backwards</h2>
        <Rule badge={<span className="mono" style={{ fontSize: 16 }}>0</span>} tone="ink">
          Everyone starts at 0. That&rsquo;s the best score you&rsquo;ll ever have.
        </Rule>
        <Rule badge={<span className="mono" style={{ fontSize: 11 }}>&minus;100</span>} tone="shame">
          Pick the AI one and lose 100 points. Every time.
        </Rule>
        <Rule badge={<SkullIcon size={20} />} tone="outline">
          The most negative scores get a spot on the Wall of Shame.
        </Rule>
      </section>

      <div className="stack" style={{ gap: 10 }}>
        <a href="/welcome/start" className="btn btn-ink">LET ME GET FOOLED</a>
        <a href="/welcome/start?next=/" className="link-btn" style={{ alignSelf: 'center' }}>Skip to the home screen</a>
      </div>
      <p className="small center" style={{ fontSize: 12 }}>
        Add an email later to keep your shame across devices.
      </p>
    </main>
  );
}

function Rule({ badge, tone, children }: { badge: React.ReactNode; tone: 'ink' | 'shame' | 'outline'; children: React.ReactNode }) {
  const style: React.CSSProperties =
    tone === 'ink'
      ? { background: 'var(--ink)', color: 'var(--paper)' }
      : tone === 'shame'
        ? { background: 'var(--shame)', color: 'var(--card)' }
        : { border: '2px solid var(--ink)' };
  return (
    <div className="row">
      <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
        {badge}
      </span>
      <span style={{ fontSize: 15, lineHeight: 1.35 }}>{children}</span>
    </div>
  );
}
