'use client';

import { useState } from 'react';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('pending');
    setMessage('');

    if (!hasSupabaseConfig || !supabase) {
      setStatus('error');
      setMessage('Supabase belum dikonfigurasi.');
      return;
    }

    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`
    });

    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }

    setStatus('success');
    setMessage('Kalau email terdaftar, tautan untuk atur ulang kata sandi sudah dikirim. Silakan cek inbox Anda.');
  };

  return (
    <main className="min-h-screen bg-slate-50 py-16">
      <div className="mx-auto flex max-w-md flex-col gap-6 rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Lupa Kata Sandi</h1>
          <p className="mt-2 text-sm text-slate-600">Masukkan email Anda, kami kirim tautan untuk atur ulang kata sandi.</p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              required
            />
          </label>

          {message ? (
            <p className={`text-sm ${status === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{message}</p>
          ) : null}

          <button
            type="submit"
            disabled={status === 'pending'}
            className="inline-flex justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {status === 'pending' ? 'Mengirim...' : 'Kirim Tautan Reset'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-600">
          Ingat kata sandi? <a href="/login" className="font-semibold text-slate-900 underline">Masuk</a>
        </p>
      </div>
    </main>
  );
}
