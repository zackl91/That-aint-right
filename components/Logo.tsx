import Link from 'next/link';

/** "THAT AIN'T RIGHT" with the AI called out. */
export default function Logo({ size }: { size?: number }) {
  return (
    <Link href="/" className="logo" style={size ? { fontSize: size } : undefined} aria-label="That Ain't Right, home">
      THAT <span className="ai">AI</span>N&rsquo;T RIGHT
    </Link>
  );
}
