import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'node:path';

// Vitest tidak otomatis memuat .env.local ke process.env seperti Next.js — tanpa ini
// tests/*.test.ts gagal start karena DEBUG_*_PASSWORD/SUPABASE_* dianggap kosong.
//
// fileParallelism: false — 4 file test lari paralel secara default, tiap beforeAll-nya
// langsung tembak admin.from('companies').insert(...) di detik yang (nyaris) sama ke
// project dev yang SAMA. Sesi 2C: di GitHub Actions CI, ini bikin TEPAT 1 dari 4 file
// (gantian, tidak selalu file yang sama) gagal "JWT issued at future" di request PALING
// AWAL beforeAll-nya — pola klasik lonjakan koneksi baru simultan ke API gateway Supabase,
// bukan bug di kode test/RLS itu sendiri (terbukti dari: file yang gagal berbeda-beda per
// run, SELALU tepat di request pertama sebuah file, TIDAK PERNAH terjadi kalau dijalankan
// satu file saja). Menjalankan file test secara berurutan (bukan sekaligus) menghilangkan
// lonjakan itu — durasi total tetap jauh di bawah target <5 menit CI.
// hookTimeout: 30000 — Sesi 3A: menambah file test ke-5 (shipments_physical_stage.test.ts,
// beforeAll-nya sendiri ~8 insert berurutan) di atas fileParallelism:false membuat total
// waktu tunggu SEBELUM giliran sebuah file test mulai lebih panjang. CI (network ke Supabase
// lebih lambat/lebih banyak variansi dibanding sandbox lokal) sempat gagal "Hook timed out in
// 10000ms" di beforeAll role_hierarchy_financial_access.test.ts (bukan test itu sendiri yang
// rusak — lolos normal begitu limitnya dinaikkan). Dinaikkan di config global (BUKAN di dalam
// file test manapun) supaya tidak menyentuh test yang sudah ada.
// testTimeout: 30000 — sama akar masalah dengan hookTimeout di atas, tapi kena limit
// yang BEDA (default Vitest per-test 5000ms, bukan per-hook). CI berikutnya gagal
// "Test timed out in 5000ms" di 1 assertion tests/cross_company_isolation.test.ts
// (query tunggal ke Supabase, bukan beforeAll) — bukti pola yang sama: latensi network
// CI lebih tinggi/lebih bervariasi dibanding sandbox lokal, bukan bug di query itu
// sendiri (lolos normal begitu limitnya dinaikkan, dan lolos konsisten di lokal sejak
// awal). Dinaikkan sekaligus di sini supaya tidak perlu tambal satu-satu tiap ada test
// baru yang kena limit default yang sama.
// tests/employee_crud_and_k8_standards.test.ts (Fase Produksi Nyata) importa
// server functions dari src/features/**/server/ langsung (untuk uji end-to-end
// gerbang role + logic bisnis, bukan lewat HTTP) -- file-file itu pakai alias
// "@/..." (tsconfig paths), yang TIDAK otomatis dikenal Vitest tanpa resolve.alias
// eksplisit ini. Tidak ada test lain sebelumnya yang butuh alias ini karena semua
// masih murni uji lapisan database/RLS langsung.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    env: loadEnv('', process.cwd(), ''),
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
    // Pengawas tingkat project (23 Agu 2026) -- lihat komentar di dalam file
    // itu sendiri. Menolak keras kalau NEXT_PUBLIC_SUPABASE_URL menunjuk
    // project yang diketahui berisi data nyata, kecuali flag eksplisit diset.
    setupFiles: ['./tests/setup/guardAgainstRealProject.ts'],
    // Pengawas URL<->kunci (23 Agu 2026): berjalan SEKALI sebelum test apa pun.
    // Gagal keras bila URL dan kunci tidak menunjuk project yang sama -- lihat
    // komentar di dalam berkasnya untuk kenapa gejalanya dulu menyesatkan.
    globalSetup: ['./tests/setup/assertUrlAndKeysMatch.ts']
  }
});
