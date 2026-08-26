// Gaya khas halaman BOM. CSS Carbon bersamanya sudah dimuat di app/(shell)/layout.tsx.
import './boms.scss';

export default function BomsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
