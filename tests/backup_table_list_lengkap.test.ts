import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// LL / BAGIAN 2 (24 Agu 2026) — DAFTAR TABEL YANG DICADANGKAN TIDAK BOLEH TERTINGGAL.
//
// LAHIR DARI TEMUAN NYATA, bukan kehati-hatian: saat menyiapkan pencadangan sebagai jaring
// pengaman sebelum pembersihan data, ketahuan `backup-table-list.txt` memuat 87 nama padahal
// database punya 90 tabel dasar. Tiga tabel tidak pernah ikut tercadangkan sekali pun, dan
// dua di antaranya justru jejak yang paling tidak boleh hilang: `data_change_audit_log` dan
// `employee_cost_category_history` (riwayat penggolongan biaya karyawan — menurut CLAUDE.md
// itu JEJAK WAJIB yang menggantikan alur persetujuan Finance).
//
// Kegagalan seperti ini TIDAK BERISIK: pencadangan tetap berjalan, tetap melaporkan sukses,
// dan barunya ketahuan saat data yang hilang dicari — yaitu saat sudah terlambat.
//
// DI LUAR JANGKAUAN TEST INI (aturan II.2):
//   - Memeriksa NAMA tabel, bukan ISI hasil ekspornya. Tabel yang terdaftar tapi ekspornya
//     gagal (mis. ditolak izin) tetap lolos di sini.
//   - Tidak melihat Storage sama sekali. Berkas tidak tercakup pencadangan database — itu
//     lubang terpisah yang dilacak sebagai INF-16.
//   - Hanya schema public.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('Kelengkapan backup-table-list.txt', () => {
  it('setiap tabel dasar di database tercantum di daftar pencadangan', async () => {
    const { data, error } = await adminClient.rpc('debug_list_base_tables');
    expect(error).toBeNull();

    const diDatabase = (data ?? []).map((r: { table_name: string }) => r.table_name);
    expect(diDatabase.length).toBeGreaterThan(50);

    const daftar = new Set(
      readFileSync(join(__dirname, '..', 'backup-table-list.txt'), 'utf8')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    );

    const tertinggal = diDatabase.filter((t: string) => !daftar.has(t)).sort();

    expect(
      tertinggal,
      `Tabel berikut ADA di database tapi TIDAK ikut dicadangkan:\n  ${tertinggal.join('\n  ')}\n\n` +
        'Tambahkan ke backup-table-list.txt. Pencadangan yang melewatkan sebuah tabel tetap ' +
        'melaporkan sukses — kegagalannya baru terasa saat datanya dicari.'
    ).toEqual([]);
  });

  it('daftar tidak memuat nama tabel yang sudah tidak ada', async () => {
    const { data } = await adminClient.rpc('debug_list_base_tables');
    const diDatabase = new Set((data ?? []).map((r: { table_name: string }) => r.table_name));

    const daftar = readFileSync(join(__dirname, '..', 'backup-table-list.txt'), 'utf8')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const hantu = daftar.filter((t: string) => !diDatabase.has(t)).sort();

    expect(
      hantu,
      `Nama berikut tercantum di backup-table-list.txt tapi tabelnya tidak ada:\n  ${hantu.join('\n  ')}\n\n` +
        'Nama hantu membuat ringkasan ekspor selalu berisi baris ERROR, dan lama-lama baris ' +
        'ERROR yang wajar itu membuat orang berhenti membaca ringkasannya sama sekali.'
    ).toEqual([]);
  });
});
