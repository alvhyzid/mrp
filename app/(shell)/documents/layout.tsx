// Gaya khas halaman Master Dokumen. CSS Carbon bersamanya sudah dimuat sekali di
// app/(shell)/layout.tsx — jangan diimpor lagi di sini.
import './documents.scss';

export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
