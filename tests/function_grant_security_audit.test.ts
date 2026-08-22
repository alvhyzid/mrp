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
  get_monthly_operating_profit: 'SECURITY DEFINER dengan jwt_company_id()+jwt_can_view_financial_data() internal',
  get_production_batch_labor_cost_detail: 'SECURITY DEFINER dengan jwt_company_id()+role check (company_admin only) internal',
  get_production_batch_labor_cost_total: 'SECURITY DEFINER dengan jwt_company_id()+jwt_can_view_wages()/financial internal',
  get_sales_order_margin: 'SECURITY DEFINER dengan jwt_company_id()+jwt_can_view_financial_data() internal',
  get_work_order_labor_cost_total: 'SECURITY DEFINER dengan jwt_company_id()+jwt_can_view_wages()/financial internal',
  process_customer_purchase_order: 'SECURITY DEFINER dengan jwt_company_id()+jwt_is_company_leadership() internal',
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
