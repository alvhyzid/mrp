import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

// Vitest tidak otomatis memuat .env.local ke process.env seperti Next.js — tanpa ini
// tests/*.test.ts gagal start karena DEBUG_*_PASSWORD/SUPABASE_* dianggap kosong.
export default defineConfig({
  test: {
    env: loadEnv('', process.cwd(), '')
  }
});
