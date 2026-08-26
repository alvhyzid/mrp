// Gaya khas halaman Routing. CSS Carbon bersamanya sudah dimuat di app/(shell)/layout.tsx.
import './routing.scss';

export default function RoutingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
