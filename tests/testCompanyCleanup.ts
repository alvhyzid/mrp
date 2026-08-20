import type { SupabaseClient } from '@supabase/supabase-js';

type CleanupStep = [string, () => Promise<{ error: { message: string } | null }>];

// Akar masalah "ratusan baris companies menumpuk" (26 Agu 2026): afterAll lama pakai
// pola throw-and-abort (satu langkah gagal di tengah for-loop -> seluruh sisa langkah,
// TERMASUK delete companies, tidak pernah dijalankan) atau pola sequential
// unchecked-await (delete companies sendiri bisa gagal diam-diam tanpa exception).
// Helper ini menjamin delete companies SELALU dicoba di akhir, apa pun hasil langkah
// sebelumnya -- kegagalan tetap dilaporkan (lewat throw di akhir), tapi tidak lagi bisa
// menyebabkan baris companies tertinggal selamanya.
export async function cleanupCompanyCascade(adminClient: SupabaseClient, companyId: number | number[], steps: CleanupStep[]): Promise<void> {
  const failures: string[] = [];
  for (const [label, run] of steps) {
    try {
      const { error } = await run();
      if (error) failures.push(`${label}: ${error.message}`);
    } catch (e) {
      failures.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const companyIds = Array.isArray(companyId) ? companyId : [companyId];
  const { error: companyError } = await adminClient.from('companies').delete().in('company_id', companyIds);
  if (companyError) failures.push(`companies: ${companyError.message}`);

  if (failures.length > 0) {
    throw new Error(`Cleanup fixture test gagal sebagian (cek data sisa manual): ${failures.join('; ')}`);
  }
}
