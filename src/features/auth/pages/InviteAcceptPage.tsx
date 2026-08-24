'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';

type InviteAcceptPageProps = {
  token: string | null;
};

export default function InviteAcceptPage({ token }: InviteAcceptPageProps) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const acceptInvite = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Token undangan tidak ditemukan di URL.');
        return;
      }

      if (!hasSupabaseConfig || !supabase) {
        setStatus('error');
        setMessage('Supabase belum dikonfigurasi.');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        router.push(`/login?redirectTo=/invite/accept?token=${encodeURIComponent(token)}`);
        return;
      }

      setStatus('pending');
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();
      if (!response.ok) {
        setStatus('error');
        setMessage(data.error || 'Gagal menerima undangan.');
        return;
      }

      setStatus('success');
      setMessage('Undangan berhasil diterima. Anda sekarang menjadi bagian dari perusahaan.');
    };

    acceptInvite();
  }, [router, token]);

  return (
    <main className="min-h-screen bg-slate-50 py-16">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Terima Undangan</p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">Terima undangan perusahaan</h1>
        <div className="mt-6 space-y-4 text-slate-700">
          {status === 'pending' && <p>Memproses undangan...</p>}
          {status === 'success' && <p className="text-emerald-700">{message}</p>}
          {status === 'error' && <p className="text-rose-700">{message}</p>}
          {status === 'idle' && <p>Memeriksa token undangan...</p>}
        </div>
        {status === 'success' ? (
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="mt-6 inline-flex items-center justify-center rounded-none bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Kembali ke Dashboard
          </button>
        ) : null}
      </div>
    </main>
  );
}
