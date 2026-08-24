// Konfigurasi Next.js.
//
// sassOptions ditambahkan 25 Agu 2026 untuk Carbon Design System (DS-01).
// includePaths ke node_modules WAJIB: berkas Sass Carbon saling merujuk lewat
// jalur paket, dan tanpa ini Turbopack tidak menemukannya.
//
// silenceDeprecations: Carbon masih memakai sebagian API Sass lama. Peringatannya
// membanjiri keluaran build sampai kegagalan sungguhan tidak terbaca -- SENGAJA
// dibungkam agar yang tersisa di layar hanya hal yang benar-benar perlu dibaca.
// Ini membungkam PERINGATAN, bukan galat: kesalahan Sass tetap menggagalkan build.
const nextConfig = {
  reactStrictMode: true,
  sassOptions: {
    includePaths: ['node_modules'],
    silenceDeprecations: ['mixed-decls', 'global-builtin', 'import', 'legacy-js-api']
  }
};

export default nextConfig;
