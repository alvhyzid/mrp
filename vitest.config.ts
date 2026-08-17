import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

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
export default defineConfig({
  test: {
    env: loadEnv('', process.cwd(), ''),
    fileParallelism: false,
    hookTimeout: 30000
  }
});
