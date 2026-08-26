// Gaya khas Dashboard PPIC. CSS Carbon bersamanya dimuat di app/(shell)/layout.tsx.
import './ppic.scss';
// Gaya papan Gantt DIIMPOR DARI SINI, bukan dari komponennya sendiri, supaya seluruh
// stylesheet proyek ini masuk lewat SATU jalur yang sama: layout route. Versi pertama
// mengimpornya di dalam src/features/ppic/components/PapanGantt.tsx -- satu-satunya
// stylesheet di repo yang masuk lewat jalur berbeda. Jalur kedua untuk hal yang sama
// adalah kelas cacat yang sudah berulang kali menggigit proyek ini.
import '@/features/ppic/components/papan-gantt.scss';

export default function PpicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
