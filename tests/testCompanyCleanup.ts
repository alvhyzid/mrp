import type { SupabaseClient } from '@supabase/supabase-js';

type CleanupStep = [string, () => Promise<{ error: { message: string } | null }>];

// Invarian 9 (Sesi 0, 21 Agu 2026): company_id=1 ("PT ITM") adalah TENANT NYATA,
// bukan fixture -- pengujian TIDAK PERNAH boleh membuat/menghapus baris di sana.
// Setiap test fixture yang dibuat sesi ini SUDAH memakai company barunya sendiri
// (auto-increment, tidak pernah 1), tapi ini gerbang pengaman TERAKHIR: kalau
// suatu saat sebuah test (sengaja/tidak sengaja) memanggil cleanup dengan
// companyId=1, panggilan ini GAGAL KERAS sebelum satu pun langkah cleanup
// dijalankan -- lebih baik test gagal berisik daripada diam-diam menghapus data
// tenant sungguhan. company_id=2 ("Company B") SENGAJA TIDAK diblokir di sini --
// itu tenant uji resmi yang memang boleh ditulis (lihat memori sesi soal
// company.b@debug.mrp).
const REAL_TENANT_COMPANY_IDS = [1];

// Akar masalah "ratusan baris companies menumpuk" (26 Agu 2026): afterAll lama pakai
// pola throw-and-abort (satu langkah gagal di tengah for-loop -> seluruh sisa langkah,
// TERMASUK delete companies, tidak pernah dijalankan) atau pola sequential
// unchecked-await (delete companies sendiri bisa gagal diam-diam tanpa exception).
// Helper ini menjamin delete companies SELALU dicoba di akhir, apa pun hasil langkah
// sebelumnya -- kegagalan tetap dilaporkan (lewat throw di akhir), tapi tidak lagi bisa
// menyebabkan baris companies tertinggal selamanya.
export async function cleanupCompanyCascade(adminClient: SupabaseClient, companyId: number | number[], steps: CleanupStep[]): Promise<void> {
  const companyIdsToCheck = Array.isArray(companyId) ? companyId : [companyId];
  const violatingIds = companyIdsToCheck.filter((id) => REAL_TENANT_COMPANY_IDS.includes(id));
  if (violatingIds.length > 0) {
    throw new Error(
      `PELANGGARAN INVARIAN 9: cleanupCompanyCascade dipanggil dengan company_id tenant NYATA (${violatingIds.join(', ')}) -- pengujian tidak boleh menulis/menghapus data company_id=1 (PT ITM). Batalkan cleanup ini dan perbaiki fixture test supaya memakai company barunya sendiri.`
    );
  }

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
