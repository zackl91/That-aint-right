import { NextResponse } from 'next/server';

export function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const res = NextResponse.redirect(new URL(target, url.origin));
  res.cookies.set('tar_welcomed', '1', { path: '/', maxAge: 60 * 60 * 24 * 365 * 2, sameSite: 'lax' });
  return res;
}
