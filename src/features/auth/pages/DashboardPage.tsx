'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tile, SkeletonText, InlineNotification, ActionableNotification } from '@carbon/react';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { authedFetch, SesiTidakValid } from '@/lib/authedFetch';
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
  // Dimulai TRUE, bukan false. Alasannya bukan gaya: menyalakannya dari dalam useEffect
  // berarti memanggil setState secara sinkron di dalam effect — dan itu ditolak aturan lint
  // proyek ini (cascading renders). Untuk leadership ringkasan memang SELALU dimuat begitu
  // halaman terbuka, jadi keadaan awal yang jujur adalah "sedang memuat", bukan "diam".
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  /// Dinaikkan oleh tombol "Muat ulang ringkasan". Effect di bawah bergantung padanya, jadi
  /// menaikkannya = memuat ulang — tanpa perlu memanggil pemuatnya dari luar effect.
  const [percobaanMuat, setPercobaanMuat] = useState(0);

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

  // ==========================================================================
  // UX-D1 — MEMUAT RINGKASAN
  // ==========================================================================
  // ALAMATNYA `/api/dashboard-summary`, DATAR BERTANDA HUBUNG. Versi sebelumnya memanggil
  // `/api/dashboard/summary` (bersarang), yang tidak pernah ada. Seluruh route tingkat atas
  // di app/api memakai bentuk datar; yang bersarang hanya dipakai untuk sub-sumber daya
  // (mis. boms/[bomId]/restore). Endpoint kedua TIDAK dibuat untuk menampung salah ketik.
  //
  // KENAPA ADA try/catch, dan kenapa ini yang sebenarnya merusak layar:
  // alamat yang salah dijawab Next.js dengan HALAMAN 404 ber-HTML, bukan JSON. `response.json()`
  // melempar SEBELUM baris `if (!response.ok)` sempat dijalankan, sehingga `setSummaryLoading(false)`
  // dan `setSummaryError(...)` tidak pernah tercapai. Akibatnya empat kartu berhenti SELAMANYA
  // di keadaan memuat tanpa satu pun pesan — diukur di peramban 27 Agu 2026, dan galatnya
  // muncul sebagai "Uncaught (in promise) SyntaxError" yang tidak dilihat siapa pun.
  //
  // Jadi memperbaiki alamatnya saja TIDAK CUKUP: kelas cacatnya akan kembali begitu server
  // menjawab HTML karena sebab lain (galat 500, gangguan gateway, sesi habis di tengah jalan).
  // `finally` yang menghentikan pemuatan adalah bagian perbaikannya, bukan hiasan.
  //
  // KENAPA PEMUATNYA HIDUP DI DALAM EFFECT, bukan sebagai useCallback:
  // memanggil useCallback berisi setState dari dalam effect ditolak aturan lint proyek ini
  // (cascading renders), dan percobaan menaruhnya di luar menambah satu galat lint baru.
  // Bentuk ini — pemuat mandiri di dalam effect, dijalankan ulang lewat `percobaanMuat` —
  // adalah bentuk yang sama dengan sebelum perbaikan, jadi tidak menambah utang apa pun.
  //
  // Kalimat galatnya MENGIKUTI yang sudah dipakai PpicDashboardPage, bukan karangan baru.
  useEffect(() => {
    if (!isLeadership) return;
    let dibatalkan = false;

    const muat = async () => {
      try {
        const response = await authedFetch('/api/dashboard-summary');
        let data: Record<string, unknown>;
        try {
          data = await response.json();
        } catch {
          if (!dibatalkan) setSummaryError('Server memberi respons yang tidak dikenali (kemungkinan gangguan sesaat di layanan database). Coba lagi dalam beberapa saat.');
          return;
        }
        if (dibatalkan) return;
        if (!response.ok) {
          setSummaryError(typeof data.error === 'string' ? data.error : 'Gagal memuat ringkasan.');
          return;
        }
        setSummary(data as unknown as Summary);
        setSummaryError('');
      } catch (e) {
        if (!dibatalkan) {
          setSummaryError(
            e instanceof SesiTidakValid
              ? 'Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.'
              : 'Tidak bisa terhubung ke server. Coba lagi dalam beberapa saat.'
          );
        }
      } finally {
        // SATU-SATUNYA tempat pemuatan dihentikan. Ditaruh di `finally` supaya TIDAK ADA jalan
        // keluar dari fungsi ini yang meninggalkan kerangka abu-abu berputar selamanya.
        if (!dibatalkan) setSummaryLoading(false);
      }
    };

    void muat();
    // Menandai batal saat halaman ditinggalkan: jawaban yang datang terlambat tidak boleh
    // menulis ke komponen yang sudah tidak ada.
    return () => {
      dibatalkan = true;
    };
  }, [isLeadership, percobaanMuat]);

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

  // Saat pemuatan gagal, angkanya TIDAK diketahui — dan "tidak diketahui" bukan nol.
  // Versi sebelumnya menulis `nilai ?? 0`, yang berarti layar akan menampilkan empat angka
  // NOL dengan penuh percaya diri untuk data yang tidak pernah datang. Nol adalah jawaban;
  // tanda pisah adalah ketiadaan jawaban, dan bedanya penting bagi orang yang membacanya.
  const tampilkanAngka = (nilai: number | undefined) => (typeof nilai === 'number' ? nilai : '—');

  return (
    <div className="halaman">
      <div>
        <h1 className="halaman__judul">Ringkasan</h1>
        <p className="halaman__pengantar">
          Halo {userEmail ?? 'pengguna'}. Gunakan menu di kiri untuk membuka modul yang Anda perlukan.
        </p>
      </div>

      {error ? <InlineNotification kind="error" lowContrast title="Konfigurasi bermasalah" subtitle={error} hideCloseButton /> : null}
      {/* ActionableNotification, BUKAN InlineNotification berisi tombol.
          Percobaan pertama menaruh <Button> sebagai anak InlineNotification, dan Carbon
          MELEMPAR GALAT saat dirender: "component should have no interactive child nodes"
          (useNoInteractiveChildren, diverifikasi di paket terpasang). Akibatnya seluruh
          halaman gagal dirender — nol kartu, bukan sekadar tombol yang salah tempat.
          Komponen Carbon untuk pemberitahuan yang punya aksi memang ActionableNotification,
          dengan `actionButtonLabel` + `onActionButtonClick`.

          `inline` supaya rupanya sama dengan pemberitahuan lain di halaman ini.
          `hasFocus={false}` supaya fokus TIDAK direbut saat halaman baru dimuat — bawaannya
          true, dan itu tepat untuk galat yang muncul setelah aksi pengguna, bukan untuk galat
          yang sudah ada sejak halaman terbuka.
          `hideCloseButton` karena pesan GAGAL tidak boleh bisa hilang begitu saja: yang gagal
          memuat hal yang harus ditindaklanjuti. */}
      {summaryError ? (
        <ActionableNotification
          inline
          kind="error"
          lowContrast
          hasFocus={false}
          hideCloseButton
          title="Gagal memuat ringkasan"
          subtitle={summaryError}
          actionButtonLabel={summaryLoading ? 'Memuat…' : 'Muat ulang ringkasan'}
          onActionButtonClick={() => {
            setSummaryLoading(true);
            setPercobaanMuat((n) => n + 1);
          }}
        />
      ) : null}

      {isLeadership ? (
        <div className="kisi-metrik">
          {metrik.map((m) => (
            <Tile key={m.label}>
              <span className="metrik__label">{m.label}</span>
              {summaryLoading ? (
                <SkeletonText heading width="4rem" />
              ) : (
                <span className={`metrik__angka ${m.waspada ? 'metrik__angka--waspada' : ''}`}>{tampilkanAngka(m.nilai)}</span>
              )}
            </Tile>
          ))}
        </div>
      ) : null}
    </div>
  );
}
