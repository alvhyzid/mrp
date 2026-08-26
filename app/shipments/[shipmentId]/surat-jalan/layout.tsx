// Halaman cetak surat jalan. CSS Carbon dimuat di sini sendiri karena halaman ini SENGAJA
// berada di luar kerangka aplikasi — ia dokumen, bukan layar aplikasi.
//
// DIPAKAI `@/styles/carbon.scss`, BUKAN `@carbon/react/index.scss` (diperbaiki 26 Agu 2026).
//
// KENAPA INI PENTING, dan kenapa build lokal `next dev` TIDAK menangkapnya:
// `@carbon/react/index.scss` memancarkan aturan `@font-face` yang menunjuk berkas font dengan
// awalan `~@ibm/plex/...` — sintaks resolusi milik webpack. Turbopack tidak mengenalnya, dan
// `next build` gagal dengan 90 galat "Module not found" sekaligus. `next dev` melewatinya
// karena ia tidak menyelesaikan seluruh aset di muka.
//
// Berkas bersama `@/styles/carbon.scss` sudah menutup lubang itu di barisnya sendiri:
//   @use '@carbon/styles/scss/config' with ($css--font-face: false);
// Jadi memakainya di sini BUKAN sekadar konsistensi — itu yang membuat build-nya jalan.
//
// PELAJARAN YANG DISEBUT SUPAYA TIDAK TERULANG: ini titik masuk KEDUA ke CSS Carbon.
// Titik masuk pertama (kerangka aplikasi dan layar publik) sudah memakai berkas bersama.
// Menulis titik masuk kedua dengan cara sendiri adalah "dua jalur hidup" lagi — dan kali ini
// jalur keduanya bahkan tidak bisa dibangun.
import '@/styles/carbon.scss';
import './surat-jalan.scss';

export default function SuratJalanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
