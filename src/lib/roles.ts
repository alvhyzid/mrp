// Daftar role harus selalu sinkron dengan CHECK constraint users_role_check di
// supabase/migrations/20260812150000_role_hierarchy_helpers.sql.

export const SUPER_ADMIN_ROLE = 'super_admin';

// Semua role yang terikat ke satu company (super_admin sengaja tidak termasuk —
// dia lintas-tenant dan tidak muncul di UI level company).
export const COMPANY_ROLES = [
  'company_admin',
  'general_manager',
  'admin_staff',
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

// Role yang boleh mengelola suppliers/purchase_orders/purchase_order_lines — harus
// sinkron dengan policy suppliers_write_purchasing / purchase_orders_write_purchasing
// / purchase_order_lines_write_purchasing di
// supabase/migrations/20260812152000_suppliers_purchase_orders.sql.
export const PURCHASING_MANAGE_ROLES = [...LEADERSHIP_ROLES, 'purchasing_manager', 'purchasing_staff'];

export function canManagePurchasing(role: string | undefined | null): boolean {
  return !!role && PURCHASING_MANAGE_ROLES.includes(role);
}

// unit_price di purchase_order_lines: boleh dilihat Purchasing (mereka yang input)
// SELAIN role finansial gabungan — lihat "Kontrol Akses Data Finansial" di docs,
// baris "Harga di PO ke supplier". Sejalan dengan view purchase_order_lines_secure.
export function canViewPurchaseOrderPrice(role: string | undefined | null): boolean {
  return canViewFinancialData(role) || (!!role && ['purchasing_manager', 'purchasing_staff'].includes(role));
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
// supabase/migrations/20260812153100_customer_purchase_orders.sql (+ admin_staff
// ditambahkan di supabase/migrations/20260814100000_admin_staff_role.sql).
export const CUSTOMER_PO_MANAGE_ROLES = [...LEADERSHIP_ROLES, 'ppic_manager', 'ppic_staff', 'admin_staff'];

export function canManageCustomerPo(role: string | undefined | null): boolean {
  return !!role && CUSTOMER_PO_MANAGE_ROLES.includes(role);
}

// Subset lebih sempit dari CUSTOMER_PO_MANAGE_ROLES — khusus tombol pintasan
// "Buat PO" di header (bukan izin akses halaman PO Client itu sendiri, yang tetap
// terbuka juga untuk ppic_manager/ppic_staff seperti sebelumnya).
export const CUSTOMER_PO_QUICK_CREATE_ROLES = [...LEADERSHIP_ROLES, 'admin_staff'];

export function canQuickCreateCustomerPo(role: string | undefined | null): boolean {
  return !!role && CUSTOMER_PO_QUICK_CREATE_ROLES.includes(role);
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

// Penyesuaian stok manual (adjustment) SENGAJA lebih sempit dari
// WAREHOUSE_ROLES di atas — bukan warehouse_staff biasa, ini aksi sensitif
// (langsung ubah quantity_on_hand tanpa lewat penerimaan/produksi/pengiriman)
// yang butuh level manager ke atas.
export const STOCK_ADJUSTMENT_ROLES = [...LEADERSHIP_ROLES, 'warehouse_manager'];

export function canAdjustStock(role: string | undefined | null): boolean {
  return !!role && STOCK_ADJUSTMENT_ROLES.includes(role);
}

export const HR_DASHBOARD_ROLES = [...LEADERSHIP_ROLES, 'hr_manager', 'hr_staff'];

export function canAccessHrDashboard(role: string | undefined | null): boolean {
  return !!role && HR_DASHBOARD_ROLES.includes(role);
}

// Prinsip Desain #8 (docs/rancangan-skema-database-mrp.md): begitu login, user
// diarahkan ke dashboard sesuai role/department mereka — murni routing/tampilan,
// data yang dipakai tetap sama (cuma difilter beda). Purchasing dipetakan ke
// /purchasing sejak halaman itu dibangun (Prioritas 1, 15 Agu 2026). Finance
// staff & manager sengaja MASIH TIDAK dipetakan — belum ada dashboard department
// finance. company_admin/general_manager/super_admin/viewer SENGAJA juga tidak
// dipetakan — mereka melihat ringkasan lintas-department di /dashboard, bukan
// diarahkan ke satu department tertentu.
const ROLE_DASHBOARD_ROUTES: Record<string, string> = {
  warehouse_manager: '/warehouse',
  warehouse_staff: '/warehouse',
  hr_manager: '/hr',
  hr_staff: '/hr',
  ppic_manager: '/ppic',
  ppic_staff: '/ppic',
  production_manager: '/production',
  production_staff: '/production',
  purchasing_manager: '/purchasing',
  purchasing_staff: '/purchasing'
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

// Department SETIAP role (manager & staff), dipakai untuk menyaring
// system_alerts.target_department yang relevan buat user login (Bell Icon
// Notifikasi) — beda dari MANAGED_DEPARTMENT_BY_ROLE di atas yang cuma untuk
// role manager (dipakai scoping employee_attendance). company_admin/
// general_manager/admin_staff/viewer sengaja null di sini — leadership lihat
// SEMUA alert lewat isCompanyLeadership(), bukan lewat department tunggal.
const DEPARTMENT_BY_ROLE: Record<string, string> = {
  production_manager: 'production',
  production_staff: 'production',
  ppic_manager: 'ppic',
  ppic_staff: 'ppic',
  finance_manager: 'finance',
  finance_staff: 'finance',
  purchasing_manager: 'purchasing',
  purchasing_staff: 'purchasing',
  warehouse_manager: 'warehouse',
  warehouse_staff: 'warehouse',
  hr_manager: 'hr',
  hr_staff: 'hr'
};

export function getDepartmentForRole(role: string | undefined | null): string | null {
  if (!role) return null;
  return DEPARTMENT_BY_ROLE[role] ?? null;
}

// Kebalikan dari canApproveDepartment() — dipakai dashboard PPIC/Finance untuk
// menyaring "PO client menunggu approval BAGIAN SAYA" tanpa perlu client menebak
// nama department-nya sendiri. Tetap harus sinkron dengan canApproveDepartment().
export function getApprovalDepartmentForRole(role: string | undefined | null): string | null {
  if (!role) return null;
  if (role === 'finance_manager') return 'finance';
  if (role === 'ppic_manager') return 'ppic';
  if (isCompanyLeadership(role)) return 'manager';
  return null;
}

export const PPIC_DASHBOARD_ROLES = [...LEADERSHIP_ROLES, 'ppic_manager', 'ppic_staff'];

export function canAccessPpicDashboard(role: string | undefined | null): boolean {
  return !!role && PPIC_DASHBOARD_ROLES.includes(role);
}

export const PRODUCTION_DASHBOARD_ROLES = [...LEADERSHIP_ROLES, 'production_manager', 'production_staff'];

export function canAccessProductionDashboard(role: string | undefined | null): boolean {
  return !!role && PRODUCTION_DASHBOARD_ROLES.includes(role);
}

// Role yang boleh mengubah work_centers (termasuk capacity_hours_per_day) — harus
// sinkron dengan policy work_centers_write_production di
// supabase/migrations/20260812153000_bom_routing_workcenters.sql. Sengaja BUKAN
// termasuk *_staff — sama seperti policy DB-nya, hanya level manager ke atas.
export const WORK_CENTER_MANAGE_ROLES = [...LEADERSHIP_ROLES, 'production_manager', 'ppic_manager'];

export function canManageWorkCenterCapacity(role: string | undefined | null): boolean {
  return !!role && WORK_CENTER_MANAGE_ROLES.includes(role);
}

// Role yang boleh mencatat progres tahap produksi (work_order_step_progress) —
// disamakan dengan yang boleh mengelola Work Order (production + PPIC + leadership),
// bukan set baru.
export function canRecordStepProgress(role: string | undefined | null): boolean {
  return canManageWorkOrder(role);
}

// Role yang boleh mencatat/menyelesaikan production_disruptions — harus sinkron
// dengan policy production_disruptions_write_production di
// supabase/migrations/20260812154000_system_alerts_and_wo_readiness.sql. Sengaja
// BUKAN termasuk ppic_staff (beda dari WORK_ORDER_MANAGE_ROLES) — sama seperti
// policy DB-nya.
export const PRODUCTION_DISRUPTION_MANAGE_ROLES = [...LEADERSHIP_ROLES, 'production_manager', 'production_staff', 'ppic_manager'];

export function canManageProductionDisruptions(role: string | undefined | null): boolean {
  return !!role && PRODUCTION_DISRUPTION_MANAGE_ROLES.includes(role);
}
