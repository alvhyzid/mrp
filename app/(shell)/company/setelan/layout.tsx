// CSS Carbon TIDAK LAGI diimpor di sini — sejak DS-04 (25 Agu 2026) ia dimuat sekali di
// app/(shell)/layout.tsx untuk seluruh layar di dalam aplikasi.
//
// Impor ganda tidak menghasilkan galat, jadi ia bisa bertahan lama tanpa ada yang menyadari —
// itu sebabnya dicabut sekarang, bukan "nanti kalau sempat". Yang tersisa di sini hanya gaya
// khusus halaman ini.
import './setelan.scss';

export default function SetelanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
