# SALES_CRM_TEST_COVERAGE_AUDIT

**Pembedaan yang ditegakkan**: *test ada* ≠ *test dijalankan* ≠ *test lulus* ≠
*perilaku bisnis terverifikasi*.

## Delapan berkas uji menyentuh Sales/CRM

| Berkas | Yang dijaga |
|---|---|
| `supplier_customer_alur1.test.ts` | CRUD pelanggan & supplier |
| `pmb07b_delivery_addresses.test.ts` | alamat kirim sebagai daftar |
| `margin_v1_acceptance.test.ts` | margin + jejak lot |
| `margin_watch.test.ts` | pemantauan margin & kunci baseline |
| `planning_feasibility_shortage.test.ts` | kelayakan saat bahan kurang |
| `planning_feasibility_stage_aware.test.ts` | kelayakan sadar tahap |
| `shipments_physical_stage.test.ts` | tahap fisik pengiriman + jejak lot |
| `bagian3_po_supplier_goods_receipt.test.ts` | PO supplier & penerimaan |

## Status eksekusi

**TIDAK DIJALANKAN di batch ini.** Batch ini audit-saja, dan menjalankan suite penuh tidak
diperlukan untuk menyimpulkan cakupan. Terakhir dijalankan pada batch sebelumnya:
**79 berkas · 535 kasus · nol gagal**.

> Melaporkan "lulus" tanpa menjalankannya di batch ini akan melanggar §38 perintah.

## Celah cakupan

| Yang tidak dijaga | Dampak |
|---|---|
| **Transisi status Sales Order** | tidak ada penjaga; SC-01 bisa bertahan tanpa ada yang berbunyi |
| **Status `on_hold`/`cancelled` PO** | sama |
| **Pemisahan tugas tiga departemen** | ditegakkan basis data, **tanpa** uji yang membuktikannya dari sisi aplikasi |
| **Idempotency PO/SO** | kolom ada, **nol** uji |
| **Kompensasi manual saat insert baris gagal** | jalur galat tidak pernah diuji |
| **Isolasi tenant tabel Sales** | RLS aktif, **nol** uji khusus Sales |
| **Alamat kirim tanpa layar** | uji ada, layarnya tidak |

**Tujuh celah, dan empat di antaranya menyentuh perilaku yang bisa mundur diam-diam.**
