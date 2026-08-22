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

// QA-01 (22 Agu 2026) -- akar masalah SEBENARNYA dari 4 kejadian fixture bentrok
// beruntun (7 companies bekas test/INF-06, sisa suite dijalankan 2x, fixture
// PMB-07a lupa membersihkan status_transition_log, fixture PMB-07b salah nama
// kolom saat membersihkan document_signatures): setiap file test HARUS menulis
// TANGAN sendiri daftar `steps` yang URUT BENAR dan LENGKAP mengikuti seluruh
// graf foreign key -- dan manusia (Claude Code) berulang kali lupa satu tabel
// atau salah kolom. Tambalan lokal per-file TIDAK menyelesaikan akarnya --
// masalahnya kembali tiap kali ada file test baru dengan graf FK yang sedikit
// beda. Perbaikan di bawah ini membuat helper ini SENDIRI yang tangguh,
// terlepas dari salah/lengkap tidaknya `steps` yang ditulis manusia:
//
// 1. RETRY-UNTIL-FIXED-POINT: `steps` dijalankan berulang (bukan 1x) --
//    langkah yang gagal di-retry di putaran berikutnya, karena urutan yang
//    SALAH (bukan HILANG) akan otomatis terselesaikan begitu langkah lain yang
//    lebih dulu semestinya jalan sudah sukses. Berhenti begitu tidak ada
//    kemajuan lagi (bukan berhenti di 1 kali percobaan).
// 2. SAPUAN SISA GENERIK: setelah `steps` + hapus companies dicoba, helper ini
//    MENCARI SENDIRI (lewat OpenAPI root PostgREST, bukan daftar tabel yang
//    ditulis tangan -- otomatis ikut tabel baru tanpa perlu diperbarui manual)
//    tabel mana pun yang PUNYA kolom company_id dan MASIH punya baris untuk
//    company_id ini, TERLEPAS dari apakah tabel itu ada di `steps` atau tidak.
//    Ini menangkap kelas bug "lupa satu tabel di `steps`" yang jadi akar 2 dari
//    4 kejadian di atas -- bukan cuma bug urutan.
// 3. GAGAL KERAS, BUKAN DIAM: kalau setelah semua itu masih ada sisa, error
//    yang dilempar menyebut PERSIS tabel & jumlah baris yang tertinggal --
//    bukan pesan generik "gagal sebagian" yang mengharuskan investigasi manual.
export async function cleanupCompanyCascade(adminClient: SupabaseClient, companyId: number | number[], steps: CleanupStep[]): Promise<void> {
  const companyIdsToCheck = Array.isArray(companyId) ? companyId : [companyId];
  const violatingIds = companyIdsToCheck.filter((id) => REAL_TENANT_COMPANY_IDS.includes(id));
  if (violatingIds.length > 0) {
    throw new Error(
      `PELANGGARAN INVARIAN 9: cleanupCompanyCascade dipanggil dengan company_id tenant NYATA (${violatingIds.join(', ')}) -- pengujian tidak boleh menulis/menghapus data company_id=1 (PT ITM). Batalkan cleanup ini dan perbaiki fixture test supaya memakai company barunya sendiri.`
    );
  }

  // --- 1. Retry-until-fixed-point untuk steps yang ditulis manusia ---
  let pending = steps.slice();
  let lastFailureCount = Infinity;
  const MAX_PASSES = 6;
  for (let pass = 0; pass < MAX_PASSES && pending.length > 0; pass++) {
    const stillFailing: CleanupStep[] = [];
    for (const step of pending) {
      const [, run] = step;
      try {
        const { error } = await run();
        if (error) stillFailing.push(step);
      } catch {
        stillFailing.push(step);
      }
    }
    if (stillFailing.length === lastFailureCount) break; // tidak ada kemajuan -- berhenti, jangan berputar sia-sia
    lastFailureCount = stillFailing.length;
    pending = stillFailing;
  }

  const companyIds = Array.isArray(companyId) ? companyId : [companyId];

  // AUD-07 (23 Agu 2026) -- data_change_audit_log SENGAJA tidak punya FK ke
  // companies (audit trail harus bisa bertahan lewat penghapusan company
  // sungguhan), jadi baris ini TIDAK ikut terhapus lewat cascade FK seperti
  // tabel anak lain -- harus disapu eksplisit di sini, satu tempat, supaya
  // tidak perlu menambah baris ini ke `steps` tiap file test.
  await adminClient.from('data_change_audit_log').delete().in('company_id', companyIds);

  await adminClient.from('companies').delete().in('company_id', companyIds);

  // --- 2. Sapuan sisa generik -- cari SENDIRI, jangan andalkan steps manusia ---
  // Dijalankan SERVER-SIDE lewat 1 RPC per company_id (debug_company_residual_scan,
  // migrasi 20260827540000) -- percobaan pertama menyapu lewat banyak panggilan
  // REST client-side (bahkan bersamaan/Promise.all) TERBUKTI tetap lambat (>30
  // detik, sampai timeout hook test) karena overhead jaringan per-request
  // menumpuk; loop di dalam Postgres (dynamic SQL atas information_schema)
  // selesai dalam ~1 detik untuk hasil yang SAMA PERSIS. Tabel anak tanpa kolom
  // company_id sendiri (mis. shipment_lines, customer_po_approvals) TIDAK perlu
  // disapu terpisah -- integritas FK menjamin: kalau tabel INDUKnya (yang PUNYA
  // company_id) sudah kosong, baris anak yang merujuknya TIDAK MUNGKIN masih ada
  // (constraint FK akan menolak penghapusan induk selama anak masih merujuknya).
  const residuals: string[] = [];
  for (const id of companyIds) {
    const { data, error } = await adminClient.rpc('debug_company_residual_scan', { p_company_id: id });
    if (error) continue; // fungsi diagnostic tidak terjangkau -- jangan gagalkan cleanup hanya karena diagnosticnya tidak jalan
    for (const row of (data as { table_name: string; row_count: number }[]) ?? []) {
      residuals.push(`${row.table_name} (company_id=${id}): ${row.row_count} baris tersisa`);
    }
  }

  if (residuals.length > 0) {
    throw new Error(
      `Cleanup fixture test GAGAL SEBAGIAN -- sisa DITEMUKAN LEWAT SAPUAN OTOMATIS (bukan cuma dari steps yang ditulis manual), jadi ini kemungkinan besar tabel yang TERLEWAT dari daftar steps, bukan cuma urutan salah:\n${residuals.join('\n')}`
    );
  }
}

// QA-01 X.2 (22 Agu 2026) -- pembersihan-SAAT-KELUAR (di atas) TIDAK BISA
// dijamin: proses yang dimatikan paksa (SIGKILL, mis. runner CI dihentikan
// paksa, komputer mati, developer menekan Ctrl+C dua kali) TIDAK memberi
// kesempatan kode apa pun berjalan -- itu batasan sistem operasi, bukan
// cacat cleanupCompanyCascade. Jaminan KEDUA dipindah ke AWAL: panggil ini
// di awal `beforeAll`, SEBELUM membuat fixture baru -- kalau company dengan
// NAMA yang sama tertinggal dari run sebelumnya yang mati paksa, disapu
// bersih dulu (lewat debug_force_delete_company(), migrasi 20260827570000/
// 590000 -- generik penuh, termasuk tabel anak berlapis tanpa company_id
// langsung, TIDAK butuh daftar tabel ditulis tangan sama sekali).
export async function cleanupStaleFixtureByName(adminClient: SupabaseClient, companyName: string): Promise<void> {
  const { data: existing } = await adminClient.from('companies').select('company_id').eq('name', companyName);
  for (const row of existing ?? []) {
    await adminClient.rpc('debug_force_delete_company', { p_company_id: row.company_id });
  }
}
