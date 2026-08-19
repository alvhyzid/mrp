import type { SupabaseClient } from '@supabase/supabase-js';

export interface EmployerCostConfig {
  wageBasisFloor: number;
  wageBasisCeiling: number;
  bpjsKesehatanRatePercent: number;
  jkkRatePercent: number;
  jkmRatePercent: number;
  jhtRatePercent: number;
}

const REQUIRED_KEYS = [
  'bpjs_wage_basis_floor',
  'bpjs_wage_basis_ceiling',
  'bpjs_kesehatan_employer_rate_percent',
  'bpjs_jkk_employer_rate_percent',
  'bpjs_jkm_employer_rate_percent',
  'bpjs_jht_employer_rate_percent'
] as const;

// Model biaya pemberi kerja (Perintah Gabungan A-F, Bagian D, 21 Agu 2026) --
// basis iuran BPJS Ketenagakerjaan (JKK/JKM/JHT) DAN BPJS Kesehatan BUKAN gaji
// individu mentah, tapi gaji di-clamp ke [floor, ceiling] tenant -- terbukti
// dari data nyata: Dina/Sutipa/Mi'asih (gaji 3,5jt/2,6jt/1,5jt, semua DI BAWAH
// floor Rp3.737.000) punya JKK & JKM PERSIS SAMA (basis floor yang sama),
// sedangkan Alvan (gaji 20jt, DI ATAS ceiling Rp9.000.000) pakai basis ceiling.
// Rate & basis floor/ceiling SEMUANYA konfigurasi per tenant (company_settings),
// berubah tiap tahun -- TIDAK PERNAH di-hardcode di sini.
export async function getEmployerCostConfig(adminClient: SupabaseClient, companyId: number): Promise<{ config: EmployerCostConfig | null; missingKeys: string[] }> {
  const { data: settings } = await adminClient
    .from('company_settings')
    .select('setting_key, setting_value')
    .eq('company_id', companyId)
    .in('setting_key', REQUIRED_KEYS);

  const byKey = new Map((settings ?? []).map((s) => [s.setting_key, s.setting_value]));
  const missingKeys = REQUIRED_KEYS.filter((k) => byKey.get(k) === undefined || byKey.get(k) === null || byKey.get(k) === '');
  if (missingKeys.length > 0) {
    return { config: null, missingKeys };
  }

  return {
    config: {
      wageBasisFloor: Number(byKey.get('bpjs_wage_basis_floor')),
      wageBasisCeiling: Number(byKey.get('bpjs_wage_basis_ceiling')),
      bpjsKesehatanRatePercent: Number(byKey.get('bpjs_kesehatan_employer_rate_percent')),
      jkkRatePercent: Number(byKey.get('bpjs_jkk_employer_rate_percent')),
      jkmRatePercent: Number(byKey.get('bpjs_jkm_employer_rate_percent')),
      jhtRatePercent: Number(byKey.get('bpjs_jht_employer_rate_percent'))
    },
    missingKeys: []
  };
}

// Iuran pemberi kerja BULANAN utk 1 karyawan wage_type=monthly. BPJS Kesehatan
// HANYA dihitung kalau bpjs_kesehatan_enrolled === true secara eksplisit --
// `null` (belum dikonfirmasi) TIDAK dibaca sebagai false, tapi juga TIDAK
// diikutkan (bukan ditebak ikut) -- dicatat di notes supaya jelas kenapa
// angkanya lebih rendah dari yang sesungguhnya. JKK/JKM/JHT tidak punya opsi
// keikutsertaan di data yang diberikan (beda dari Kesehatan), jadi selalu
// dihitung.
//
// Basis: PER ORANG (bpjs_contribution_basis kalau diisi), fallback ke
// clamp(gaji, floor, ceiling) tenant kalau belum ada override -- ditemukan
// dari data nyata (21 Agu 2026) BASIS TIDAK SELALU = clamp(gaji): Dimas
// (gaji Rp7.500.000) basisnya Rp6.500.000, Bayu (gaji Rp14.000.000) basisnya
// Rp8.000.000 -- keduanya beda dari hasil clamp. Mayoritas karyawan lain
// KEBETULAN basisnya persis cocok formula clamp (makanya formula lama tidak
// salah, cuma tidak lengkap utk 2 kasus di atas).
export function computeMonthlyEmployerUplift(
  monthlyWageRate: number,
  bpjsKesehatanEnrolled: boolean | null,
  config: EmployerCostConfig,
  contributionBasisOverride?: number | null
): { upliftAmount: number; clampedBasis: number; notes: string[] } {
  const clampedBasis = contributionBasisOverride ?? Math.min(Math.max(monthlyWageRate, config.wageBasisFloor), config.wageBasisCeiling);
  const jkk = (clampedBasis * config.jkkRatePercent) / 100;
  const jkm = (clampedBasis * config.jkmRatePercent) / 100;
  const jht = (clampedBasis * config.jhtRatePercent) / 100;
  const notes: string[] = [];

  let bpjsKesehatan = 0;
  if (bpjsKesehatanEnrolled === true) {
    bpjsKesehatan = (clampedBasis * config.bpjsKesehatanRatePercent) / 100;
  } else if (bpjsKesehatanEnrolled === null) {
    notes.push('Keikutsertaan BPJS Kesehatan belum dikonfirmasi -- TIDAK diikutkan (bukan ditebak ikut), angka employer cost di bawah nilai sesungguhnya kalau ternyata ikut.');
  }

  return { upliftAmount: jkk + jkm + jht + bpjsKesehatan, clampedBasis, notes };
}
