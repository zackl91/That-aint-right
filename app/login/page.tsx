import Link from 'next/link';
import LoginForm from '@/components/LoginForm';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="screen no-tabs" style={{ justifyContent: 'center', gap: 20 }}>
      <Link href="/" className="logo">THAT <span className="ai">AI</span>N&rsquo;T RIGHT</Link>
      <h1 className="display h1">Sign in on this device</h1>
      <p className="lede">We&rsquo;ll email you a sign-in link. No passwords, because you&rsquo;d fall for a fake reset email anyway.</p>
      {error && <p className="notice err" role="alert">That link expired or was already used. Request a new one.</p>}
      <LoginForm />
      <Link href="/" className="link-btn" style={{ alignSelf: 'center' }}>Keep playing as a guest</Link>
    </main>
  );
}
