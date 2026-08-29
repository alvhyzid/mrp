
// DI LUAR JANGKAUAN PENGAWAS INI (aturan II.2 -- cara sebuah pengaman MENCARI menentukan
// apa yang TIDAK AKAN PERNAH ia temukan):
//   - Hanya memeriksa izin EXECUTE pada FUNGSI di schema `public`. Fungsi di schema lain
//     (auth, storage, extensions) tidak pernah dilihat.
//   - TIDAK memeriksa izin pada TABEL, VIEW, atau KOLOM -- hanya fungsi.
//   - TIDAK memeriksa isi kebijakan RLS. Fungsi yang izinnya rapat tetap bisa membocorkan
//     data bila RLS tabel yang dibacanya longgar; itu wilayah pengawas lain.
//   - TIDAK memeriksa apakah fungsinya BENAR, hanya siapa yang boleh menjalankannya.
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Audit keamanan menyeluruh (19 Agu 2026), dipicu temuan nyata: decide_production_
// standard_proposal() bisa dipanggil anon key TANPA login sama sekali, melewati
// gerbang role app layer total. Enumerasi menyeluruh (lewat debug_list_function_
// grants(), migration 20260819140000/150000) menemukan pola yang SAMA di 12
// fungsi lain -- semuanya SECURITY DEFINER, menulis data nyata atau membaca data
// sensitif, TANPA pemeriksaan internal apa pun, dengan grant PUBLIC/anon/
// authenticated yang seharusnya tidak pernah ada (default Postgres + default
// privileges platform Supabase, TIDAK tercabut oleh "revoke ... from public" saja
// -- harus eksplisit revoke dari anon DAN authenticated juga).
//
// Test ini membalik default-nya: SETIAP fungsi baru di schema public otomatis
// DILARANG punya PUBLIC/anon/authenticated execute KECUALI masuk ALLOWLIST di
// bawah dengan alasan tertulis. Migrasi baru yang menambah fungsi sensitif tanpa
// mengupdate allowlist ini SENGAJA akan membuat test ini GAGAL -- itu instrumen
// pencegahannya, bukan bug.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

// Fungsi yang BOLEH punya PUBLIC/anon/authenticated execute, dengan alasan.
// Perbarui daftar ini SECARA SADAR kalau ada fungsi baru yang genuinely perlu
// akses luas -- jangan tambah tanpa menulis alasannya di sini.
const ALLOWED_BROAD_GRANT: Record<string, string> = {
  // Helper JWT murni -- hanya membaca klaim token PEMANGGIL SENDIRI, dan dipakai
  // di dalam banyak ekspresi RLS policy (harus tetap EXECUTE untuk
  // anon/authenticated, kalau tidak RLS yang memakainya akan gagal total untuk
  // semua user sungguhan).
  jwt_company_id: 'RLS-policy helper, hanya baca klaim JWT pemanggil sendiri',
  jwt_app_role: 'RLS-policy helper, hanya baca klaim JWT pemanggil sendiri',
  jwt_can_view_financial_data: 'RLS-policy helper, hanya baca klaim JWT pemanggil sendiri',
  jwt_can_view_wages: 'RLS-policy helper, hanya baca klaim JWT pemanggil sendiri',
  jwt_is_company_leadership: 'RLS-policy helper, hanya baca klaim JWT pemanggil sendiri',
  jwt_managed_department: 'RLS-policy helper, hanya baca klaim JWT pemanggil sendiri',
  jwt_document_department: 'RLS-policy helper (Master Dokumen MD-1, 26 Agu 2026), hanya baca klaim JWT pemanggil sendiri',
  employee_belongs_to_current_user: 'RLS-policy helper dengan pemeriksaan internal, dipakai di policy employee_attendance',
  employee_matches_managed_department: 'RLS-policy helper dengan pemeriksaan internal, dipakai di policy employee_attendance',
  // Bukan SECURITY DEFINER -- berjalan sebagai pemanggil, jadi RLS tabel yang
  // dirujuk (lots/system_alerts) tetap jadi gerbang sesungguhnya.
  suggest_fefo_lots: 'Bukan SECURITY DEFINER -- RLS tabel lots tetap berlaku untuk pemanggil',
  work_order_is_blocked: 'Bukan SECURITY DEFINER -- RLS tabel system_alerts tetap berlaku untuk pemanggil',
  bom_component_creates_cycle: 'Bukan SECURITY DEFINER -- RLS tabel bom_lines/boms tetap berlaku untuk pemanggil',
  // SENGAJA publik (jalur tanpa login) -- guard internalnya token+status, bukan role.
  confirm_delivery: 'Jalur POD publik sengaja tanpa login -- guard internal: pod_token harus cocok shipment status=shipped',
  // SECURITY DEFINER TAPI sudah punya pemeriksaan jwt_company_id()/role internal
  // yang terbukti benar (baca kode + verifikasi test) -- broad grant di sini aman
  // karena fungsi sendiri yang menolak, bukan grant yang menahan.
  get_monthly_operating_profit: 'SECURITY DEFINER + wajib_identitas_tenant() gagal-tertutup; anon dicabut (SEC-21)',
  get_production_batch_labor_cost_detail: 'SECURITY DEFINER + wajib_identitas_tenant() gagal-tertutup; anon dicabut (SEC-21)',
  get_production_batch_labor_cost_total: 'SECURITY DEFINER + wajib_identitas_tenant() gagal-tertutup; anon dicabut (SEC-21)',
  get_sales_order_margin: 'SECURITY DEFINER + wajib_identitas_tenant() gagal-tertutup; anon dicabut (SEC-21)',
  get_work_order_labor_cost_total: 'SECURITY DEFINER + wajib_identitas_tenant() gagal-tertutup; anon dicabut (SEC-21)',
  // SEC-21 (29 Agu 2026) -- alasan lama berbunyi "sudah punya pemeriksaan internal yang
  // TERBUKTI BENAR". Itu ternyata TIDAK BENAR: pemeriksaannya memakai `<>` dan `not`
  // terhadap nilai yang bernilai NULL tanpa JWT, sehingga `if NULL` tidak pernah
  // dieksekusi dan gerbangnya GAGAL TERBUKA. Dibuktikan dengan pemanggil anon yang
  // benar-benar MEMBUAT Sales Order. Sejak SEC-21: anon dicabut, dan tiap fungsi
  // dibuka dengan wajib_identitas_tenant() yang menolak lebih dulu.
  process_customer_purchase_order: 'SECURITY DEFINER + wajib_identitas_tenant() gagal-tertutup; anon dicabut (SEC-21)',
  // WS-S05 (29 Agu 2026) -- ketiga aksi PO klien HARUS bisa dipanggil `authenticated`,
  // karena itulah cara aplikasi memanggilnya (klien ber-sesi pengguna, bukan service
  // role -- fungsi-fungsi ini menegakkan wewenangnya lewat klaim JWT, dan service role
  // tidak membawa klaim apa pun). PUBLIC dan anon SUDAH DICABUT lewat migrasi
  // 20260906130000; yang tersisa hanya authenticated.
  //
  // Alasan ini baru menjadi BENAR setelah migrasi itu, dan itu perlu ditulis: versi
  // pertama fungsi-fungsi ini memakai `<>` dan `not` terhadap nilai yang bisa NULL,
  // sehingga untuk pemanggil TANPA klaim JWT kedua gerbangnya menghasilkan NULL dan
  // `if NULL` TIDAK PERNAH dieksekusi -- gerbangnya DILEWATI, bukan menolak. Diperbaiki
  // dengan `is distinct from` + coalesce(..., false) di migrasi yang sama.
  tahan_po_klien: 'SECURITY DEFINER dengan jwt_company_id()+jwt_decision_department() internal; PUBLIC/anon dicabut (20260906130000)',
  lepas_po_klien: 'SECURITY DEFINER dengan jwt_company_id()+jwt_decision_department()+pemilik tahanan internal; PUBLIC/anon dicabut (20260906130000)',
  batalkan_po_klien: 'SECURITY DEFINER dengan jwt_company_id()+jwt_is_company_leadership() internal; PUBLIC/anon dicabut (20260906130000)',
  jwt_decision_department: 'RLS-policy helper, hanya baca klaim JWT pemanggil sendiri; PUBLIC/anon dicabut (20260906130000)',
  // WS-SALES-CANCEL (29 Agu 2026) -- keduanya HARUS bisa dipanggil `authenticated`,
  // karena itulah cara aplikasi memanggilnya lewat klien ber-sesi pengguna. Keduanya
  // dibuka dengan wajib_identitas_tenant() dan memakai coalesce pada gerbang peran,
  // jadi tanpa identitas/perusahaan/peran mereka menolak, bukan melewati.
  // PUBLIC dan anon sudah dicabut di migrasi 20260910110000.
  ajukan_pembatalan: 'SECURITY DEFINER + wajib_identitas_tenant() + gerbang departemen; PUBLIC/anon dicabut (WS-SALES-CANCEL)',
  putuskan_pembatalan: 'SECURITY DEFINER + wajib_identitas_tenant() + gerbang leadership ber-coalesce + pemisahan pemohon/pemutus; PUBLIC/anon dicabut (WS-SALES-CANCEL)',
  // DEC-S05 (29 Agu 2026) -- dipanggil aplikasi lewat klien ber-sesi pengguna, jadi
  // HARUS bisa `authenticated`. Dibuka dengan wajib_identitas_tenant(), gerbang perannya
  // memakai coalesce, dan kepemilikan perusahaan diperiksa dengan `is distinct from`.
  // PUBLIC/anon dicabut di migrasi 20260911110000.
  terapkan_payment_terms: 'SECURITY DEFINER + wajib_identitas_tenant() + gerbang peran komersial ber-coalesce; PUBLIC/anon dicabut (DEC-S05)',
  // PJL-03 (29 Agu 2026) -- keempatnya dipanggil aplikasi lewat klien ber-sesi pengguna.
  // Dua yang membaca tetap butuh identitas: kelayakan menolak Sales Order milik perusahaan
  // lain, dan versi "semua" dibuka dengan wajib_identitas_tenant(). PUBLIC/anon dicabut di
  // migrasi 20260912110000. PENYELESAIAN TIDAK MEMERIKSA PEMBAYARAN -- itu aturan bisnis,
  // bukan kelalaian gerbang.
  kelayakan_penyelesaian_so: 'SECURITY DEFINER membaca-saja + pemeriksaan kepemilikan perusahaan; PUBLIC/anon dicabut (PJL-03)',
  kelayakan_penyelesaian_so_semua: 'SECURITY DEFINER membaca-saja + wajib_identitas_tenant() + saring company_id; PUBLIC/anon dicabut (PJL-03)',
  konfirmasi_pemenuhan_sales_order: 'SECURITY DEFINER + wajib_identitas_tenant() + gerbang departemen ppic + kunci baris SO; PUBLIC/anon dicabut (PJL-03)',
  selesaikan_sales_order: 'SECURITY DEFINER + wajib_identitas_tenant() + gerbang leadership ber-coalesce + pemisahan pengonfirmasi/penutup + penjaga data basi; PUBLIC/anon dicabut (PJL-03)',
  // DEC-S13 (30 Agu 2026) -- pelepasan darurat penghalang PO klien. Dipanggil aplikasi lewat
  // klien ber-sesi pengguna. Wewenangnya BERNAMA SENDIRI (jwt_boleh_lepas_darurat), bukan
  // disimpulkan dari "kebetulan pimpinan", dan gerbangnya ber-coalesce.
  // PUBLIC/anon dicabut di migrasi 20260913100000.
  jwt_boleh_lepas_darurat: 'Penolong wewenang darurat (DEC-S13). Butuh authenticated karena dipanggil dari fungsi yang dipanggil pengguna; anon dicabut',
  pasang_konteks_darurat: 'Menitipkan dasar wewenang + departemen yang dilampaui ke konteks transaksi; memanggil pasang_konteks_keputusan() yang sudah ada lebih dulu (DEC-S13)',
  lepas_darurat_po_klien: 'SECURITY DEFINER + wajib_identitas_tenant() + gerbang wewenang darurat ber-coalesce + larangan jalan pintas departemen sendiri; PUBLIC/anon dicabut (DEC-S13)',
  wajib_identitas_tenant: 'Gerbang gagal-tertutup itu sendiri: menolak pemanggil tanpa identitas/konteks perusahaan. Butuh authenticated karena dipanggil dari fungsi yang dipanggil pengguna; anon dicabut (SEC-21)',
  get_employee_cost_category: 'SECURITY DEFINER dengan jwt_company_id()+leadership/financial/hr_manager internal (MRG-11, 23 Agu 2026 -- diperbaiki setelah audit ini menangkap versi awal tanpa pemeriksaan)',
  // SEDANG (bukan RENDAH) -- terbukti dipakai di RLS policy sungguhan
  // (companies_insert_admin, subscription_plans admin policies) lewat
  // pg_policies -- revoke dari authenticated akan MEMATIKAN RLS itu untuk semua
  // user. Redesign signature (buang parameter, pakai auth.uid() internal) adalah
  // pekerjaan TERPISAH yang butuh persetujuan eksplisit sebelum dieksekusi
  // (lihat HANDOFF.md) -- JANGAN pindahkan dari daftar ini tanpa migrasi yang
  // benar-benar mengganti signature & re-test seluruh RLS yang memakainya.
  is_super_admin_user: 'MASIH dipakai RLS subscription_plans_* -- redesign signature pending persetujuan, lihat HANDOFF.md',
  user_has_no_company: 'MASIH dipakai RLS companies_insert_admin -- redesign signature pending persetujuan, lihat HANDOFF.md'
};

describe('Audit keamanan fungsi database — tidak boleh ada fungsi kritis dengan EXECUTE untuk PUBLIC/anon/authenticated', () => {
  it('enumerasi seluruh fungsi public: hanya yang di-allowlist boleh punya grant luas', async () => {
    const { data, error } = await adminClient.rpc('debug_list_function_grants');
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(30); // sanity check -- pastikan enumerasi benar-benar jalan, bukan hasil kosong

    const violations: string[] = [];
    for (const fn of data as { function_name: string; return_type: string; grants: string[] }[]) {
      // Fungsi trigger/event_trigger TERBUKTI (lihat catatan HANDOFF.md, diuji
      // langsung dgn anon key DAN service_role) tidak bisa dipanggil lewat RPC
      // PostgREST sama sekali -- pengecualian struktural, bukan judgment call
      // per-fungsi, jadi aman dikecualikan otomatis berdasar return_type.
      if (fn.return_type === 'trigger' || fn.return_type === 'event_trigger') continue;

      if (fn.function_name in ALLOWED_BROAD_GRANT) continue;

      const hasBroadGrant = fn.grants.some((g) => g.startsWith('PUBLIC=') || g.startsWith('anon=') || g.startsWith('authenticated='));
      if (hasBroadGrant) {
        violations.push(`${fn.function_name}: ${JSON.stringify(fn.grants)}`);
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Fungsi berikut punya EXECUTE untuk PUBLIC/anon/authenticated TANPA masuk allowlist -- ` +
          `kalau ini fungsi baru yang genuinely perlu akses luas, tambahkan ke ALLOWED_BROAD_GRANT ` +
          `dengan alasan tertulis; kalau tidak, tambal lewat migrasi (revoke from public, anon, authenticated ` +
          `+ grant selektif) sebelum melaporkan pekerjaan selesai:\n${violations.join('\n')}`
      );
    }
  });

  it('REGRESI: 12 fungsi kritis yang ditambal 19 Agu 2026 terbukti HANYA bisa dieksekusi service_role/postgres', async () => {
    const { data, error } = await adminClient.rpc('debug_list_function_grants');
    expect(error).toBeNull();
    const criticalFixed = [
      'record_manual_stock_adjustment',
      'create_opening_balance_lot',
      'create_shipment_with_signature',
      'compute_production_batch_labor_cost',
      'resolve_department_alerts',
      'upsert_department_alert',
      'recompute_stock_projection_for_item',
      'recompute_work_order_machine_readiness',
      'recompute_work_order_material_readiness',
      'recompute_work_order_worker_readiness',
      'debug_list_policies',
      'propose_production_standard',
      'decide_production_standard_proposal'
    ];
    const byName = new Map((data as { function_name: string; grants: string[] }[]).map((f) => [f.function_name, f.grants]));
    for (const name of criticalFixed) {
      const grants = byName.get(name);
      expect(grants, `${name} tidak ditemukan di enumerasi`).toBeDefined();
      const allowedRoles = new Set(['postgres', 'service_role']);
      for (const g of grants!) {
        const role = g.split('=')[0];
        expect(allowedRoles.has(role), `${name} punya grant ke role tak terduga: ${g}`).toBe(true);
      }
    }
  });

  it('debug_schema_snapshot() sudah DIHAPUS total (bukan cuma dicabut aksesnya)', async () => {
    const { data } = await adminClient.rpc('debug_list_function_grants');
    const exists = (data as { function_name: string }[]).some((f) => f.function_name === 'debug_schema_snapshot');
    expect(exists).toBe(false);
  });
});
