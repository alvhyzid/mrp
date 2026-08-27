import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { tanpaKomentar } from './util/tanpaKomentar';

// ============================================================================
// DS-21 — INDIKATOR LANGKAH MODAL BERTAHAP TIDAK BOLEH MELUBER DI LAYAR SEMPIT
// ============================================================================
// Terukur 26-27 Agu 2026 di viewport 360px, luber melewati tepi kanan isi modal:
//   BOM (2 langkah) 0px · Master Item (3) 42px · Karyawan (3) 42px · PO Klien (4) 170px
//
// PENYEBABNYA SATU BARIS CSS MILIK CARBON, dan aritmetikanya mereproduksi ketiga angka:
//   .cds--progress--space-equal .cds--progress-step { min-inline-size: 8rem }  = lantai 128px
//   lebar isi modal di 360px = 358px
//   N=2 -> 16+256=272 <= 358 -> 0     N=3 -> 16+384=400 -> 42     N=4 -> 16+512=528 -> 170
//
// JAWABANNYA MILIK CARBON JUGA, bukan karangan kita:
//   .cds--progress--vertical .cds--progress-step { min-inline-size: initial }
// dan ProgressIndicator.js sendiri menonaktifkan spaceEqually saat vertical.
//
// ============================================================================
// KENAPA UJI INI MEMBACA SUMBER, BUKAN MERENDER
// ============================================================================
// Repo ini sengaja tidak punya infrastruktur uji peramban (lihat catatan yang sama di
// tests/detail_expandable_items.test.ts). Yang dijaga di sini adalah ATURAN YANG
// MENGHASILKAN perilakunya; bukti perilakunya diukur di peramban dan dilaporkan terpisah
// di docs/ux/FABRIX_MODAL_FORM_FINAL_EVIDENCE.md.
// ============================================================================

const KOMPONEN = 'src/components/ui/modal-bertahap.tsx';
const KAIT = 'src/lib/useMediaQuery.ts';

/// Consumer PenandaLangkah — keempatnya adalah formulir yang diukur meluber.
const CONSUMER = [
  'src/features/mrp/pages/BomsPage.tsx',
  'src/features/mrp/pages/CustomerPurchaseOrdersPage.tsx',
  'src/features/mrp/pages/ItemsPage.tsx',
  'src/features/hr/pages/HrDashboardPage.tsx'
];

describe('DS-21 — penanda langkah responsif', () => {
  const src = tanpaKomentar(readFileSync(KOMPONEN, 'utf8'));

  it('(a) penanda langkah berubah jadi VERTIKAL di bawah breakpoint md Carbon', () => {
    // Varian vertical Carbon mencabut lantai 8rem sepenuhnya. Tanpa ini, langkahnya tidak
    // bisa menyusut dan luberannya kembali persis seperti semula.
    expect(src, 'PenandaLangkah harus meminta varian vertical Carbon').toMatch(/vertical/);

    // Ambangnya DIHITUNG dari jumlah langkah, bukan satu angka tetap untuk semua formulir.
    // Satu ambang tetap terbukti mengenakan 88px ruang terbuang pada BOM di 360px --
    // formulir yang penandanya tidak pernah meluber.
    expect(
      src,
      'ambang harus dihitung dari jumlah langkah, bukan konstanta tunggal'
    ).toMatch(/jumlahLangkah \* LANTAI_LANGKAH_PX/);
  });

  it('(b) spaceEqually TIDAK dipakai saat vertikal', () => {
    // ProgressIndicator.js baris 49: [space-equal]: spaceEqually && !vertical — Carbon
    // memperlakukan keduanya saling meniadakan. Menyalakan keduanya sekaligus membuat
    // pembacanya mengira space-equal masih berlaku padahal tidak.
    // Versi pertama uji ini mencari kata "vertical" di sekitar "spaceEqually" dan MENUDUH
    // SALAH: yang mengikat keduanya bukan kedekatan teks, melainkan SATU VARIABEL yang
    // dipakai keduanya dengan tanda berlawanan. Diperketat ke aturan itu.
    const sEqual = src.match(/spaceEqually=\{([^}]+)\}/);
    const sVert = src.match(/vertical=\{([^}]+)\}/);
    expect(sEqual, 'spaceEqually harus bernilai ekspresi, bukan dipatok mati').not.toBeNull();
    expect(sVert, 'vertical harus bernilai ekspresi').not.toBeNull();

    const nilaiEqual = sEqual![1].trim();
    const nilaiVert = sVert![1].trim();
    expect(nilaiEqual, 'spaceEqually tidak boleh dipatok true').not.toBe('true');
    expect(
      nilaiVert,
      'vertical harus kebalikan PERSIS dari spaceEqually — dua kondisi terpisah bisa menyimpang'
    ).toBe('!' + nilaiEqual);
  });

  it('(a2) lantai 128px DIVERIFIKASI dari paket Carbon terpasang, bukan ditulis dari ingatan', () => {
    // Bila Carbon mengubah min-inline-size, ambang yang dihitung ikut meleset dan luberannya
    // kembali persis seperti sebelum DS-21 -- tanpa satu pun test lain yang berbunyi.
    // Uji ini mengikat konstanta di kode ke nilai yang benar-benar dipancarkan paket.
    const scssCarbon = readFileSync(
      'node_modules/@carbon/styles/scss/components/progress-indicator/_progress-indicator.scss',
      'utf8'
    );
    const i = scssCarbon.indexOf('--progress--space-equal');
    expect(i, 'aturan space-equal Carbon tidak ditemukan — paketnya berubah').toBeGreaterThan(-1);
    const blokCarbon = scssCarbon.slice(i, i + 220);
    const m = blokCarbon.match(/min-inline-size:\s*([\d.]+)rem/);
    expect(m, 'lantai min-inline-size tidak ditemukan di aturan space-equal').not.toBeNull();

    const lantaiPx = Number(m![1]) * 16;
    const dipakai = src.match(/LANTAI_LANGKAH_PX\s*=\s*(\d+)/);
    expect(dipakai, 'LANTAI_LANGKAH_PX tidak ditemukan di komponen').not.toBeNull();
    expect(
      Number(dipakai![1]),
      `lantai di kode (${dipakai![1]}px) tidak sama dengan lantai Carbon terpasang (${lantaiPx}px)`
    ).toBe(lantaiPx);
  });

  it('(c) perbaikannya BUKAN pemotongan — nol overflow-x hidden di jalur modal bertahap', () => {
    // Memotong penanda langkah menyembunyikan berapa langkah tersisa. Itu mengganti satu
    // cacat dengan cacat yang lebih sulit dilihat, dan dilarang eksplisit di DS-21.
    expect(src).not.toMatch(/overflow-x:\s*hidden/);
    expect(src).not.toMatch(/overflow:\s*hidden/);
    for (const berkas of CONSUMER) {
      const isi = tanpaKomentar(readFileSync(berkas, 'utf8'));
      const iPenanda = isi.indexOf('PenandaLangkah');
      expect(iPenanda, `${berkas} harus tetap memakai PenandaLangkah bersama`).toBeGreaterThan(-1);
    }
  });

  it('(d) kait media query hidup di SATU tempat bersama, bukan disalin per halaman', () => {
    // Kelas cacat "dua jalur hidup" sudah lima kali terjadi di proyek ini. Kait yang disalin
    // empat kali akan menyimpang persis seperti 88 warna dan 36 pengambil tanda pengenal.
    expect(existsSync(KAIT), `${KAIT} harus ada sebagai satu-satunya kait media query`).toBe(true);
    const kait = tanpaKomentar(readFileSync(KAIT, 'utf8'));
    expect(kait).toMatch(/matchMedia/);

    // Nol pemakai matchMedia di luar kait itu.
    const penyalin = CONSUMER.concat([KOMPONEN]).filter((f) =>
      /matchMedia/.test(tanpaKomentar(readFileSync(f, 'utf8')))
    );
    expect(penyalin, `matchMedia hanya boleh di ${KAIT}`).toEqual([]);
  });

  it('(e) kait aman dirender di server — window tidak disentuh saat render pertama', () => {
    // Next.js merender komponen ini di server lebih dulu. Menyentuh window di badan komponen
    // (bukan di dalam useEffect) melempar galat dan mematikan seluruh halaman.
    const kait = tanpaKomentar(readFileSync(KAIT, 'utf8'));

    // useSyncExternalStore, BUKAN useState + useEffect. Versi pertama kait ini memakai
    // useState + useEffect dan menambah satu masalah lint baru (react-hooks/set-state-in-effect).
    // API ini juga yang memberi jalur render-server tersendiri lewat argumen ketiganya.
    expect(
      kait,
      'kait harus memakai useSyncExternalStore — API React untuk sumber di luar React'
    ).toMatch(/useSyncExternalStore/);
    expect(
      kait,
      'wajib menyediakan potret untuk render server (argumen ketiga)'
    ).toMatch(/potretServer|getServerSnapshot/);
    expect(
      kait,
      'tidak boleh ada setState di dalam effect — itulah yang diperbaiki'
    ).not.toMatch(/useEffect/);

    // Yang menentukan aman-tidaknya BUKAN urutan baris, melainkan ADANYA penjaga
    // `typeof window` sebelum setiap sentuhan. Versi pertama uji ini menuntut
    // window.matchMedia muncul SESUDAH useEffect — aturan itu keliru: ia melarang
    // penginisialisasi malas yang justru menghapus kedipan tata letak saat modal dibuka,
    // sambil tetap aman di server. Penjaga yang salah tuduh diperketat, bukan dibiarkan.
    const sentuhan = [...kait.matchAll(/window\.matchMedia/g)].length;
    const penjaga = [...kait.matchAll(/typeof window === 'undefined'/g)].length;
    expect(sentuhan, 'kait harus benar-benar memakai window.matchMedia').toBeGreaterThan(0);
    expect(
      penjaga,
      'setiap jalur yang menyentuh window wajib didahului penjaga typeof window'
    ).toBeGreaterThanOrEqual(2);
  });
});
