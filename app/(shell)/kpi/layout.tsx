// Gaya khas halaman KPI. CSS Carbon bersamanya sudah dimuat sekali di app/(shell)/layout.tsx.
// Layout ini membungkus /kpi DAN /kpi/saya sekaligus — keduanya memakai kelas yang sama.
import './kpi.scss';

export default function KpiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
