'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tile, SkeletonText, InlineNotification } from '@carbon/react';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { getDashboardRouteForRole, isCompanyLeadership } from '@/lib/roles';

// HALAMAN RINGKASAN — dimigrasikan ke Carbon 25 Agu 2026.
//
// POLA: halaman ini BUKAN halaman data bertabel, jadi cetakan halaman data tidak berlaku
// penuh. Carbon tidak punya pola "dashboard" tersendiri; yang terdekat adalah Tile sebagai
// wadah isi berkelompok. Disebut terbuka sesuai aturan B.2 — jangan diam-diam merancang
// sendiri lalu mengaku mengikuti pola.
//
// REMAH ROTI SENGAJA TIDAK ADA: halaman ini akar navigasi. Remah roti satu butir hanya
// menunjukkan tempat yang sudah jelas, dan menambah baris tanpa menambah keterangan.
//
// KARTU ANGKA memakai kelas bersama `.kisi-metrik`/`.metrik__*` di src/styles/carbon.scss —
// Carbon tidak punya komponen "kartu angka", jadi ukurannya ditetapkan sekali di sana supaya
// dashboard berikutnya tidak memilih ukuran angkanya sendiri.

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
      setIsLeadership(meResponse.ok ? isCompanyLeadership(meData?.user?.role) : false);
      setLoading(false);
    };

    checkSession();
  }, [router]);

  useEffect(() => {
    if (!isLeadership) return;

    const loadSummary = async () => {
      setSummaryLoading(true);
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setSummaryError('Sesi tidak valid.');
        setSummaryLoading(false);
        return;
      }

      const response = await fetch('/api/dashboard/summary', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      if (!response.ok) {
        setSummaryError(data.error || 'Gagal memuat ringkasan.');
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
    // SkeletonText Carbon menggantikan tulisan "Memuat dashboard...". Bentuk rangkanya
    // menunjukkan APA yang sedang datang; kalimat "memuat" hanya menyatakan bahwa sesuatu
    // sedang terjadi.
    return (
      <div className="halaman">
        <SkeletonText heading width="18rem" />
        <SkeletonText paragraph lineCount={2} />
      </div>
    );
  }

  const metrik: { label: string; nilai: number | undefined; waspada?: boolean }[] = [
    { label: 'PO klien baru menunggu persetujuan', nilai: summary?.newPoCount },
    { label: 'Pesanan penjualan sedang berjalan', nilai: summary?.activeSoCount },
    { label: 'Karyawan aktif', nilai: summary?.activeEmployeeCount },
    { label: 'Bahan di bawah stok minimum', nilai: summary?.belowMinStockCount, waspada: (summary?.belowMinStockCount ?? 0) > 0 }
  ];

  return (
    <div className="halaman">
      <div>
        <h1 className="halaman__judul">Ringkasan</h1>
        <p className="halaman__pengantar">
          Halo {userEmail ?? 'pengguna'}. Gunakan menu di kiri untuk membuka modul yang Anda perlukan.
        </p>
      </div>

      {error ? <InlineNotification kind="error" lowContrast title="Konfigurasi bermasalah" subtitle={error} hideCloseButton /> : null}
      {summaryError ? <InlineNotification kind="error" lowContrast title="Gagal memuat ringkasan" subtitle={summaryError} hideCloseButton /> : null}

      {isLeadership ? (
        <div className="kisi-metrik">
          {metrik.map((m) => (
            <Tile key={m.label}>
              <span className="metrik__label">{m.label}</span>
              {summaryLoading ? (
                <SkeletonText heading width="4rem" />
              ) : (
                <span className={`metrik__angka ${m.waspada ? 'metrik__angka--waspada' : ''}`}>{m.nilai ?? 0}</span>
              )}
            </Tile>
          ))}
        </div>
      ) : null}
    </div>
  );
}
