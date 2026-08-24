// CSS Carbon dimuat DI SINI, bukan di app/layout.tsx — SENGAJA.
//
// Memuatnya di layout akar akan menerapkan reset dan tipografi Carbon ke SELURUH 38 halaman
// sekaligus, dalam satu perubahan yang tidak bisa diperiksa satu per satu. Next.js membatasi
// stylesheet global ke cabang rute tempat ia diimpor, jadi menaruhnya di sini membuat Carbon
// berlaku HANYA untuk layar pilot ini.
//
// Saat pilot terbukti dan layar lain menyusul, impor ini naik ke layout yang lebih tinggi —
// bertahap, bukan sekaligus. Itu juga yang membuat "sebelum vs sesudah" bisa dibandingkan.
import '@/styles/carbon.scss';
import './setelan.css';

export default function SetelanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
