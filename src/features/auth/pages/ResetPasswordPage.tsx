'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setCheckingSession(false);
      return;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setSessionReady(true);
        setCheckingSession(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setSessionReady(true);
      }
      setCheckingSession(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('pending');
    setMessage('');

    if (newPassword.length < 8) {
      setStatus('error');
      setMessage('Kata sandi baru minimal 8 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    if (!supabase) {
      setStatus('error');
      setMessage('Supabase belum dikonfigurasi.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }

    setStatus('success');
    setMessage('Kata sandi berhasil diatur ulang.');
  };

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-slate-50 py-16">
        <div className="mx-auto max-w-md px-6">
          <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200 text-center text-slate-600">Memeriksa tautan reset...</div>
        </div>
      </main>
    );
  }

  if (!sessionReady) {
    return (
      <main className="min-h-screen bg-slate-50 py-16">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
          <p className="text-sm uppercase tracking-[0.2em] text-rose-500">Tautan Tidak Valid</p>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Tautan reset kata sandi sudah tidak berlaku</h1>
          <p className="mt-4 text-slate-600">Silakan minta tautan reset baru.</p>
          <a
            href="/forgot-password"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Minta Tautan Baru
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-16">
      <div className="mx-auto flex max-w-md flex-col gap-6 rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Atur Ulang Kata Sandi</h1>
          <p className="mt-2 text-sm text-slate-600">Masukkan kata sandi baru untuk akun Anda.</p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Kata sandi baru</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Konfirmasi kata sandi baru</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              required
            />
          </label>

          {message ? (
            <p className={`text-sm ${status === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{message}</p>
          ) : null}

          {status === 'success' ? (
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="inline-flex justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Lanjut ke Dashboard
            </button>
          ) : (
            <button
              type="submit"
              disabled={status === 'pending'}
              className="inline-flex justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {status === 'pending' ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
            </button>
          )}
        </form>
      </div>
    </main>
  );
}
