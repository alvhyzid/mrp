import './globals.css';
import type { Metadata } from 'next';

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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
