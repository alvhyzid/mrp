// Daftar role harus selalu sinkron dengan CHECK constraint users_role_check di
// supabase/migrations/20260812150000_role_hierarchy_helpers.sql.

export const SUPER_ADMIN_ROLE = 'super_admin';

// Semua role yang terikat ke satu company (super_admin sengaja tidak termasuk —
// dia lintas-tenant dan tidak muncul di UI level company).
export const COMPANY_ROLES = [
  'company_admin',
  'general_manager',
  'production_manager',
  'production_staff',
  'ppic_manager',
  'ppic_staff',
  'finance_manager',
  'finance_staff',
  'purchasing_manager',
  'purchasing_staff',
  'warehouse_manager',
  'warehouse_staff',
  'hr_manager',
  'hr_staff',
  'viewer'
];

// Role yang boleh dipilih saat mengundang anggota baru — company_admin sengaja
// dikecualikan (bukan alur pembuatan admin baru).
export const INVITABLE_ROLES = COMPANY_ROLES.filter((role) => role !== 'company_admin');

// company_admin & general_manager setara di level operasional (lihat catatan role
// di docs/rancangan-skema-database-mrp.md).
export const LEADERSHIP_ROLES = ['company_admin', 'general_manager'];

export function isCompanyLeadership(role: string | undefined | null): boolean {
  return !!role && LEADERSHIP_ROLES.includes(role);
}

// Role yang boleh melihat data finansial gabungan (harga jual/margin/biaya standar) —
// TAPI BUKAN gaji individual. Lihat "Kontrol Akses Data Finansial" di docs.
export const FINANCIAL_DATA_ROLES = ['company_admin', 'general_manager', 'finance_manager'];

export function canViewFinancialData(role: string | undefined | null): boolean {
  return !!role && FINANCIAL_DATA_ROLES.includes(role);
}
