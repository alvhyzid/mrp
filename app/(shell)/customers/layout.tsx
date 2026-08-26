// Gaya khas halaman Pelanggan. Pola yang sama dengan Master Item: stylesheet halaman dimuat
// lewat layout rutenya sendiri, BUKAN diimpor dari dalam komponen halaman — CSS Carbon
// bersamanya sudah dimuat sekali di app/(shell)/layout.tsx.
import './customers.scss';

export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
