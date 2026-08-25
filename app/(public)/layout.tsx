// CSS Carbon untuk SELURUH layar publik, dimuat sekali di sini.
//
// KENAPA GRUP RUTE (public) DIBUAT, bukan mengimpor Carbon di tiap halaman:
// Next.js membatasi stylesheet global ke cabang rute tempat ia diimpor. Satu impor di sini
// menjangkau ketujuh layar publik sekaligus, dan yang lebih penting — ia menjangkau layar
// publik BERIKUTNYA tanpa siapa pun perlu ingat menambahkannya. Impor per halaman akan
// dilupakan pada halaman kedelapan, persis seperti aturan bantuan-klik yang dilupakan di 18
// tempat.
//
// Nama grup dalam kurung TIDAK muncul di alamat: /login tetap /login.
//
// Ke-37 layar di dalam (shell) TIDAK tersentuh impor ini — pemisahannya disengaja supaya
// migrasi Carbon bisa diperiksa segelombang, bukan sekaligus.
import '@/styles/carbon.scss';
import './publik.scss';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
