import './globals.css';
import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';

// Font resmi Carbon Design System (IBM Plex Sans) — dipasang SEKALI di sini
// untuk seluruh app sejak Tahap 3 (gaya Carbon company-wide). Sebelumnya
// LoginPage/RegisterPage/AppShell masing-masing memuat instance-nya sendiri
// selagi eksperimennya masih terisolasi ke 2 halaman; sekarang dikonsolidasi
// ke satu tempat karena berlaku ke semua halaman.
const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  title: 'MRP SaaS',
  description: 'Fondasi platform MRP multi-tenant untuk manufaktur.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning di sini SENGAJA cuma diterapkan ke <html>/<body>
    // (bukan ke children) — meredam warning hydration palsu akibat ekstensi
    // browser yang menyisipkan atribut (mis. bis_skin_checked, bis_register dari
    // Bitdefender) sebelum React sempat hydrate, TANPA menyembunyikan mismatch
    // sungguhan di konten halaman manapun. Lihat catatan di README/percakapan:
    // sudah dikonfirmasi lewat isi diff error (atribut bis_* tidak pernah
    // dihasilkan kode ini) dan lewat pengujian headless browser (bersih tanpa
    // ekstensi) bahwa root cause-nya memang ekstensi, bukan bug di sini.
    <html lang="id" suppressHydrationWarning>
      <body className={ibmPlexSans.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
