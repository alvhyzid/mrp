# PJL-03 AS-IS COMPLETION AUDIT

**Tanggal:** 29 Agustus 2026 · **Sumber:** repositori + katalog basis data proyek nyata (hanya membaca)
**Aturan:** nol kesimpulan dari dokumentasi saja — tiap baris di bawah punya berkas atau kueri asalnya.

## 1. Keadaan Sales Order sekarang

`sales_orders.status` dikekang `CHECK` ke **empat** nilai: `confirmed` · `in_production` ·
`completed` · `cancelled`.

Nilai awal saat SO lahir: **`confirmed`** (`process_customer_purchase_order`).

## 2. Transisi penyelesaian sekarang

`status_transition_rules` untuk `sales_orders` memuat **empat** baris:

```
confirmed     -> in_production      confirmed     -> cancelled
in_production -> completed          in_production -> cancelled
```

**TEMUAN UTAMA:** `confirmed → completed` **TIDAK ADA**, dan **tidak ada satu pun kode yang
pernah menulis `in_production`**. Satu-satunya penulis status Sales Order di seluruh sistem
adalah `putuskan_pembatalan()`, yang menulis `cancelled`.

**Akibatnya hari ini:** setiap Sales Order berada di `confirmed` selamanya, dan jalur menuju
`completed` **tidak bisa dilalui sama sekali** — bukan karena tombolnya belum ada, melainkan
karena aturan transisinya tidak menyediakan jalannya.

## 3. Kaitan produksi

`work_orders.sales_order_line_id` menunjuk baris Sales Order. Kemajuan produksi **DITURUNKAN**
saat dibaca oleh `turunkanEksekusiSo()` (`src/features/mrp/server/eksekusiSalesOrder.ts`),
**nol kolom disimpan** di sisi Sales — sesuai AD-01/DEC-S11.

Aturan turunannya: Work Order berstatus `cancelled` **tidak dihitung**; `selesai` hanya bila
**seluruh** Work Order hidup berstatus `completed`.

## 4. Kaitan pengiriman

`sales_order_lines.qty_shipped` dipelihara **pemicu basis data** `shipments_process_shipped`
saat pengiriman diproses. Pengirimannya sendiri milik Logistik (`shipments`,
`create_shipment_with_signature`), dan Sales **tidak** menyimpan status pengiriman.

Turunannya: `penuh` hanya bila **setiap** baris `qty_shipped >= qty_ordered`; SO **tanpa baris**
dilaporkan `belum` — nol baris berarti tidak ada komitmen, bukan komitmen yang terpenuhi.

## 5. Bukti pemenuhan yang tersedia

Tersedia dan sudah dipakai layar: `qty_ordered` vs `qty_shipped` per baris, dan status Work
Order per baris. **Cukup** untuk menilai kelayakan penyelesaian tanpa menambah kolom apa pun.

## 6. Wewenang yang sudah ada

`src/lib/roles.ts` → `canApproveDepartment(role, department)`:

| Departemen | Peran yang berwenang |
|---|---|
| `finance` | `finance_manager` |
| `ppic` | **`ppic_manager`** |
| `manager` | **kepemimpinan** (`company_admin`, `general_manager`) |

**Nol peran baru dibutuhkan** untuk aturan bisnis PJL-03: "konfirmasi PPIC/Fulfillment" =
departemen `ppic`; "konfirmasi akhir Manager/GM" = departemen `manager`. Padanan di basis data:
`jwt_decision_department()` dan `jwt_is_company_leadership()`.

## 7. Mekanisme persetujuan yang sudah ada

| Tabel | Bentuk | Dipakai untuk |
|---|---|---|
| `customer_po_approvals` | per **departemen** (`department`, `status`, `approved_by`, `approved_at`, `notes`) | PO klien, tiga departemen |
| `cancellation_requests` | **permintaan → keputusan**, ber-snapshot pelaku & alasan | pembatalan SO/PO |
| `leave_requests` · `build_task_approval_history` | domain lain | — |

**Tidak ada tabel persetujuan generik.** Dua pola di atas adalah cetakan yang tersedia.

## 8. Jejak keputusan yang sudah ada

Kanonik: `status_transition_log` (diperluas: pelaku, nama, peran, departemen, kategori alasan,
catatan) + master `decision_reason_categories` + `pasang_konteks_keputusan()` yang memasang
konteks berlingkup transaksi, dibaca trigger `enforce_status_transition`.

Kategori alasan untuk `sales_orders` yang sudah ada: **10**, seluruhnya untuk pembatalan
(`cancel_request`, `cancel_decision`). **Nol** kategori untuk penyelesaian.

## 9. UI sekarang

`SalesOrdersPage.tsx` (1.626 baris) — panel detail sudah menampilkan: status, **eksekusi
turunan** (produksi & pengiriman sebagai `Tag`), baris order dengan `qty_shipped` dan sisa,
riwayat pengiriman, jadwal pembayaran, dan blok **Pembatalan**.

**Nol tombol penyelesaian.** Nol keterangan kenapa sebuah order belum bisa diselesaikan.

## 10. API / service sekarang

`app/api/sales-orders/`: `route.ts` (daftar), `[salesOrderId]/margin`,
`cancellation-request`, `cancellation-decision`. **Nol endpoint penyelesaian.**

Pola yang berlaku: route tipis → modul `src/features/mrp/server/*` → **RPC lewat klien
ber-lingkup pengguna** (`getUserScopedClient`), karena konteks jejak keputusan hanya bisa
dipasang di dalam satu transaksi di fungsi basis data.

## 11. Basis data sekarang

Fungsi yang menyentuh `sales_orders`: `process_customer_purchase_order`,
`create_shipment_with_signature`, `ajukan_pembatalan`, `putuskan_pembatalan`,
`terapkan_payment_terms`, `get_sales_order_margin`, `get_monthly_operating_profit`,
`upsert_margin_threshold_alert`, plus trigger `log_data_change` & `enforce_status_transition`.

Trigger aktif di `sales_orders`: `audit_log_trigger`, `enforce_status_transition`.

## 12. Test sekarang

`tests/status_eksekusi_sales_order.test.ts` (11) menguji **turunan** produksi/pengiriman.
`tests/permintaan_pembatalan.test.ts` (17) menguji pembatalan.
**Nol test penyelesaian** — karena fiturnya belum ada.

## 13. Jurang (gap)

| # | Jurang | Akibat |
|---|---|---|
| 1 | Transisi `confirmed → completed` **tidak ada** | penyelesaian mustahil, bahkan bila tombolnya dibuat |
| 2 | **Nol tempat** merekam konfirmasi PPIC | syarat 3 aturan bisnis tidak punya wadah |
| 3 | **Nol kategori alasan** untuk penyelesaian | jejak keputusan akan kosong alasannya |
| 4 | **Nol pemeriksa kelayakan** di sisi server | kelayakan hanya bisa ditebak dari layar |
| 5 | **Nol penjaga data basi** | pengiriman bisa berubah di antara konfirmasi dan penutupan |
| 6 | **Nol keterangan di layar** kenapa belum bisa diselesaikan | pengguna hanya melihat ketiadaan tombol |
| 7 | Bukti produksi **tidak ada** bila SO tak punya Work Order sama sekali | keadaan ini belum punya aturan bisnis — lihat TO-BE |
