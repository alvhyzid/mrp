import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// DS-02 (25 Agu 2026) — PENJAGA layar publik yang sudah dimigrasikan ke Carbon.
//
// KENAPA PENJAGA INI ADA:
//
// Ketujuh layar publik baru saja dibersihkan dari 22 warna heksadesimal yang ditulis tangan,
// belasan elemen HTML mentah, dan dua sistem visual yang berjalan bersamaan. Semuanya bersih
// HARI INI. Yang tidak bersih dengan sendirinya adalah BESOK: satu halaman baru yang ditulis
// dengan pola lama, atau satu `<button>` yang diselipkan ke halaman lama, dan seluruh
// pekerjaan ini kembali jadi "sudah diterapkan" yang sebenarnya berlubang.
//
// Ini bukan kehati-hatian teoretis. Persis itu yang terjadi pada RSP-01 (memperbaiki komponen
// tabel bersama, meninggalkan 8 halaman yang menulis tabelnya sendiri) dan pada aturan
// bantuan-klik (aturannya ditulis, komponennya dibuat, 18 tempat tetap memakai tooltip hover).
// Aturan yang harus diingat setiap kali menulis JSX akan dilanggar. Penjaga tidak.
//
// DI LUAR JANGKAUAN, supaya batasnya jelas: ini memeriksa KODE SUMBER. Ia tidak bisa melihat
// bagaimana halamannya tampak, dan tidak bisa menggantikan perbandingan berdampingan dengan
// katalog Carbon yang hanya bisa dilakukan pemilik produk.

const AKAR = join(__dirname, '..');

/// Layar yang SUDAH dimigrasikan. Menambah halaman publik baru berarti menambahnya ke sini —
/// dan bila ia belum Carbon, test ini yang akan memberitahu, bukan pemilik produk.
const LAYAR_PUBLIK = [
  'src/features/auth/pages/HomePage.tsx',
  'src/features/auth/pages/LoginPage.tsx',
  'src/features/auth/pages/RegisterPage.tsx',
  'src/features/auth/pages/ForgotPasswordPage.tsx',
  'src/features/auth/pages/ResetPasswordPage.tsx',
  'src/features/auth/pages/InviteAcceptPage.tsx',
  'src/features/mrp/pages/PodConfirmationPage.tsx'
];

function isi(p: string): string {
  return readFileSync(join(AKAR, p), 'utf8');
}

/// Membuang komentar sebelum mencari elemen mentah.
///
/// Bukan kerapian: versi pertama penjaga ini MENUDUH PodConfirmationPage menulis `<input>`
/// mentah, padahal yang ditemukannya adalah kata `<input type="file">` di dalam kalimat
/// penjelasan. Penjaga yang salah tuduh sama merepotkannya dengan penjaga yang kelewatan —
/// keduanya melatih orang untuk mengabaikan hasilnya.
function tanpaKomentar(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// Penjaga ini SEBELUMNYA mencari kata "carbon.scss" di mana pun di dalam berkas, termasuk di
// dalam KOMENTAR. Ia menuduh src/components/ui/notifikasi.tsx mengimpor CSS Carbon padahal
// berkas itu cuma MENYEBUT nama berkasnya untuk menjelaskan di mana gayanya tinggal.
//
// Ini bentuk salah tuduh KEEMPAT dengan pola yang sama persis di proyek ini: penjaga
// mencocokkan teks tanpa membedakan KODE dari PENJELASAN. Yang sebelumnya: kata "input" di
// kalimat penjelasan halaman POD, `visiting.delete(...)` yang dikira penulisan ke basis data,
// dan `value={docForm.doc_type}` pada <CarbonSelect>.
//
// Aturan proyek: penjaga yang salah tuduh DIPERKETAT, bukan dibiarkan -- penjaga yang keliru
// melatih orang mengabaikan hasilnya, dan sejak saat itu ia tidak menjaga apa pun sambil
// tetap terlihat menjaga.
//
// BATASNYA, disebut supaya tidak dikira lebih pintar dari kenyataannya: ini masih pencocokan
// teks, bukan parser. Ia sekarang membuang komentar lebih dulu dan mensyaratkan bentuk
// pernyataan impor yang sungguhan -- tidak lebih dari itu.
function mengimporCarbonCss(isi: string): boolean {
  const tanpaKomentar = isi
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  return /import\s+['"][^'"]*carbon\.scss['"]/.test(tanpaKomentar);
}

describe('DS-02 — layar publik tetap Carbon', () => {
  it('setiap layar publik memakai komponen Carbon, bukan komponen bersama lama', () => {
    const melanggar: string[] = [];
    for (const p of LAYAR_PUBLIK) {
      const s = isi(p);
      if (!s.includes("from '@carbon/react'")) melanggar.push(`${p}: tidak mengimpor @carbon/react`);
      if (/from '@\/components\/ui\/(button|input|card|select|badge|dialog|data-table)'/.test(s)) {
        melanggar.push(`${p}: masih mengimpor komponen bersama lama`);
      }
    }
    expect(melanggar, melanggar.join('\n')).toEqual([]);
  });

  it('NOL elemen HTML mentah di layar publik', () => {
    const melanggar: string[] = [];
    for (const p of LAYAR_PUBLIK) {
      const s = tanpaKomentar(isi(p));
      // <img> DIKECUALIKAN dengan alasan: pratinjau foto di halaman POD memakai blob URL dari
      // berkas yang baru dipilih di perangkat, bukan gambar yang dilayani server. next/image
      // tidak bisa mengoptimalkan yang belum pernah ada di server mana pun.
      for (const tag of ['button', 'input', 'table', 'select', 'textarea']) {
        const n = (s.match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length;
        if (n > 0) melanggar.push(`${p}: ${n} <${tag}> mentah`);
      }
    }
    expect(
      melanggar,
      `Elemen HTML mentah di layar publik:\n${melanggar.join('\n')}\n` +
        'Pakai komponen Carbon. Elemen mentah tidak ikut berubah saat Carbon diperbarui, dan ' +
        'tidak membawa peran ARIA maupun ukuran sentuhnya.'
    ).toEqual([]);
  });

  it('NOL warna heksadesimal ditulis tangan di layar publik', () => {
    const melanggar: string[] = [];
    for (const p of LAYAR_PUBLIK) {
      const heks = [...new Set(tanpaKomentar(isi(p)).match(/#[0-9a-fA-F]{6}\b/g) ?? [])];
      if (heks.length > 0) melanggar.push(`${p}: ${heks.join(', ')}`);
    }
    expect(
      melanggar,
      `Warna ditulis tangan:\n${melanggar.join('\n')}\n` +
        'Pakai token Carbon. Sebelum migrasi 25 Agu 2026 ada 22 heks di layar-layar ini, ' +
        'nilainya benar dan tetap menghasilkan dua sistem warna yang tidak cocok.'
    ).toEqual([]);
  });

  it('CSS Carbon diimpor HANYA di layout, bukan tersebar di halaman', () => {
    // Kalau tiap halaman mengimpor CSS-nya sendiri, halaman kedelapan akan lupa. Satu impor di
    // layout grup rute menjangkau halaman yang belum ditulis sekalipun.
    const pengimpor: string[] = [];
    const telusuri = (dir: string) => {
      for (const nama of readdirSync(dir)) {
        if (nama === 'node_modules' || nama === '.next' || nama.startsWith('.')) continue;
        const p = join(dir, nama);
        if (statSync(p).isDirectory()) telusuri(p);
        else if (/\.tsx$/.test(nama) && mengimporCarbonCss(readFileSync(p, 'utf8'))) {
          pengimpor.push(p.replace(AKAR + '/', ''));
        }
      }
    };
    telusuri(join(AKAR, 'app'));
    telusuri(join(AKAR, 'src'));

    // TIGA titik, dan tepat tiga — daftar putih, bukan angka yang wajar bertumbuh:
    //   (public)     -> tujuh layar publik
    //   (shell)      -> seluruh layar di dalam aplikasi, sejak DS-04
    //   surat-jalan  -> halaman CETAK, DITAMBAHKAN 26 Agu 2026
    //
    // Impor keempat berarti seseorang menambahkannya per halaman lagi, dan halaman kedelapan
    // akan lupa. Impor di app/(shell)/company/setelan/layout.tsx sudah DICABUT di DS-04 —
    // ia jadi ganda begitu kerangka aplikasi memuat Carbon, dan impor ganda tidak
    // menghasilkan galat sehingga bisa bertahan lama tanpa ada yang menyadarinya.
    //
    // KENAPA surat-jalan SAH jadi titik ketiga, dan kenapa ia justru WAJIB ada di sini:
    // halaman cetak SENGAJA berada di luar kerangka aplikasi — ia dokumen, bukan layar — jadi
    // ia tidak kebagian CSS dari (shell) maupun (public). Sebelum 26 Agu 2026 ia memuat
    // CSS-nya sendiri lewat `@carbon/react/index.scss`, dan ITULAH yang MEMBUAT BUILD PRODUKSI
    // GAGAL: berkas itu memancarkan @font-face ber-awalan `~@ibm/plex/...`, sintaks webpack
    // yang Turbopack tidak kenal. Deployment gagal dua kali sementara typecheck, seluruh test,
    // dan `next dev` semuanya hijau.
    //
    // Jadi memindahkannya ke berkas bersama BUKAN sekadar kerapian — berkas bersama menyetel
    // `$css--font-face: false`, dan itu yang membuat build-nya jalan.
    expect(pengimpor.sort()).toEqual([
      'app/(public)/layout.tsx',
      'app/(shell)/layout.tsx',
      'app/shipments/[shipmentId]/surat-jalan/layout.tsx'
    ]);
  });

  it('rangka bersama dipakai SEMUA layar publik — tidak ada yang menyusun kartunya sendiri', () => {
    const melanggar: string[] = [];
    for (const p of LAYAR_PUBLIK) {
      if (!isi(p).includes('LayarPublik')) melanggar.push(p);
    }
    expect(
      melanggar,
      `Layar berikut tidak memakai rangka bersama: ${melanggar.join(', ')}. ` +
        'Menyusun kartunya sendiri berarti membuka jalur kedua, dan jalur kedua tidak ikut ' +
        'berubah saat rangkanya diperbaiki.'
    ).toEqual([]);
  });
});
