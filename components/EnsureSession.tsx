'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Everyone plays immediately under an anonymous account (with an embarrassing
 * auto-generated name). Adding an email later keeps the score.
 * Requires "Anonymous sign-ins" to be enabled in Supabase > Authentication.
 */
export default function EnsureSession() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) return;
      const { error } = await supabase.auth.signInAnonymously();
      if (!error) router.refresh();
      else console.error('Anonymous sign-in failed. Is it enabled in Supabase?', error.message);
    });
  }, [router]);
  return null;
}
