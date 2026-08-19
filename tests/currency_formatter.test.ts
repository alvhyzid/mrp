import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { formatCurrency, formatNumberId } from '../src/lib/currency';

// Perintah Gabungan A-F, Bagian F (21 Agu 2026) -- formatter Rupiah terpusat,
// SATU-SATUNYA tempat "Rp" boleh ditulis di lapisan tampilan. STANDING
// INVARIANT proyek: pembulatan HANYA di tampilan (fungsi ini), nilai
// tersimpan/perhitungan tetap presisi penuh -- diuji dgn memastikan fungsi
// ini TIDAK memodifikasi input (murni fungsi format, bukan mutasi/pembulatan
// di sumbernya).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for tests.');
}
const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('formatCurrency (TS, lapisan tampilan)', () => {
  it('format standar: awalan Rp, pemisah ribuan titik, desimal koma -- cocok contoh acuan "Rp1.108.255,93"', () => {
    expect(formatCurrency(1108255.93)).toBe('Rp1.108.255,93');
  });

  it('angka bulat TIDAK dipaksa tampil ,00 -- Rp1.500.000 bukan Rp1.500.000,00', () => {
    expect(formatCurrency(1500000)).toBe('Rp1.500.000');
  });

  it('(NEGATIF) null/undefined -> "-", BUKAN "Rp0" (supaya tidak disalahartikan sebagai angka nyata nol)', () => {
    expect(formatCurrency(null)).toBe('-');
    expect(formatCurrency(undefined)).toBe('-');
  });

  it('(NEGATIF) NaN/Infinity -> "-", bukan "RpNaN" atau angka tidak masuk akal', () => {
    expect(formatCurrency(NaN)).toBe('-');
    expect(formatCurrency(Infinity)).toBe('-');
  });

  it('nilai NOL sungguhan (0, bukan null) tetap ditampilkan "Rp0" -- beda dari data belum ada', () => {
    expect(formatCurrency(0)).toBe('Rp0');
  });

  it('tidak memutasi/membulatkan nilai ASLI -- pembulatan cuma di string hasil, bukan di angka sumber (standing invariant)', () => {
    const original = 1108255.9376543;
    const formatted = formatCurrency(original);
    expect(original).toBe(1108255.9376543); // input tidak berubah
    expect(formatted).toBe('Rp1.108.255,94'); // hasil tampilan boleh dibulatkan (2 desimal)
  });

  it('mata uang non-IDR (belum ada tenant nyata, tapi kode sudah siap) -> pakai kode sebagai label, bukan crash/Rp yang salah', () => {
    expect(formatCurrency(100, { currencyCode: 'USD' })).toBe('USD 100');
  });
});

describe('formatNumberId (TS, angka tanpa simbol mata uang)', () => {
  it('format ribuan Indonesia tanpa simbol, utk kolom dgn label satuan sendiri', () => {
    expect(formatNumberId(12913.72)).toBe('12.913,72');
  });

  it('(NEGATIF) null -> "-", bukan "0" atau string kosong', () => {
    expect(formatNumberId(null)).toBe('-');
  });
});

describe('format_rupiah_id (SQL, kalimat notifikasi dari dalam Postgres)', () => {
  it('format ribuan Indonesia PERSIS sama pola dgn sisi TS -- angka besar (margin proyeksi acuan)', async () => {
    const { data, error } = await adminClient.rpc('format_rupiah_id', { p_value: 1523025338 });
    if (error) throw new Error(error.message);
    expect(data).toBe('Rp1.523.025.338');
  });

  it('(NEGATIF) angka desimal DIBULATKAN ke rupiah penuh (bukan menampilkan sen pecahan di kalimat notifikasi)', async () => {
    const { data, error } = await adminClient.rpc('format_rupiah_id', { p_value: 63687.9 });
    if (error) throw new Error(error.message);
    expect(data).toBe('Rp63.688');
  });

  it('(NEGATIF) angka NOL -> "Rp0", bukan string kosong atau NULL', async () => {
    const { data, error } = await adminClient.rpc('format_rupiah_id', { p_value: 0 });
    if (error) throw new Error(error.message);
    expect(data).toBe('Rp0');
  });
});
