import type { SupabaseClient } from '@supabase/supabase-js';

// Baris RULE (bukan FIELD -- ini bukan nama kolom database; bukan METRIC -- ini
// bukan rumus KPI) -- aturan penamaan kode bahan yang rawan tertukar di lantai
// produksi/purchasing, harga beda 5,4x kalau salah pilih. Dari formula resmi
// Gummy Zala V2/Drinkme V1 (14 Agu 2026, formulator Dhiska), diminta eksplisit
// masuk Kamus prioritas 1 pemilik produk (26 Agu 2026).
const RULE_TERMS: { term_key: string; ai_draft: string; suggested_role?: string }[] = [
  {
    term_key: 'rule.kode_pmgm_premix_gummy',
    suggested_role: 'purchasing',
    ai_draft:
      'PMGM = "Premix Gummy" = MALTITOL POWDER (item RM-MALTITOL, Rp315.000/kg, lini Gummy) -- bahan TUNGGAL, bukan campuran. JANGAN tertukar dengan PMPW "Premix Powder" (Sorbitol Powder, lini Serbuk, harga beda 5,4x). Lembar formula Gummy Zala V2 (docs/formula-gummy-zala-v2.md) SALAH TULIS "Premix Powder" untuk bahan ini -- seharusnya "Premix Gummy"; lihat catatan kaki di dokumen tsb.'
  },
  {
    term_key: 'rule.kode_pmpw_premix_powder',
    suggested_role: 'purchasing',
    ai_draft:
      'PMPW = "Premix Powder" = SORBITOL POWDER (item RM-SORBITOL-POWDER, Rp58.000/kg, lini Serbuk/Drinkme) -- bahan TUNGGAL, bukan campuran. JANGAN tertukar dengan PMGM "Premix Gummy" (Maltitol Powder, lini Gummy, harga beda 5,4x).'
  }
];

export async function seedKamusIngredientRules(adminClient: SupabaseClient, companyId: number): Promise<{ inserted: number; skippedExisting: number }> {
  const rows = RULE_TERMS.map((r) => ({
    company_id: companyId,
    scope: 'RULE',
    entity: null,
    field: null,
    term_key: r.term_key,
    priority: 1,
    domain: 'standar',
    suggested_role: r.suggested_role ?? 'purchasing',
    status: 'DRAF_AI',
    ai_draft: r.ai_draft
  }));

  const { data: inserted, error } = await adminClient.from('kamus_terms').upsert(rows, { onConflict: 'company_id,term_key', ignoreDuplicates: true }).select('kamus_term_id');
  if (error) throw new Error(`Gagal insert kamus_terms (RULE): ${error.message}`);

  return { inserted: inserted?.length ?? 0, skippedExisting: rows.length - (inserted?.length ?? 0) };
}
