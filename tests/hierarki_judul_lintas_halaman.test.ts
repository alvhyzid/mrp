// DS-23 — PENJAGA HIERARKI JUDUL LINTAS HALAMAN.
//
// ============================================================================
// KENAPA BERKAS INI ADA
// ============================================================================
// Judul yang melompat tingkat (h1 lalu langsung h4) tidak terlihat sama sekali di layar --
// ukurannya diatur KELAS, bukan tag. Yang membacanya adalah pembaca layar, dan bagi
// penggunanya lompatan itu berarti "ada bagian yang terlewat". Cacat ini karena itu
// mustahil ditemukan lewat tangkapan layar, dan hanya bisa dijaga oleh penyisir.
//
// ============================================================================
// APA YANG SUDAH DIUKUR, supaya angka di bawah tidak dikira tebakan
// ============================================================================
// Diukur dari paket @carbon/react yang benar-benar terpasang, 28 Agu 2026:
//   1. `KepalaHalaman` (src/components/ui/kepala-halaman.tsx) memancarkan <h1>.
//      `LayarPublik` memancarkan <h1>. Halaman TIDAK menulis <h1> sendiri -- itulah
//      sebabnya sensus mentah "33 halaman tanpa h1" dulu SALAH: h1-nya ada, hanya tidak
//      di berkas halamannya.
//   2. `ModalHeader` Carbon memancarkan **DUA <h2>**: satu untuk `label`, satu untuk
//      `title` (ComposedModal/ModalHeader.js). `Modal` polos juga memakai as="h2".
//      Jadi judul PERTAMA di dalam badan modal adalah h3, BUKAN h2.
//   3. `TableContainer` adalah `Section` Carbon, tetapi repo ini TIDAK memberinya `title`,
//      jadi ia tidak memancarkan judul apa pun.
//
// ============================================================================
// BATAS PENJAGA INI -- disebut karena diam soal ini memberi rasa aman yang keliru
// ============================================================================
// Penjaga ini memeriksa HIMPUNAN tingkat yang dipakai, BUKAN urutan kemunculannya.
// Alasannya bukan kemalasan: urutan SUMBER bukan urutan DOM. Fungsi `renderDetailWo`,
// `detailBom`, dan `renderItemDetail` ditulis di ATAS berkas tetapi tampil di DALAM baris
// tabel yang jauh di bawahnya. Penjaga yang membaca urutan sumber akan melapor terbalik.
//
// INI MENANGKAP: tingkat yang hilang di tengah (h1 lalu h4 tanpa h2/h3) -- yaitu seluruh
// bentuk yang ditemukan DS-23.
// INI TIDAK MENANGKAP: h2 lalu h4 pada halaman yang KEBETULAN juga memakai h3 di tempat
// lain. Untuk itu dibutuhkan pemeriksaan DOM di peramban, dan itu memang dijalankan
// terpisah saat DS-23 dikerjakan.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tanpaKomentar } from './util/tanpaKomentar';

const AKAR = join(process.cwd(), 'src', 'features');

function berkasHalaman(dir: string): string[] {
  const keluar: string[] = [];
  for (const nama of readdirSync(dir)) {
    const penuh = join(dir, nama);
    if (statSync(penuh).isDirectory()) keluar.push(...berkasHalaman(penuh));
    else if (penuh.includes(`${'pages'}/`) && nama.endsWith('.tsx')) keluar.push(penuh);
  }
  return keluar;
}

const HALAMAN = berkasHalaman(AKAR).sort();

/// Rentang [awal, akhir) tiap modal Carbon di dalam sebuah berkas.
function rentangModal(s: string): [number, number][] {
  const hasil: [number, number][] = [];
  for (const nama of ['ComposedModal', 'Modal']) {
    const buka = new RegExp(`<${nama}[\\s>]`, 'g');
    for (const m of s.matchAll(buka)) {
      const tutup = s.indexOf(`</${nama}>`, m.index);
      if (tutup !== -1) hasil.push([m.index, tutup]);
    }
  }
  return hasil;
}

type Judul = { tingkat: number; indeks: number; dalamModal: boolean };

function judulDi(s: string): Judul[] {
  const modal = rentangModal(s);
  return [...s.matchAll(/<h([1-6])[\s>]/g)].map((m) => ({
    tingkat: Number(m[1]),
    indeks: m.index,
    dalamModal: modal.some(([a, b]) => m.index > a && m.index < b)
  }));
}

/// Blok `if (... accessDenied ...) { ... }` -- cabang yang saling meniadakan dengan cabang
/// normal, jadi <h1> di dalamnya TIDAK PERNAH tampil bersama <h1> dari KepalaHalaman.
function rentangPenolakan(s: string): [number, number][] {
  const hasil: [number, number][] = [];
  for (const m of s.matchAll(/if\s*\([^)]*(accessDenied|ditolak)[^)]*\)\s*\{/g)) {
    let i = m.index + m[0].length;
    let dalam = 1;
    while (i < s.length && dalam > 0) {
      if (s[i] === '{') dalam += 1;
      else if (s[i] === '}') dalam -= 1;
      i += 1;
    }
    hasil.push([m.index, i]);
  }
  return hasil;
}

function celah(tingkat: number[]): number | null {
  const unik = [...new Set(tingkat)].sort((a, b) => a - b);
  for (let i = 1; i < unik.length; i += 1) if (unik[i] - unik[i - 1] > 1) return unik[i - 1];
  return null;
}

describe('DS-23 — hierarki judul lintas halaman', () => {
  it('(a) sumber <h1> bersama masih memancarkan h1 — kalau ini berubah, seluruh penjaga di bawah ikut salah', () => {
    for (const berkas of ['kepala-halaman.tsx', 'layar-publik.tsx']) {
      const isi = tanpaKomentar(readFileSync(join(process.cwd(), 'src', 'components', 'ui', berkas), 'utf8'));
      expect(isi, `${berkas} harus memancarkan <h1>`).toMatch(/<h1[\s>]/);
    }
  });

  it('(b) judul di luar modal tidak melompati tingkat', () => {
    const gagal: string[] = [];
    for (const berkas of HALAMAN) {
      const s = tanpaKomentar(readFileSync(berkas, 'utf8'));
      const punyaKepala = /<KepalaHalaman[\s>]|<LayarPublik[\s>]/.test(s);
      const tingkat = judulDi(s).filter((j) => !j.dalamModal).map((j) => j.tingkat);
      if (!tingkat.length) continue;
      const semua = punyaKepala ? [1, ...tingkat] : tingkat;
      const c = celah(semua);
      if (c !== null) gagal.push(`${berkas.replace(process.cwd() + '/', '')}: tingkat dipakai [${[...new Set(semua)].sort().join(',')}], hilang h${c + 1}`);
    }
    expect(gagal, `halaman dengan lompatan tingkat:\n${gagal.join('\n')}`).toEqual([]);
  });

  it('(c) judul di dalam modal mulai dari h3 — ModalHeader Carbon sudah memancarkan h2', () => {
    const gagal: string[] = [];
    for (const berkas of HALAMAN) {
      const s = tanpaKomentar(readFileSync(berkas, 'utf8'));
      const tingkat = judulDi(s).filter((j) => j.dalamModal).map((j) => j.tingkat);
      if (!tingkat.length) continue;
      const terkecil = Math.min(...tingkat);
      if (terkecil !== 3) gagal.push(`${berkas.replace(process.cwd() + '/', '')}: judul tertinggi di modal h${terkecil}, seharusnya h3`);
      const c = celah([2, ...tingkat]);
      if (c !== null) gagal.push(`${berkas.replace(process.cwd() + '/', '')}: modal melompati h${c + 1}`);
    }
    expect(gagal, `modal dengan tingkat salah:\n${gagal.join('\n')}`).toEqual([]);
  });

  it('(d) <h1> mentah hanya boleh di cabang penolakan akses, tidak pernah di cabang normal', () => {
    const gagal: string[] = [];
    for (const berkas of HALAMAN) {
      const s = tanpaKomentar(readFileSync(berkas, 'utf8'));
      if (!/<KepalaHalaman[\s>]|<LayarPublik[\s>]/.test(s)) continue;
      const tolak = rentangPenolakan(s);
      for (const j of judulDi(s)) {
        if (j.tingkat !== 1) continue;
        if (!tolak.some(([a, b]) => j.indeks > a && j.indeks < b)) {
          gagal.push(`${berkas.replace(process.cwd() + '/', '')}: <h1> mentah di luar cabang penolakan akses`);
        }
      }
    }
    expect(gagal, `judul ganda yang benar-benar tampil bersamaan:\n${gagal.join('\n')}`).toEqual([]);
  });

  // KOMPONEN CARBON YANG MEMAKU TINGKAT JUDULNYA -- diukur dari paket terpasang,
  // 28 Agu 2026. Angka ini BUKAN pilihan kita dan tidak bisa ditimpa lewat properti:
  //   FileUploader (labelTitle) -> as="h3"   (FileUploader.js:202)
  //   Modal / ModalHeader       -> as="h2"   (sudah dijaga uji (c))
  // FileUploaderButton memancarkan NOL judul, jadi ia sengaja TIDAK ikut disisir --
  // memasukkannya akan menuduh ProfilePage dan ShipmentsPage tanpa sebab.
  const TINGKAT_CARBON = 3;

  it('(f) judul bawaan Carbon tidak boleh LEBIH TINGGI daripada judul yang membungkusnya', () => {
    const gagal: string[] = [];
    for (const berkas of HALAMAN) {
      const s = tanpaKomentar(readFileSync(berkas, 'utf8'));
      for (const m of s.matchAll(/<FileUploader[\s>]/g)) {
        const potongan = s.slice(m.index, m.index + 400);
        if (!/labelTitle\s*=/.test(potongan)) continue;
        const sebelum = judulDi(s).filter((j) => j.indeks < m.index);
        if (!sebelum.length) continue;
        const induk = sebelum[sebelum.length - 1];
        if (induk.tingkat > TINGKAT_CARBON) {
          gagal.push(
            `${berkas.replace(process.cwd() + '/', '')}: FileUploader memancarkan h${TINGKAT_CARBON}, ` +
              `tetapi judul terdekat di atasnya h${induk.tingkat} — anak jadi LEBIH TINGGI daripada induknya`
          );
        }
      }
    }
    expect(gagal, `pembalikan tingkat judul:\n${gagal.join('\n')}`).toEqual([]);
  });

  it('(e) enam halaman yang diperbaiki DS-23 memakai tingkat yang sudah diverifikasi', () => {
    const HARAPAN: Record<string, number[]> = {
      'mrp/pages/BomsPage.tsx': [2, 3],
      'mrp/pages/CustomerPurchaseOrdersPage.tsx': [2, 3],
      'mrp/pages/ItemsPage.tsx': [2, 3],
      'mrp/pages/PurchasingPage.tsx': [2, 3],
      'mrp/pages/WorkOrdersPage.tsx': [2],
      'production/pages/ProductionDashboardPage.tsx': [2, 3],
      // /routing TIDAK ada di sebelas temuan awal. Penjaga (c) yang menemukannya: judul di
      // dalam modalnya h2, bertabrakan dengan h2 yang SUDAH dipancarkan ModalHeader Carbon.
      // Bentuknya berbeda dari yang lain -- bukan lompatan, melainkan tingkat KEMBAR -- dan
      // itulah sebabnya pembacaan sumber melewatkannya.
      'mrp/pages/RoutingsPage.tsx': [3]
    };
    for (const [sisa, harap] of Object.entries(HARAPAN)) {
      const s = tanpaKomentar(readFileSync(join(AKAR, sisa), 'utf8'));
      const dipakai = [...new Set(judulDi(s).map((j) => j.tingkat))].sort((a, b) => a - b);
      expect(dipakai, `${sisa} memakai tingkat judul`).toEqual(harap);
    }
  });
});
