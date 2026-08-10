# MRP SaaS Multi-Tenant

Fondasi platform MRP multi-tenant untuk manufaktur berbasis Next.js 16, Supabase, dan PostgreSQL.

## Setup lokal

1. Install dependensi:
   ```bash
   npm install
   ```
2. Buat file `.env.local` di root dengan variabel:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
   ```
3. Jalankan dev server:
   ```bash
   npm run dev
   ```

## Struktur awal

- `app/`: halaman App Router Next.js
- `src/lib/supabaseClient.ts`: koneksi Supabase frontend
- `db/migrations/`: tempat migration SQL

## Catatan

Untuk menjalankan autentikasi dan RLS, Anda perlu mengonfigurasi Supabase Project dengan tabel dan kebijakan yang dibuat di `db/migrations`.
