'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { getDashboardRouteForRole } from '@/lib/roles';

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

      // Prinsip Desain #8: dashboard per-department, murni routing — begitu login,
      // role tertentu diarahkan langsung ke dashboard department mereka. Untuk alur
      // login normal ini sudah ditangani LoginPage (redirect langsung, tanpa mampir
      // sini). Cek di sini tetap perlu sebagai fallback: user yang sampai ke
      // /dashboard lewat cara lain (bookmark, tombol back browser) sambil rolenya
      // punya dashboard khusus tetap harus diarahkan otomatis, bukan nyangkut di sini.
      const meResponse = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      });
      const meData = await meResponse.json();
      const departmentRoute = meResponse.ok ? getDashboardRouteForRole(meData?.user?.role) : null;
      if (departmentRoute) {
        router.replace(departmentRoute);
        return;
      }

      setUserEmail(data.session.user.email ?? null);
      setLoading(false);
    };

    checkSession();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white py-16">
        <div className="mx-auto max-w-4xl px-6 text-center text-sm text-[#525252]">Memuat dashboard...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white py-12">
      <div className="mx-auto max-w-5xl px-6">
        <div className="border border-[#e0e0e0] p-10">
          <p className="text-xs uppercase tracking-[0.08em] text-[#525252]">Ringkasan</p>
          <h1 className="mt-2 text-[1.75rem] font-semibold leading-[1.286] text-[#161616]">Selamat datang</h1>
          <p className="mt-2 text-sm leading-[1.429] text-[#525252]">
            Halo <span className="font-semibold text-[#161616]">{userEmail ?? 'pengguna'}</span>. Gunakan menu di kiri untuk membuka modul yang Anda perlukan.
          </p>
          {error ? <p className="mt-4 text-sm text-[#da1e28]">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
