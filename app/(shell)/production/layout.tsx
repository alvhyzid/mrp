// Gaya khas Dashboard Produksi. CSS Carbon bersamanya dimuat di app/(shell)/layout.tsx.
import './production.scss';

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
