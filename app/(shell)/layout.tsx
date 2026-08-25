// CSS Carbon untuk SELURUH layar di dalam aplikasi, dimuat di sini.
//
// Ini titik yang menyentuh 31 halaman sekaligus, dan itu DISENGAJA — kerangka aplikasi memang
// satu untuk semuanya, jadi ia tidak bisa dimigrasikan bertahap seperti isi halaman.
//
// KONSEKUENSI YANG SUDAH DISETUJUI PEMILIK PRODUK: selama masa peralihan, kerangka Carbon
// membungkus isi halaman yang sebagian besar belum Carbon. Tampilannya akan campur. Itu
// disengaja, bukan pekerjaan yang belum selesai — dan ia hilang sendiri seiring migrasi isi
// halaman berjalan.
import '@/styles/carbon.scss';
import './shell.scss';
import AppShellCarbon from '@/features/navigasi/AppShellCarbon';

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <AppShellCarbon>{children}</AppShellCarbon>;
}
