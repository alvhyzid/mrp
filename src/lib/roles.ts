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

// Role yang boleh mengelola BOM (resep) — harus sinkron dengan policy
// boms_write_ppic / bom_lines_write_ppic di
// supabase/migrations/20260812153000_bom_routing_workcenters.sql.
export const BOM_MANAGE_ROLES = [...LEADERSHIP_ROLES, 'ppic_manager', 'ppic_staff', 'production_manager'];

export function canManageBom(role: string | undefined | null): boolean {
  return !!role && BOM_MANAGE_ROLES.includes(role);
}

// Role yang boleh mengelola customer & PO client — harus sinkron dengan policy
// customers_write_ppic / customer_purchase_orders_insert_ppic di
// supabase/migrations/20260812153100_customer_purchase_orders.sql.
export const CUSTOMER_PO_MANAGE_ROLES = [...LEADERSHIP_ROLES, 'ppic_manager', 'ppic_staff'];

export function canManageCustomerPo(role: string | undefined | null): boolean {
  return !!role && CUSTOMER_PO_MANAGE_ROLES.includes(role);
}

// Pemetaan department approval PO client -> role yang boleh approve/reject-nya.
// Harus sinkron dengan catatan "Pemetaan department ke role" di
// docs/rancangan-skema-database-mrp.md dan policy
// customer_po_approvals_update_by_department.
export function canApproveDepartment(role: string | undefined | null, department: string): boolean {
  if (!role) return false;
  if (department === 'finance') return role === 'finance_manager';
  if (department === 'ppic') return role === 'ppic_manager';
  if (department === 'manager') return isCompanyLeadership(role);
  return false;
}

// Role yang boleh membuat/mengelola Work Order — harus sinkron dengan policy
// work_orders_write_production di
// supabase/migrations/20260812153500_work_orders.sql.
export const WORK_ORDER_MANAGE_ROLES = [...LEADERSHIP_ROLES, 'ppic_manager', 'ppic_staff', 'production_manager', 'production_staff'];

export function canManageWorkOrder(role: string | undefined | null): boolean {
  return !!role && WORK_ORDER_MANAGE_ROLES.includes(role);
}

// Role yang boleh mengelola karyawan & absensi (HR) — harus sinkron dengan policy
// employees_write_hr / employee_attendance_write_hr di
// supabase/migrations/20260812151500_company_settings_and_employees.sql dan
// supabase/migrations/20260813120000_employee_department_and_attendance.sql.
export const HR_MANAGE_ROLES = ['company_admin', 'hr_manager', 'hr_staff'];

export function canManageHr(role: string | undefined | null): boolean {
  return !!role && HR_MANAGE_ROLES.includes(role);
}

export const WAREHOUSE_ROLES = [...LEADERSHIP_ROLES, 'warehouse_manager', 'warehouse_staff'];

export function canAccessWarehouseDashboard(role: string | undefined | null): boolean {
  return !!role && WAREHOUSE_ROLES.includes(role);
}

export const HR_DASHBOARD_ROLES = [...LEADERSHIP_ROLES, 'hr_manager', 'hr_staff'];

export function canAccessHrDashboard(role: string | undefined | null): boolean {
  return !!role && HR_DASHBOARD_ROLES.includes(role);
}

// Prinsip Desain #8 (docs/rancangan-skema-database-mrp.md): begitu login, user
// diarahkan ke dashboard sesuai role/department mereka — murni routing/tampilan,
// data yang dipakai tetap sama (cuma difilter beda). Role yang belum punya dashboard
// khusus (PPIC/Production/Purchasing/Finance staff & manager) sengaja TIDAK dipetakan
// di sini dulu — mereka tetap di /dashboard (ringkasan umum) sampai dashboard
// department-nya dibangun menyusul. company_admin/general_manager/super_admin/viewer
// SENGAJA juga tidak dipetakan — mereka melihat ringkasan lintas-department di
// /dashboard, bukan diarahkan ke satu department tertentu.
const ROLE_DASHBOARD_ROUTES: Record<string, string> = {
  warehouse_manager: '/warehouse',
  warehouse_staff: '/warehouse',
  hr_manager: '/hr',
  hr_staff: '/hr'
};

export function getDashboardRouteForRole(role: string | undefined | null): string | null {
  if (!role) return null;
  return ROLE_DASHBOARD_ROUTES[role] ?? null;
}

// Pemetaan role manager department -> department yang mereka kelola — HARUS sinkron
// dengan fungsi SQL jwt_managed_department() di
// supabase/migrations/20260813120000_employee_department_and_attendance.sql.
// Dipakai lapisan aplikasi (service-role client, tidak lewat RLS) untuk meniru
// scoping yang sama saat menyaring employee_attendance.
const MANAGED_DEPARTMENT_BY_ROLE: Record<string, string> = {
  production_manager: 'production',
  ppic_manager: 'ppic',
  finance_manager: 'finance',
  purchasing_manager: 'purchasing',
  warehouse_manager: 'warehouse'
};

export function getManagedDepartmentForRole(role: string | undefined | null): string | null {
  if (!role) return null;
  return MANAGED_DEPARTMENT_BY_ROLE[role] ?? null;
}
