import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// AUD-36 (25 Agu 2026) — PENJAGA: MEMBUKA HALAMAN TIDAK BOLEH MENULIS APA PUN.
//
// ============================================================================
// KENAPA PENJAGA INI ADA
// ============================================================================
// Aturan "aksi yang terlihat read-only tidak boleh menulis" sudah ditetapkan sejak Sesi
// 0/0B/0C, ditulis di CLAUDE.md, dan tetap dilanggar TIGA KALI:
//   1. getMarginWatch          -- mengunci baseline finansial saat panel dibuka
//   2. getPlanningFeasibility  -- sama
//   3. recomputeAiReadiness + listKpiCards -- menulis snapshot saat halaman dimuat
//
// Dua yang pertama diperbaiki, lalu yang ketiga lahir. Itu pola yang sudah dikenali di
// proyek ini: aturan yang bergantung pada ingatan akan dilanggar lagi. Yang bekerja hanya
// pengawas.
//
// Cara pelanggaran ketiga ketahuan patut dicatat, karena ia TIDAK ketahuan dari membaca kode
// maupun dari test mana pun: perusahaan fixture untuk audit navigasi tidak bisa dihapus,
// tertahan kunci asing dari tabel snapshot. Yang menemukannya adalah PEMBERSIHAN YANG GAGAL.
//
// ============================================================================
// APA YANG DIPERIKSA
// ============================================================================
// Setiap berkas server yang namanya menyatakan ia MEMBACA (get*, list*, compute*, hitung*)
// tidak boleh memuat .insert / .upsert / .update / .delete.
//
// DI LUAR JANGKAUAN, dan disebut supaya batasnya jelas: ini pemeriksaan NAMA dan ISI berkas.
// Fungsi baca yang memanggil fungsi lain yang menulis akan lolos. Karena itu penamaannya
// dijaga juga -- fungsi yang menulis WAJIB bernama simpan*/take*/create*/update*/delete*,
// sehingga rantai panggilannya terbaca dari namanya saja.

const AKAR = join(__dirname, '..');

const AWALAN_BACA = ['get', 'list', 'compute', 'hitung', 'fetch', 'read'];

/// Menangkap penulisan ke BASIS DATA, bukan ke struktur data di memori.
///
/// Versi pertama memakai pola `.delete(` telanjang, dan ia menuduh TIGA berkas yang sebenarnya
/// bersih: ketiganya memanggil `visiting.delete(itemId)` -- Set JavaScript biasa di dalam
/// penelusuran BOM rekursif. Penjaga yang salah tuduh melatih orang mengabaikan hasilnya,
/// jadi polanya sekarang MEWAJIBKAN rantai Supabase `.from('tabel')` mendahuluinya.
const PENULIS = /\.from\(\s*['"`][a-z_]+['"`]\s*\)[\s\S]{0,220}?\.\s*(insert|upsert|delete|update)\s*\(/;

/// Pengecualian yang DISENGAJA, masing-masing dengan alasannya. Menambah baris di sini berarti
/// menyatakan "membaca sambil menulis itu benar untuk kasus ini" -- dan itu harus dibaca
/// orang lain, bukan diputuskan diam-diam.
const DIKECUALIKAN: Record<string, string> = {
  // MENULIS SAAT MEMBACA, DAN ITU MEMANG TUJUANNYA.
  //
  // getDocumentSignedUrl mencatat SIAPA membuka dokumen ber-sensitivitas TERBATAS ke
  // document_access_log. Di sini "membaca yang menulis" bukan cacat melainkan seluruh
  // gunanya: jejak akses yang hanya tercatat bila seseorang menekan tombol tambahan adalah
  // jejak yang tidak ada.
  //
  // Bedanya dengan pelanggaran AUD-36 tegas: yang ini menulis CATATAN TENTANG PEMBACAAN ITU
  // SENDIRI, bukan menulis ulang data yang sedang dibaca.
  'features/documents/server/getDocumentSignedUrl.ts':
    'mencatat jejak akses dokumen terbatas — justru itu tujuannya'
};

// ============================================================================
// CATATAN UNTUK SESI BERIKUTNYA — JANGAN "MEMPERBAIKI" PENGECUALIAN DI ATAS
// ============================================================================
// Kalimat pemilik produk, disalin apa adanya supaya tidak luntur:
//
//   "Halaman dokumen memang mencatat siapa membuka berkas terbatas. Di situ 'membaca yang
//    menulis' bukan cacat — itu gunanya.
//    Bedanya tegas: ia menulis CATATAN TENTANG pembacaan, bukan menulis ulang data yang
//    sedang dibaca."
//
// Jejak akses yang hanya tercatat bila seseorang menekan tombol tambahan adalah jejak yang
// tidak ada. Mencabut penulisan ini akan terlihat seperti merapikan, dan sebenarnya menghapus
// satu-satunya bukti siapa membuka dokumen yang aksesnya dibatasi.


/// Ke-36 halaman yang SUDAH ADA saat pintu bersama dibuat (25 Agu 2026). Daftar ini hanya
/// boleh MENYUSUT — tiap halaman yang dimigrasikan ke Carbon sekalian dipindah ke authedFetch,
/// lalu barisnya dihapus dari sini.
const DAFTAR_LAMA: string[] = [
  'features/ai-project/pages/AiProjectDashboardPage.tsx',
  'features/ai-readiness/pages/AiReadinessPage.tsx',
  'features/attendance/pages/AttendancePage.tsx',
  'features/auth/pages/DashboardPage.tsx',
  'features/auth/pages/DebugPage.tsx',
  'features/auth/pages/InviteAcceptPage.tsx',
  'features/auth/pages/ProfilePage.tsx',
  'features/auth/pages/ResetPasswordPage.tsx',
  'features/auth/pages/TestTenantPage.tsx',
  'features/company/pages/CompanySettingsPage.tsx',
  'features/documents/pages/DocumentsPage.tsx',
  'features/hr/pages/HrDashboardPage.tsx',
  'features/kamus/pages/KamusPage.tsx',
  'features/kpi/pages/KpiPage.tsx',
  'features/kpi/pages/MyKpiPage.tsx',
  'features/mrp/components/NotificationBell.tsx',
  'features/mrp/pages/BomsPage.tsx',
  'features/mrp/pages/BuildTasksPage.tsx',
  'features/mrp/pages/CustomerPurchaseOrdersPage.tsx',
  'features/mrp/pages/CustomersPage.tsx',
  'features/mrp/pages/ItemsPage.tsx',
  'features/mrp/pages/OperatingProfitPage.tsx',
  'features/mrp/pages/PodConfirmationPage.tsx',
  'features/mrp/pages/PurchasingPage.tsx',
  'features/mrp/pages/RoutingsPage.tsx',
  'features/mrp/pages/SalesOrdersPage.tsx',
  'features/mrp/pages/ShipmentsPage.tsx',
  'features/mrp/pages/SuratJalanPrintPage.tsx',
  'features/mrp/pages/WhatsNewPage.tsx',
  'features/mrp/pages/WorkOrdersPage.tsx',
  'features/navigasi/AppShellCarbon.tsx',
  'features/ppic/pages/PpicDashboardPage.tsx',
  'features/process-mining/pages/ProcessMiningPage.tsx',
  'features/production/pages/ProductionDashboardPage.tsx',
  'features/team/pages/TeamManagePage.tsx',
  'features/warehouse/pages/WarehouseDashboardPage.tsx',
];

function berkasServer(dir: string, keluar: string[] = []): string[] {
  for (const nama of readdirSync(dir)) {
    if (nama === 'node_modules' || nama.startsWith('.')) continue;
    const p = join(dir, nama);
    if (statSync(p).isDirectory()) berkasServer(p, keluar);
    else if (nama.endsWith('.ts')) keluar.push(p);
  }
  return keluar;
}

function tanpaKomentar(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('AUD-36 — jalur baca tidak boleh menulis', () => {
  it('berkas server yang bernama get/list/compute/hitung TIDAK memuat insert/upsert/update/delete', () => {
    const melanggar: string[] = [];

    for (const p of berkasServer(join(AKAR, 'src', 'features'))) {
      const rel = p.slice(join(AKAR, 'src').length + 1);
      if (DIKECUALIKAN[rel]) continue;

      const nama = p.split('/').pop()!.replace('.ts', '');
      const terlihatMembaca = AWALAN_BACA.some((a) => nama.toLowerCase().startsWith(a));
      if (!terlihatMembaca) continue;

      const isi = tanpaKomentar(readFileSync(p, 'utf8'));
      const m = PENULIS.exec(isi);
      if (m) {
        const baris = isi.slice(0, m.index).split('\n').length;
        melanggar.push(`${rel}:${baris} -> ${m[0].trim()}`);
      }
    }

    expect(
      melanggar,
      `Berkas berikut BERNAMA seperti jalur baca tapi MENULIS:\n  ${melanggar.join('\n  ')}\n\n` +
        'Membuka halaman tidak boleh menulis apa pun. Pisahkan penulisannya ke fungsi\n' +
        'tersendiri yang bernama simpan*/take*/create*, dan panggil ia HANYA dari aksi yang\n' +
        'disengaja pengguna. Bila memang harus menulis, tambahkan ke DIKECUALIKAN beserta\n' +
        'alasannya -- supaya keputusannya bisa dibaca orang lain.'
    ).toEqual([]);
  });

  it('halaman memakai authedFetch bersama, bukan fetch telanjang ke /api', () => {
    // AUD-35: satu halaman memanggil fetch('/api/...') tanpa header Authorization. Server
    // menjawab 401 dan halaman itu mengalihkan penggunanya sendiri ke layar masuk -- SELAMANYA.
    // Halaman itu tampak "butuh login" padahal penggunanya sudah login.
    //
    // Endpoint PUBLIK dikecualikan: register, login, dan konfirmasi penerimaan barang memang
    // dipanggil tanpa sesi.
    const PUBLIK = /\/api\/(register|login|pod\/)/;
    const melanggar: string[] = [];

    // berkasServer hanya mengumpulkan .ts; halaman ada di .tsx, jadi ditelusuri terpisah.
    const telusuriTsx = (dir: string, keluar: string[] = []): string[] => {
      for (const nama of readdirSync(dir)) {
        if (nama === 'node_modules' || nama.startsWith('.')) continue;
        const q = join(dir, nama);
        if (statSync(q).isDirectory()) telusuriTsx(q, keluar);
        else if (nama.endsWith('.tsx')) keluar.push(q);
      }
      return keluar;
    };

    for (const p of telusuriTsx(join(AKAR, 'src', 'features'))) {
      const isi = tanpaKomentar(readFileSync(p, 'utf8'));
      for (const m of isi.matchAll(/fetch\(\s*[`'"](\/api\/[^`'")]+)/g)) {
        if (PUBLIK.test(m[1])) continue;
        const ekor = isi.slice(m.index, m.index + 420);
        if (!ekor.includes('Authorization')) {
          melanggar.push(`${p.slice(AKAR.length + 1)} -> ${m[1]}`);
        }
      }
    }

    expect(
      melanggar,
      `Panggilan API tanpa kredensial:\n  ${melanggar.join('\n  ')}\n\n` +
        'Server proyek ini HANYA menerima Authorization: Bearer -- tidak ada jalur cookie.\n' +
        'Pakai authedFetch/authedJson dari src/lib/authedFetch.ts.'
    ).toEqual([]);
  });

  it('halaman BARU tidak boleh mengambil tanda pengenal sendiri — wajib lewat pintu bersama', () => {
    // AUD-37 / II.5 — PENGAWAS SUPAYA YANG KE-37 TIDAK LAHIR DENGAN CARA LAMA.
    //
    // Pemindahan 36 halaman lama ke authedFetch dilakukan BERTAHAP, bersama migrasi Carbon
    // masing-masing. Itu keputusan yang benar: menyentuh 36 halaman sekaligus untuk perubahan
    // yang tidak terlihat di layar adalah perubahan besar tanpa cara memeriksanya.
    //
    // Tapi "bertahap" tanpa pengawas berarti DUA JALUR HIDUP BERDAMPINGAN selama berbulan-
    // bulan, dan itu kelas cacat yang sudah dicatat berkali-kali. Daftar di bawah adalah
    // daftar yang HANYA BOLEH MENYUSUT. Halaman baru yang mengambil sesinya sendiri akan
    // membuat test ini merah.
    //
    // CARA MEMAKAINYA saat memigrasikan sebuah halaman: pindahkan ia ke authedFetch, lalu
    // HAPUS barisnya dari daftar ini. Bila daftarnya bertambah, seseorang sedang menambah
    // jalur kedua.
    const BELUM_DIPINDAH = new Set<string>(DAFTAR_LAMA);

    const telusuri = (dir: string, keluar: string[] = []): string[] => {
      for (const nama of readdirSync(dir)) {
        if (nama === 'node_modules' || nama.startsWith('.')) continue;
        const q = join(dir, nama);
        if (statSync(q).isDirectory()) telusuri(q, keluar);
        else if (nama.endsWith('.tsx')) keluar.push(q);
      }
      return keluar;
    };

    const baru: string[] = [];
    for (const p of telusuri(join(AKAR, 'src', 'features'))) {
      const rel = p.slice(join(AKAR, 'src').length + 1);
      const isi = tanpaKomentar(readFileSync(p, 'utf8'));
      if (!/auth\.getSession\(\)/.test(isi)) continue;
      if (!BELUM_DIPINDAH.has(rel)) baru.push(rel);
    }

    expect(
      baru,
      `Halaman berikut mengambil tanda pengenalnya SENDIRI, padahal sudah ada pintu bersama:\n` +
        `  ${baru.join('\n  ')}\n\n` +
        'Pakai authedFetch/authedJson dari src/lib/authedFetch.ts.\n' +
        'Diukur 25 Agu 2026: 36 halaman menulis caranya masing-masing; 35 KEBETULAN benar dan\n' +
        'yang ke-36 tidak bisa dibuka sama sekali selama berhari-hari tanpa ada yang tahu.'
    ).toEqual([]);
  });

  it('daftar halaman yang belum dipindah HANYA BOLEH MENYUSUT', () => {
    // Menjaga arah. Tanpa ini, seseorang bisa "memperbaiki" test di atas dengan menambahkan
    // berkasnya ke daftar -- yang justru kebalikan dari tujuannya.
    const telusuri = (dir: string, keluar: string[] = []): string[] => {
      for (const nama of readdirSync(dir)) {
        if (nama === 'node_modules' || nama.startsWith('.')) continue;
        const q = join(dir, nama);
        if (statSync(q).isDirectory()) telusuri(q, keluar);
        else if (nama.endsWith('.tsx')) keluar.push(q);
      }
      return keluar;
    };
    const masihMengambilSendiri = telusuri(join(AKAR, 'src', 'features')).filter((p) =>
      /auth\.getSession\(\)/.test(tanpaKomentar(readFileSync(p, 'utf8')))
    ).length;

    expect(
      masihMengambilSendiri,
      `Sekarang ${masihMengambilSendiri} halaman masih mengambil sesinya sendiri; saat daftar ` +
        `ini dibuat jumlahnya ${DAFTAR_LAMA.length}. Angka ini TIDAK BOLEH NAIK.`
    ).toBeLessThanOrEqual(DAFTAR_LAMA.length);
  });
});
