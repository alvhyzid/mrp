// Gaya khusus halaman Master Item. CSS Carbon-nya sendiri sudah dimuat sekali di
// app/(shell)/layout.tsx untuk seluruh layar di dalam aplikasi — jangan diimpor lagi di sini.
import './items.scss';

export default function ItemsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
