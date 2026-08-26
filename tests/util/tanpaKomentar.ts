// PEMBANTU BERSAMA: membuang komentar sebelum menyisir teks sumber.
//
// ============================================================================
// KENAPA BERKAS INI ADA
// ============================================================================
// Mencocokkan teks tanpa membedakan KODE dari PENJELASAN sudah salah LIMA KALI di proyek
// ini, dan tiap kali bentuknya sama persis:
//
//   1. Halaman POD dituduh menulis `<input>` mentah  -> kata "input" di kalimat penjelasan.
//   2. Tiga berkas dituduh menulis ke basis data     -> `visiting.delete(...)`, Set biasa.
//   3. `value={docForm.doc_type}` dituduh bocor      -> nilai kontrol <CarbonSelect>.
//   4. `notifikasi.tsx` dituduh mengimpor CSS Carbon -> nama berkas disebut di komentar.
//   5. SENSUS TABEL menghitung 11 tabel mentah       -> dua di antaranya kata `<table>`
//      di dalam kalimat penjelasan. Yang sebenarnya 9.
//
// Kejadian kelima yang melahirkan berkas ini, dan ia berbeda dari empat sebelumnya: korbannya
// bukan PENJAGA melainkan SENSUS -- alat yang dipakai MENGUKUR, lalu angkanya dipakai
// memutuskan seberapa besar sebuah pekerjaan. Penjaga yang salah tuduh berbunyi keras dan
// diperbaiki; sensus yang salah menghasilkan angka yang terlihat wajar dan dipercaya.
//
// Karena itu pembantu ini disediakan untuk SETIAP penyisiran teks di proyek ini -- penjaga,
// sensus, DAN sapuan -- bukan hanya untuk penjaga.
//
// ============================================================================
// APA YANG DIJAGA, DAN APA YANG TIDAK
// ============================================================================
// INI MENANGANI: komentar `//` (termasuk yang menempel di ujung baris kode), komentar
// `/* ... */`, dan tahu bahwa `//` di dalam string ('http://...') BUKAN komentar.
//
// INI TIDAK MENANGANI: ia bukan parser JavaScript. Pembagian regex (`a / b / c`) yang
// kebetulan menyerupai pembuka komentar bisa mengecohnya, dan literal regex yang memuat
// tanda kutip bisa membuatnya salah membaca batas string. Untuk berkas TSX yang disisir
// penjaga-penjaga di proyek ini, keduanya belum pernah muncul -- tapi batas itu disebut di
// sini supaya tidak ada yang mengira keluarannya setara hasil parser.
//
// PANJANG TEKSNYA DIPERTAHANKAN: isi komentar diganti spasi, bukan dihapus. Dengan begitu
// NOMOR BARIS dan indeks karakter tetap menunjuk tempat yang sama di berkas aslinya --
// syarat mutlak bagi penyisir yang melaporkan "berkas:baris".
export function tanpaKomentar(teks: string): string {
  const keluar = teks.split('');
  let i = 0;
  let kutip: string | null = null;

  while (i < teks.length) {
    const c = teks[i];
    const n = teks[i + 1];

    if (kutip) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === kutip) kutip = null;
      i += 1;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      kutip = c;
      i += 1;
      continue;
    }

    if (c === '/' && n === '/') {
      while (i < teks.length && teks[i] !== '\n') {
        keluar[i] = ' ';
        i += 1;
      }
      continue;
    }

    if (c === '/' && n === '*') {
      while (i < teks.length && !(teks[i] === '*' && teks[i + 1] === '/')) {
        if (teks[i] !== '\n') keluar[i] = ' ';
        i += 1;
      }
      if (i < teks.length) keluar[i] = ' ';
      if (i + 1 < teks.length) keluar[i + 1] = ' ';
      i += 2;
      continue;
    }

    i += 1;
  }

  return keluar.join('');
}

/// Nomor baris (1-based) untuk sebuah indeks karakter. Dipakai penyisir yang perlu melaporkan
/// "berkas:baris" -- dan benar HANYA karena `tanpaKomentar` mempertahankan panjang teks.
export function nomorBaris(teks: string, indeks: number): number {
  let baris = 1;
  for (let i = 0; i < indeks && i < teks.length; i += 1) {
    if (teks[i] === '\n') baris += 1;
  }
  return baris;
}
