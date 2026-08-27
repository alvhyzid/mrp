import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tanpaKomentar } from './util/tanpaKomentar';

// ============================================================================
// DS-09 — SATU KERANGKA HALAMAN, BUKAN SALINAN PER HALAMAN
// ============================================================================
// Aturan ini ditulis DS-09 sendiri, di detail pekerjaannya:
//
//   "kelas `halaman-*` untuk KERANGKA; kelas sendiri HANYA untuk yang khas halaman itu"
//
// dan alasannya juga sudah tertulis di sana:
//
//   "bila tiap halaman menyalin kerangkanya sendiri dengan awalan nama sendiri, cetakannya
//    tersalin 29 kali dan perbaikan berikutnya harus menemukan 29 tempat."
//
// ============================================================================
// KENAPA PENGAWAS INI PERLU, padahal hari ini semua layar terlihat sama
// ============================================================================
// Diukur di peramban 27 Agu 2026, 19 layar: remah roti di y=72, judul 28px di y=114,
// pencarian melipat selebar 48px, toolbar setinggi 48px — SERAGAM di 15 layar bertabel.
//
// Tetapi dua halaman mencapainya lewat jalur yang BERBEDA:
//   /items          -> `.item-halaman`, yang isinya SALINAN PERSIS `.halaman`
//   /company/setelan -> `.setelan-halaman`, yang padding-nya berbeda dan TANPA `gap`
//
// Yang pertama "kebetulan benar": nilainya sama karena disalin, bukan karena satu sumber.
// Begitu `.halaman` disetel ulang, /items — LAYAR ACUAN yang sudah disetujui pemilik
// produk — diam-diam berhenti cocok dengan seluruh layar lain, dan tidak ada yang berbunyi.
//
// Yang kedua salah terukur: remah rotinya 8px lebih tinggi dan judulnya 24px lebih tinggi
// daripada 18 layar lainnya.
//
// Pengawas ini menutup KELASNYA, bukan dua kejadiannya.
// ============================================================================

const AKAR = 'src/features';

function halamanInternal(): string[] {
  const out: string[] = [];
  for (const domain of readdirSync(AKAR)) {
    const p = join(AKAR, domain, 'pages');
    try {
      for (const f of readdirSync(p)) if (f.endsWith('.tsx')) out.push(join(p, f));
    } catch { /* domain tanpa folder pages */ }
  }
  // Hanya layar berkepala halaman. Layar publik (masuk, daftar, POD, cetak) memang
  // hidup DI LUAR kerangka aplikasi dan tidak memakai KepalaHalaman sama sekali.
  return out.filter((f) => /KepalaHalaman/.test(tanpaKomentar(readFileSync(f, 'utf8'))));
}

describe('DS-09 — kerangka halaman berasal dari SATU sumber bersama', () => {
  it('(a) setiap layar internal berkepala memakai pembungkus bersama `halaman`', () => {
    const pelanggar: string[] = [];
    for (const f of halamanInternal()) {
      const s = tanpaKomentar(readFileSync(f, 'utf8'));
      // Pembungkus bersama boleh dibarengi kelas khas halaman: className="halaman setelan-halaman".
      const pakaiBersama = /className="halaman(?:["\s])/.test(s) || /className={`halaman[\s`]/.test(s);
      if (!pakaiBersama) {
        const sendiri = [...new Set([...s.matchAll(/className="([a-z-]*halaman[a-z-]*)"/g)].map((m) => m[1]))];
        pelanggar.push(`${f} -> memakai ${sendiri.join(', ') || '(tidak terdeteksi)'}`);
      }
    }
    expect(pelanggar, `Layar yang menyalin kerangkanya sendiri:\n${pelanggar.join('\n')}`).toEqual([]);
  });

  it('(b) NOL kelas SCSS yang menduplikasi bentuk kerangka `.halaman`', () => {
    // Bentuk kerangka = padding tiga nilai + flex kolom + gap. Kelas lain yang menuliskan
    // keempatnya sekaligus hampir pasti salinan, bukan kebutuhan khas halaman.
    const scss: string[] = [];
    const sisir = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) sisir(p);
        else if (e.name.endsWith('.scss')) scss.push(p);
      }
    };
    sisir('app');
    sisir('src/styles');

    const pelanggar: string[] = [];
    for (const f of scss) {
      const isi = readFileSync(f, 'utf8');
      for (const m of isi.matchAll(/\.([a-z-]+)\s*\{([^}]*)\}/g)) {
        const nama = m[1];
        const badan = m[2];
        if (nama === 'halaman') continue; // sumbernya sendiri
        const punyaPadding = /padding:\s*spacing\.\$spacing-06\s+spacing\.\$spacing-05\s+spacing\.\$spacing-09/.test(badan);
        const punyaFlex = /flex-direction:\s*column/.test(badan) && /display:\s*flex/.test(badan);
        const punyaGap = /gap:\s*spacing\.\$spacing-05/.test(badan);
        if (punyaPadding && punyaFlex && punyaGap) pelanggar.push(`${f} -> .${nama}`);
      }
    }
    expect(pelanggar, `Kelas yang menyalin bentuk .halaman:\n${pelanggar.join('\n')}`).toEqual([]);
  });
});
