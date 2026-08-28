# SALES_CRM_PERMISSION_APPROVAL_RECONCILIATION

## Peran & izin

Lima fungsi izin menyentuh Sales: `canManageCustomerPo` · `canQuickCreateCustomerPo` ·
`canManageShipments` · `canProposeProductionStandard` · `canDecideProductionStandardProposal`.

Seluruhnya **diperiksa di server**, bukan hanya menyembunyikan tombol.

## Persetujuan PO klien — tiga departemen

- Pemicu `customer_purchase_orders_create_approvals` membuat **tiga baris otomatis** saat PO lahir.
- `UNIQUE(po_id, department)` menjamin tidak ada persetujuan ganda.
- Departemen dikunci CHECK: `finance` · `ppic` · `manager`.
- Task **SLS-06** mencatat bahwa satu pengguna **tidak** boleh menyetujui ketiganya, dan
  `company_admin` ditolak saat mencoba menyetujui departemen finance.

**Pemisahan tugas ditegakkan.** Ini termasuk yang paling kuat di seluruh permukaan Sales.

## Yang belum ada

Persetujuan harga/diskon · persetujuan quotation · persetujuan kontrak · persetujuan
perubahan SO — seluruhnya menunggu entitasnya lahir.

## Isolasi tenant
RLS aktif di 10 dari 10 tabel; satu tanpa kebijakan (lihat rekonsiliasi basis data).
