'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setError('Supabase belum dikonfigurasi. Silakan periksa variabel lingkungan.');
        setLoading(false);
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data?.session) {
        router.replace('/login');
        return;
      }

      setUserEmail(data.session.user.email ?? null);
      setLoading(false);
    };

    checkSession();
  }, [router]);

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200 text-center text-slate-600">Memuat dashboard...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6">
        <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Dashboard</p>
              <h1 className="text-3xl font-semibold text-slate-900">Selamat datang</h1>
              <p className="mt-2 text-slate-600">
                Halo <span className="font-semibold text-slate-900">{userEmail ?? 'pengguna'}</span>. Dashboard ini akan berkembang menjadi pusat kontrol MRP multi-tenant.
              </p>
              {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/profile" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
                Profil Saya
              </Link>
              <Link href="/team" className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">
                Kelola Tim
              </Link>
              <Link href="/company" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
                Data Perusahaan
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Keluar
              </button>
              <Link href="/" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
