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
  // WS-SALES-ROLE (29 Agu 2026) -- peran Sales TERSENDIRI, keputusan pemilik produk.
  //
  // KENAPA NAMA PERAN, BUKAN TABEL IZIN. Disensus lebih dulu: FABRIX TIDAK punya tabel
  // roles/permissions/role_permissions/departments -- nol, seluruhnya. Yang ada adalah
  // kolom teks users.role berkekangan CHECK plus predikat di berkas ini (diimpor 113
  // berkas) dan perbandingan jwt_app_role() di kebijakan RLS. Jadi nama peran ITULAH
  // mekanisme kanoniknya; membuat tabel izin baru justru melanggar larangan membangun
  // sistem peran PARALEL.
  //
  // `admin_staff` BUKAN Sales dan TIDAK disentuh sedikit pun -- lihat catatan di
  // CUSTOMER_PO_MANAGE_ROLES di bawah.
  'sales',
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

// Role yang boleh melihat gaji individual (employees.wage_rate/wage_type, & rincian
// SDM per-orang di batch produksi) — harus sinkron dengan jwt_can_view_wages() di
// supabase/migrations/20260812150000_role_hierarchy_helpers.sql. general_manager &
// finance_manager SENGAJA tidak termasuk di sini (lihat docs).
export const WAGE_VIEW_ROLES = ['company_admin', 'hr_manager', 'hr_staff'];

export function canViewWages(role: string | undefined | null): boolean {
  return !!role && WAGE_VIEW_ROLES.includes(role);
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
// `sales` DITAMBAHKAN, `admin_staff` TETAP. Keduanya berdampingan dan itu disengaja:
// pemilik produk menyatakan admin_staff BUKAN Sales, jadi ia tidak diganti, tidak
// dilabeli ulang, dan tidak kehilangan apa pun. Yang terjadi hanyalah Sales kini
// punya wewenangnya sendiri.
//
// Predikat ini menjaga tiga hal sekaligus (halaman Pelanggan, createCustomer,
// updateCustomer, dan PO klien), sehingga menambahkan `sales` di sini memberi Sales
// PERSIS lingkup yang ditetapkan: pelanggan dan PO klien -- bukan yang lain.
export const CUSTOMER_PO_MANAGE_ROLES = [...LEADERSHIP_ROLES, 'ppic_manager', 'ppic_staff', 'admin_staff', 'sales'];

export function canManageCustomerPo(role: string | undefined | null): boolean {
  return !!role && CUSTOMER_PO_MANAGE_ROLES.includes(role);
}

// Subset lebih sempit dari CUSTOMER_PO_MANAGE_ROLES — khusus tombol pintasan
// "Buat PO" di header (bukan izin akses halaman PO Client itu sendiri, yang tetap
// terbuka juga untuk ppic_manager/ppic_staff seperti sebelumnya).
export const CUSTOMER_PO_QUICK_CREATE_ROLES = [...LEADERSHIP_ROLES, 'admin_staff', 'sales'];

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

// Departemen keputusan pengguna -- BUKAN wewenang menyetujui.
//
// Dipisahkan dari canApproveDepartment() DENGAN SENGAJA, dan pemisahan ini adalah inti
// pemisahan tugas: Sales boleh MENAHAN PO klien karena penghalangnya miliknya (BD-06),
// tetapi Sales TIDAK PERNAH menjadi salah satu dari tiga departemen yang MENYETUJUI.
// Menggabungkan keduanya jadi satu fungsi akan membuat penambahan `sales` di sini
// diam-diam memberinya hak persetujuan.
//
// WAJIB sinkron dengan jwt_decision_department() di basis data (migrasi 20260909100000).
export function decisionDepartment(role: string | undefined | null): string | null {
  if (!role) return null;
  if (role === 'finance_manager') return 'finance';
  if (role === 'ppic_manager') return 'ppic';
  if (role === 'sales') return 'sales';
  if (isCompanyLeadership(role)) return 'manager';
  return null;
}

// DEC-S13 — WEWENANG PELEPASAN DARURAT PENGHALANG.
//
// DIPERSEMPIT 30 Agu 2026 atas keputusan pemilik produk: HANYA General Manager.
// `company_admin` SENGAJA TIDAK termasuk meski ia kepemimpinan — ia peran ADMINISTRATOR
// SISTEM (mengelola pengguna, undangan, setelan), dan wewenang teknis tidak boleh diam-diam
// menjadi wewenang komersial pada aksi yang melampaui keputusan departemen lain.
//
// Inilah gunanya wewenang ini punya NAMA SENDIRI sejak awal: mempersempitnya menyentuh satu
// konstanta di sini dan satu fungsi di basis data — nol tempat lain.
//
// WAJIB sinkron dengan jwt_boleh_lepas_darurat() (migrasi 20260914120000).
export const EMERGENCY_HOLD_RELEASE_ROLES = ['general_manager'];

export function canEmergencyReleaseHold(role: string | undefined | null): boolean {
  if (!role) return false;
  return EMERGENCY_HOLD_RELEASE_ROLES.includes(role);
}

// Role yang boleh membuat/mengelola Work Order — harus sinkron dengan policy
// work_orders_write_production di
// supabase/migrations/20260812153500_work_orders.sql.
export const WORK_ORDER_MANAGE_ROLES = [...LEADERSHIP_ROLES, 'ppic_manager', 'ppic_staff', 'production_manager', 'production_staff'];

export function canManageWorkOrder(role: string | undefined | null): boolean {
  return !!role && WORK_ORDER_MANAGE_ROLES.includes(role);
}

// PRD-12 (22 Agu 2026) — transisi status Work Order (selesai/jeda/batal) itu
// keputusan supervisor/PPIC, SENGAJA lebih sempit dari WORK_ORDER_MANAGE_ROLES
// (tidak termasuk *_staff) — pemilik produk menyebut "MANUAL oleh PPIC/
// supervisor", bukan staf lantai produksi.
export const WORK_ORDER_STATUS_ROLES = [...LEADERSHIP_ROLES, 'ppic_manager', 'production_manager'];

export function canSetWorkOrderStatus(role: string | undefined | null): boolean {
  return !!role && WORK_ORDER_STATUS_ROLES.includes(role);
}

// PRD-12 — membuka kembali Work Order completed/cancelled SENGAJA lebih
// sempit lagi daripada WORK_ORDER_STATUS_ROLES: keputusan pemilik produk
// eksplisit "company_admin atau manajer produksi" (BUKAN general_manager/
// ppic_manager) karena taruhannya konsumsi bahan sungguhan dari gudang.
export const WORK_ORDER_REOPEN_ROLES = ['company_admin', 'production_manager'];

export function canReopenWorkOrder(role: string | undefined | null): boolean {
  return !!role && WORK_ORDER_REOPEN_ROLES.includes(role);
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

// Penyesuaian stok manual (adjustment) — SEMULA sengaja dibatasi ke level manager
// ke atas (bukan warehouse_staff), tapi keputusan pemilik produk (temuan #4 audit
// jalan kaki, 19 Agu 2026): opname harian di lapangan memang dilakukan staf
// gudang biasa, bukan manager — warehouse_staff diikutkan. Skenario negatif TETAP
// berlaku untuk role DI LUAR gudang (mis. production_staff) — lihat gerbang
// internal di record_manual_stock_adjustment()/create_opening_balance_lot()
// (migration 20260819170000) untuk pertahanan yang sama di level database, bukan
// cuma app layer.
export const STOCK_ADJUSTMENT_ROLES = [...LEADERSHIP_ROLES, 'warehouse_manager', 'warehouse_staff'];

export function canAdjustStock(role: string | undefined | null): boolean {
  return !!role && STOCK_ADJUSTMENT_ROLES.includes(role);
}

// Shipments (Sesi 3B) — harus sinkron dengan policy shipments_write_warehouse /
// shipment_lines_write_warehouse di supabase/migrations/20260812155000_shipments_and_invoices.sql.
export const SHIPMENT_MANAGE_ROLES = [...LEADERSHIP_ROLES, 'warehouse_manager', 'warehouse_staff', 'ppic_manager'];

export function canManageShipments(role: string | undefined | null): boolean {
  return !!role && SHIPMENT_MANAGE_ROLES.includes(role);
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

// K8/Deteksi Konflik Perencanaan (Fase Produksi Nyata, P2) — SEBELUM ini digerbang
// canViewFinancialData (cuma company_admin/general_manager/finance_manager), yang
// SALAH begitu fitur ini benar-benar dirender di UI: PPIC dan Purchasing (yang
// justru paling butuh lihat kelayakan jadwal & kekurangan bahan) tidak termasuk.
export const PLANNING_FEASIBILITY_VIEW_ROLES = [...LEADERSHIP_ROLES, 'ppic_manager', 'ppic_staff', 'purchasing_manager', 'purchasing_staff'];

export function canViewPlanningFeasibility(role: string | undefined | null): boolean {
  return !!role && PLANNING_FEASIBILITY_VIEW_ROLES.includes(role);
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

// K8 (Fase Produksi Nyata, bagian D): siapa boleh MEMICU pengajuan usulan standar
// dari sebuah batch (learnFromBatch) — disamakan dengan yang boleh mencatat progres
// tahap produksi (mereka yang tahu kapan sebuah batch benar-benar selesai semua
// tahapnya), BUKAN berarti mereka yang mengesahkan usulannya (lihat fungsi di
// bawah — sengaja lebih sempit, planner-only).
export function canProposeProductionStandard(role: string | undefined | null): boolean {
  return canRecordStepProgress(role);
}

// Siapa boleh MENGESAHKAN (approve/reject) usulan standar — harus sinkron dengan
// docs/rencana-kerja-fase-produksi-nyata.md bagian D.1 ("disahkan planner
// (ppic_manager/company_admin)"). SENGAJA lebih sempit dari
// production_standards_write_ppic (RLS) yang juga mengizinkan ppic_staff/
// production_manager menulis production_standards secara umum — pengesahan
// FLIP sumber data standar adalah keputusan planner, bukan staf pencatat.
export const PRODUCTION_STANDARD_DECIDE_ROLES = [...LEADERSHIP_ROLES, 'ppic_manager'];

export function canDecideProductionStandardProposal(role: string | undefined | null): boolean {
  return !!role && PRODUCTION_STANDARD_DECIDE_ROLES.includes(role);
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

// Modul KPI (KPI-1) -- akses per-KPI (bukan satu daftar tetap) karena tiap KPI
// punya owner_role & domain sendiri (revisi-kpi-visibilitas-tanggung-jawab.md §1.1
// mendefinisikan visibility jsonb DIRI/ATASAN/DEPARTEMEN/PUBLIK_AGREGAT per KPI --
// disimpan untuk KPI-4, tapi ENFORCEMENT sesi ini pakai aturan lebih sederhana:
// leadership selalu boleh; role pemilik KPI (owner_role) boleh; role finance boleh
// untuk KPI berdomain uang (karena "Kontrol Akses Data Finansial" berlaku lintas
// modul, bukan cuma Margin Watch/BOM/Item yang sudah digerbang begitu).
const KPI_MONEY_METRIC_KEYS = ['metric.margin_kontribusi', 'metric.biaya_produksi_per_unit', 'metric.laba_operasional_bulanan', 'metric.nilai_persediaan'];

export function canViewKpi(role: string | undefined | null, kpi: { owner_role: string; metric_key: string }): boolean {
  if (!role) return false;
  if (isCompanyLeadership(role)) return true;
  if (role === kpi.owner_role) return true;
  if (KPI_MONEY_METRIC_KEYS.includes(kpi.metric_key) && canViewFinancialData(role)) return true;
  return false;
}

// Ubah target/visibility/attribution_level -- leadership-only (perubahan
// kebijakan tenant, bukan operasional harian), tercatat kpi_registry_history.
export function canManageKpiRegistry(role: string | undefined | null): boolean {
  return isCompanyLeadership(role);
}

// Master Dokumen MD-1 -- HARUS sinkron persis dengan jwt_document_department() di
// supabase/migrations/20260826110000_master_dokumen_md1.sql (listDocuments.ts pakai
// admin client + filter TypeScript ini, BUKAN RLS -- pola sama listKamusTerms.ts dkk --
// jadi visibilitas dokumen TERBATAS/DEPARTEMEN wajib ditegakkan DI SINI juga, RLS cuma
// jaring pengaman untuk akses PostgREST/storage langsung).
export function getDocumentDepartmentForRole(role: string | undefined | null): string | null {
  if (!role) return null;
  if (role.endsWith('_manager')) return role.slice(0, -'_manager'.length);
  if (role.endsWith('_staff')) return role.slice(0, -'_staff'.length);
  return null;
}

export function canViewDocument(role: string | undefined | null, docSensitivity: string, docDepartment: string | null): boolean {
  if (docSensitivity === 'UMUM') return true;
  if (isCompanyLeadership(role)) return true;
  const userDepartment = getDocumentDepartmentForRole(role);
  if (!userDepartment || userDepartment !== docDepartment) return false;
  if (docSensitivity === 'DEPARTEMEN') return true;
  if (docSensitivity === 'TERBATAS') return !!role && role.endsWith('_manager');
  return false;
}

// Hapus permanen berkas yatim (tanpa document_links) -- pemilik produk 26 Agu 2026:
// "hanya company_admin" (BUKAN general_manager, beda dari isCompanyLeadership biasa --
// tindakan destruktif ireversibel, sengaja lebih sempit daripada leadership umum).
export function canHardDeleteOrphanDocument(role: string | undefined | null): boolean {
  return role === 'company_admin';
}
