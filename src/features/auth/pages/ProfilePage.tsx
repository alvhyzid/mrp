'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');

  const [name, setName] = useState('');
  const [nameStatus, setNameStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [nameMessage, setNameMessage] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [passwordMessage, setPasswordMessage] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!hasSupabaseConfig || !supabase) {
        router.replace('/login');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/profile');
        return;
      }

      const accessToken = sessionData.session.access_token;
      const response = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();

      if (!response.ok) {
        setNameMessage(data.error || 'Gagal memuat profil.');
        setNameStatus('error');
        setLoading(false);
        return;
      }

      setName(data.user.name || '');
      setEmail(data.user.email || '');
      setLoading(false);
    };

    load();
  }, [router]);

  const handleSaveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameStatus('pending');
    setNameMessage('');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setNameStatus('error');
      setNameMessage('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }

    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ name })
    });
    const data = await response.json();

    if (!response.ok) {
      setNameStatus('error');
      setNameMessage(data.error || 'Gagal menyimpan nama.');
      return;
    }

    setNameStatus('success');
    setNameMessage('Nama berhasil diperbarui.');
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordStatus('pending');
    setPasswordMessage('');

    if (newPassword.length < 8) {
      setPasswordStatus('error');
      setPasswordMessage('Kata sandi baru minimal 8 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus('error');
      setPasswordMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    if (!supabase) {
      setPasswordStatus('error');
      setPasswordMessage('Supabase belum dikonfigurasi.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordStatus('error');
      setPasswordMessage(error.message);
      return;
    }

    setPasswordStatus('success');
    setPasswordMessage('Kata sandi berhasil diubah.');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 py-16">
        <div className="mx-auto max-w-2xl px-6">
          <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200 text-center text-slate-600">Memuat profil...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-16">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6">
        <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Profil Saya</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Data akun</h1>

          <form onSubmit={handleSaveName} className="mt-6 grid gap-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                disabled
                className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Nama</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                required
              />
            </label>

            {nameMessage ? (
              <p className={`text-sm ${nameStatus === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{nameMessage}</p>
            ) : null}

            <button
              type="submit"
              disabled={nameStatus === 'pending'}
              className="inline-flex justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {nameStatus === 'pending' ? 'Menyimpan...' : 'Simpan Nama'}
            </button>
          </form>
        </div>

        <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">Ganti kata sandi</h2>
          <form onSubmit={handleChangePassword} className="mt-6 grid gap-4">
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

            {passwordMessage ? (
              <p className={`text-sm ${passwordStatus === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{passwordMessage}</p>
            ) : null}

            <button
              type="submit"
              disabled={passwordStatus === 'pending'}
              className="inline-flex justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {passwordStatus === 'pending' ? 'Menyimpan...' : 'Ganti Kata Sandi'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
