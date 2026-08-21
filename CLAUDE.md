# Konteks Proyek — Sistem MRP Multi-Tenant

## Tentang Proyek
Sistem MRP (Material Requirements Planning) berbasis SaaS multi-tenant untuk industri manufaktur — dirancang awal untuk PT. Indo Taste Manufacture (produsen functional gummy & minuman serbuk), dengan rencana dijual ke perusahaan manufaktur lain setelah terbukti solid.

## WAJIB Dibaca Dulu Sebelum Mulai Kerja
- `docs/rancangan-skema-database-mrp.md` — skema database lengkap (semua tabel, kolom, relasi)
- `docs/prioritas-fitur-mrpeasy-enterprise.md` — mana fitur masuk MVP (Tier 1), mana yang menyusul (Tier 2/3)

Baca KEDUA file ini secara penuh sebelum menulis kode apa pun. Semua keputusan desain di dalamnya sudah didiskusikan panjang dengan user dan mencerminkan proses bisnis riil — jangan diubah tanpa bertanya ke user dulu.

## Tech Stack (Final, Sudah Diputuskan)
- Frontend & Backend: Next.js 16 (App Router), React 19, TypeScript
- Runtime: Node.js 24 (LTS)
- Database: PostgreSQL 18, dihosting via Supabase (sekalian pakai Auth & Storage bawaan Supabase)
- Hosting aplikasi: Vercel
- Payment gateway (fase billing nanti, BUKAN untuk MVP): Xendit/Midtrans

## Prinsip Arsitektur — WAJIB Dipatuhi di Semua Kode
1. **Multi-tenant sejak baris pertama** — semua tabel utama punya `company_id`. Terapkan Row-Level Security (RLS) di Supabase/Postgres untuk isolasi data antar tenant, bukan cuma filter di kode aplikasi.
2. **Generik untuk manufaktur apa pun** — jangan hardcode logic khusus gummy/serbuk di kode. Semua spesifik-industri harus lewat data (Item type, BOM), bukan lewat if-else di kode.
3. **BOM dihitung per unit output**, bukan per batch — supaya scaling resep otomatis.
4. **Yield produksi itu variatif** — selalu catat `actual_output_qty`/`work_order_outputs` terpisah dari `planned_qty`. Jangan pernah asumsikan hasil produksi = rencana.
5. **Satu Work Order bisa menghasilkan multi-output** (produk jadi + sisa reprocessable/waste yang bisa dipakai lagi) — lihat tabel `work_order_outputs`.
6. **Lot/batch traceability wajib** — setiap pergerakan stok tercatat by lot, dengan jejak genealogy (lot ini dibuat dari lot apa saja). Ini requirement compliance BPOM/halal, tidak boleh disederhanakan.
7. **Konvensi penamaan primary key**: `nama_tabel_tunggal_id` (mis. tabel `employees` → primary key `employee_id`, BUKAN `id` generik). Ini WAJIB diikuti di semua tabel — sudah diterapkan konsisten di `docs/rancangan-skema-database-mrp.md`, ikuti persis seperti tertulis di sana.

## Struktur Folder — WAJIB Dipatuhi di Semua Kode
1. **`app/` hanya wrapper routing.** File di `app/**/page.tsx` dan `app/api/**/route.ts` tidak boleh berisi logic bisnis — isinya cuma routing Next.js (path, layout, re-export) yang memanggil kode dari `src/features/<domain>/`. Contoh yang benar: `app/login/page.tsx` cuma berisi `export { default } from '@/features/auth/pages/LoginPage';`.
2. **Logic bisnis hidup di `src/features/<domain>/`**, dikelompokkan per domain (mis. `auth`, `team`, `mrp`), bukan per tipe file. Di dalam tiap domain: `pages/` untuk komponen halaman, `server/` untuk logic sisi server (query Supabase, validasi, dsb).
3. **Tiap folder feature WAJIB punya `index.ts`** sebagai satu-satunya pintu resmi (public API) ke domain itu — file lain di luar `src/features/<domain>/` harus import lewat `index.ts`-nya, bukan menjangkau langsung ke file di dalam `pages/` atau `server/`.
4. **Domain baru = folder feature baru.** Sebelum menambah domain baru di `src/features/`, cek dulu apakah sudah ada domain yang cocok — jangan bikin domain baru untuk sesuatu yang harusnya masuk domain yang sudah ada.
5. **Komponen UI generik (design system) hidup di `src/components/ui/`**, bukan di `src/features/`. Ini komponen presentasional murni dari shadcn/ui (Button, Input, Select, Badge, Card, Table, dst) — tidak mengandung logic bisnis, dipakai lintas domain. Statusnya sejajar dengan `src/lib/` (infrastruktur bersama), bukan sebuah "feature". Konfigurasi ada di `components.json` di root repo.

> **Catatan status saat ini:** Aturan #1 sudah konsisten diikuti untuk `app/**/page.tsx`. Untuk `app/api/**/route.ts`, route `register`, `invitations`, dan `invitations/accept` sudah dirapikan (logic pindah ke `features/auth/server/` dan `features/team/server/`, route cuma parsing request + panggil fungsi + return response). Route `login`, `me`, `profile`, dan `users` masih berisi logic bisnis penuh langsung di file route — belum dirapikan, jangan tambah route API baru dengan pola lama itu.

## Aturan Unggah Berkas — WAJIB untuk Titik Unggah BARU
Semua titik unggah file BARU yang dibuat mulai 25 Agu 2026 WAJIB memanggil `uploadFileWithMetadata` di `src/lib/fileUpload.ts` (bukan memanggil `adminClient.storage.from(...).upload()` langsung) — fungsi ini menghitung checksum SHA-256 dan menyiapkan metadata minimum (uploader, entitas terkait, mime type, checksum, ukuran) di setiap unggahan, supaya backfill registry dokumen terpusat (rencana "Master Dokumen", digerbang sampai SAS001 & SAS005 terkirim) nanti kecil. Titik unggah LAMA (`uploadAvatar`, `uploadSignature`, `uploadCompanyLogo`, `confirmDelivery`, `processShipmentDispatch`) TIDAK diretrofit — aturan ini hanya berlaku maju, bukan proyek migrasi kode lama.

## Aturan Verifikasi Manual — WAJIB, Ditemukan Lewat Insiden Nyata (Sesi 0/0B/0C, 21 Agu 2026)
Verifikasi visual APA PUN di browser (screenshot, klik-coba fitur, cek tampilan) **HANYA memakai tenant uji** (`company.b@debug.mrp` atau fixture perusahaan baru yang dibuat & dihapus sendiri oleh sesi kerja) — **TIDAK PERNAH memakai akun PT ITM** (`company.a@debug.mrp`, data company_id=1), **sekalipun tindakannya terasa "hanya melihat"**. Alasan: investigasi Sesi 0/0B/0C menemukan `getMarginWatch.ts`/`getPlanningFeasibility.ts` mengunci baseline finansial secara *lazy* pada panggilan pertama — tombol yang terlihat seperti "Cek Kelayakan"/"Margin Watch" (murni tampilan) ternyata menulis data permanen ke tenant sungguhan begitu diklik untuk verifikasi. Kelas kerentanan ini (aksi yang terlihat read-only tapi menulis di baliknya) bisa ada di fitur lain yang belum ditemukan — jadi aturan ini berlaku untuk SEMUA verifikasi manual, bukan cuma dua fitur yang sudah diperbaiki.

## Cara Kerja dengan User
User adalah **pemilik/praktisi bisnis manufaktur yang sangat paham proses produksi**, tapi **tidak memahami coding sama sekali**. Karena itu:
- Kalau melapor progres ke user, gunakan bahasa non-teknis — jelaskan dari sisi "apa yang sekarang bisa dilakukan sistem", bukan istilah teknis
- Jangan asumsikan user bisa membaca kode, error message, atau debug sendiri
- Selalu jalankan & test perubahan sebelum bilang "selesai"
- Untuk keputusan desain/arsitektur besar yang belum ada di dua dokumen referensi, TANYA dulu ke user — jangan asumsi sendiri
- User berkomunikasi dalam Bahasa Indonesia

## Tugas Pertama — Fase 3 Roadmap: Fondasi SaaS
Jangan lompat ke modul MRP (Item, BOM, Work Order, dst) sebelum fondasi ini solid dan sudah dicoba jalan:

1. Inisialisasi project Next.js 16 (TypeScript, App Router, Tailwind CSS)
2. Setup koneksi ke Supabase (user akan berikan Project URL & API Key project Supabase yang sudah dibuat)
3. Buat migration database untuk tabel `companies`, `users`, `subscription_plans` sesuai `docs/rancangan-skema-database-mrp.md`
4. Setup Supabase Auth untuk login/registrasi user
5. Terapkan Row-Level Security dasar berbasis `company_id`
6. Buat halaman login & dashboard kosong sederhana untuk verifikasi semua nyambung dengan benar
7. Inisialisasi Git repository, buat repo baru di GitHub user, push kode

Setelah fondasi ini jalan dan user sudah lihat hasilnya (bisa login, lihat dashboard kosong), baru lanjut ke modul MRP inti sesuai roadmap.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
