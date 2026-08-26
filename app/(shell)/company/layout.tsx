// Gaya khas halaman perusahaan (Data Perusahaan & Setelan Perhitungan). CSS Carbon bersamanya
// sudah dimuat sekali di app/(shell)/layout.tsx — jangan diimpor lagi di sini.
import './company.scss';

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
