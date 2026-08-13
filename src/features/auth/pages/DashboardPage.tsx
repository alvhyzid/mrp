'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { getDashboardRouteForRole, isCompanyLeadership } from '@/lib/roles';
import { Card, CardContent } from '@/components/ui/card';

type Summary = {
  newPoCount: number;
  activeSoCount: number;
  activeEmployeeCount: number;
  belowMinStockCount: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [isLeadership, setIsLeadership] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

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
      setIsLeadership(meResponse.ok && isCompanyLeadership(meData?.user?.role));
      setLoading(false);
    };

    checkSession();
  }, [router]);

  useEffect(() => {
    // KPI lintas-department cuma relevan untuk company_admin/general_manager —
    // department lain sudah punya dashboard sendiri sebagai halaman utama mereka.
    if (!isLeadership) return;

    const loadSummary = async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      setSummaryLoading(true);
      const response = await fetch('/api/dashboard-summary', { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await response.json();
      if (!response.ok) {
        setSummaryError(data.error || 'Gagal memuat ringkasan KPI.');
        setSummaryLoading(false);
        return;
      }
      setSummary(data);
      setSummaryError('');
      setSummaryLoading(false);
    };

    loadSummary();
  }, [isLeadership, getAccessToken]);

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="container max-w-5xl text-center text-sm text-muted-foreground">Memuat dashboard...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="container flex max-w-5xl flex-col gap-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Ringkasan</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Selamat datang</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Halo <span className="font-semibold text-foreground">{userEmail ?? 'pengguna'}</span>. Gunakan menu di kiri untuk membuka modul yang Anda perlukan.
            </p>
            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>

        {isLeadership ? (
          <>
            {summaryError ? <p className="text-sm text-destructive">{summaryError}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="flex flex-col gap-1 pt-6">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">PO Baru / Menunggu Approval</span>
                  <span className="text-3xl font-semibold text-foreground">{summaryLoading ? '...' : (summary?.newPoCount ?? 0)}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 pt-6">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">SO Sedang Berjalan</span>
                  <span className="text-3xl font-semibold text-foreground">{summaryLoading ? '...' : (summary?.activeSoCount ?? 0)}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 pt-6">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Karyawan Aktif</span>
                  <span className="text-3xl font-semibold text-foreground">{summaryLoading ? '...' : (summary?.activeEmployeeCount ?? 0)}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 pt-6">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Item Bahan di Bawah Min. Stok</span>
                  <span className={`text-3xl font-semibold ${summary && summary.belowMinStockCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
                    {summaryLoading ? '...' : (summary?.belowMinStockCount ?? 0)}
                  </span>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
