# FABRIX CROSS-DOMAIN CONTRACTS
## The bridge between segment agents

Each contract must define:
- producer domain
- consumer domain
- trigger/command
- authoritative source
- payload/business meaning
- preconditions
- side effects
- failure/retry behavior
- idempotency
- security/scope
- audit
- versioning

### Canonical business threads
Sales Order → Demand → MPS → MRP → Planned Order → Buy/Make → Procurement/Production → Quality → Inventory → Delivery → Invoice → Payment → After Sales.

### Examples
Sales confirms commercial commitment; Planning owns demand interpretation.
Engineering releases BOM/Formula/Routing; Planning/Manufacturing consume the effective definition.
Quality controls disposition; Inventory owns physical stock state.
Maintenance owns equipment availability; Scheduling consumes availability.
Finance owns accounting consequences; operational domains publish facts.

### Rule
A domain agent may propose a contract but may not redefine the other domain's source of truth.


---

# KONTRAK YANG BENAR-BENAR ADA — 29 Agustus 2026

> Bagian di atas adalah **kerangka**: apa yang harus didefinisikan tiap kontrak, plus dua
> kalimat contoh. Nol kontrak sungguhan tercatat. Bagian ini mengisinya dari kode.

## K-01 · PO Klien → Sales Order

| | |
|---|---|
| **Produsen** | Sales (PO klien terkonfirmasi 3 departemen) |
| **Konsumen** | Sales (Sales Order komersial) |
| **Perintah** | `process_customer_purchase_order(cpo_id, plant_id)` |
| **Otoritas** | `jwt_is_company_leadership()` **+** 3 persetujuan departemen |
| **Prasyarat** | PO berstatus `new`; pabrik milik company yang sama |
| **Efek samping** | Sales Order + barisnya lahir; PO → `processed` |
| **Idempotensi** | kunci **diturunkan** `cpo-<id>` + kekangan unik → satu PO hanya satu SO |
| **Keamanan** | `SECURITY DEFINER`; `anon` dicabut; gagal-tertutup |
| **Jejak** | `status_transition_log` (PO) + identitas mitra **dibekukan** ke SO |
| **Bukti** | `tests/jalur_kanonik_sales_order.test.ts` (11) |

> **Kontrak ini pernah punya DUA implementasi.** Yang dipakai bukan yang atomik dan tidak
> menyalin identitas beku. Disatukan 29 Agu 2026; penjaga mencegah jalur ketiga lahir.

## K-02 · Sales Order → Work Order

| | |
|---|---|
| **Produsen** | Sales (komitmen komersial) · **Konsumen** Manufacturing |
| **Otoritas** | `WORK_ORDER_MANAGE_ROLES` — **Sales tidak termasuk** |
| **Arah** | Manufacturing **membaca** baris SO; Sales **tidak** membuat Work Order |
| **Balik arah** | kemajuan produksi **diturunkan** ke tampilan Sales, **tidak disimpan** di Sales |
| **Bukti** | `tests/status_eksekusi_sales_order.test.ts` · `eksekusiSalesOrder.ts` |

## K-03 · Sales Order → Pengiriman

| | |
|---|---|
| **Produsen** | Sales · **Konsumen** Logistics |
| **Perintah** | `create_shipment_with_signature(...)` |
| **Otoritas** | `SHIPMENT_MANAGE_ROLES` — **Sales tidak termasuk** |
| **Sumber kebenaran alamat** | teks **beku** `shipments.delivery_address`; `delivery_address_id` hanya jejak rujukan |
| **Prasyarat** | tanda tangan digital penanda tangan wajib ada |
| **Efek samping** | pengiriman + barisnya + tanda tangan dokumen, dalam **satu transaksi** |
| **Bukti** | `tests/pmb07b_delivery_addresses.test.ts` · `shipments_physical_stage` |

## K-04 · Produksi/Pengiriman → Visibilitas Sales

| | |
|---|---|
| **Arah** | Manufacturing & Logistics → Sales, **satu arah** |
| **Bentuk** | **turunan murni** (`turunkanEksekusiSo`), nol kolom status disimpan di Sales |
| **Alasan** | **AD-01** — Sales tidak memiliki status produksi/pengiriman |
| **Bukti** | `tests/status_eksekusi_sales_order.test.ts` (11) |

## K-05 · Keputusan berdampak → Jejak keputusan

| | |
|---|---|
| **Produsen** | domain mana pun yang memindahkan status |
| **Konsumen** | `status_transition_log` (kanonik, lintas domain) |
| **Mekanisme** | RPC memasang konteks (`set_config`, lingkup transaksi) → trigger membacanya |
| **Isi** | pelaku, nama, peran, departemen, kategori alasan, catatan, dari-ke, waktu |
| **Katalog alasan** | `decision_reason_categories`, berkunci entitas + tindakan + departemen |
| **KETERBATASAN** | `update` biasa **tetap** berpindah status dan **tetap** tercatat — hanya tanpa pelaku dan tanpa alasan |
| **Bukti** | `tests/aksi_po_klien_jejak_keputusan.test.ts` (16) |

## K-06 · Sales ↔ Finance — **BELUM ADA**

| | |
|---|---|
| **Seharusnya** | Sales menghasilkan kewajiban; Finance mencatat pembayaran; Sales **membaca** status turunan |
| **Kenyataan** | **Domain Finance untuk piutang pelanggan tidak ada** — nol tabel pembayaran/piutang/ledger |
| **Yang sudah ada** | separuh Sales: `payment_terms`, `payment_term_steps`, `sales_order_payment_obligations` |
| **Yang tidak ada** | penerimaan pembayaran, verifikasi, piutang |
| **Akibat** | status pembayaran **tidak bisa diturunkan** → **BD-10 terblokir** → gerbang produksi & pengiriman terblokir. **KOREKSI 29 Agu 2026 (malam):** penyelesaian Sales Order **TIDAK** ikut terblokir — pemilik produk menetapkan penyelesaian berbasis **pemenuhan**, bukan pembayaran |
| **Kontrak** | **DIDEFINISIKAN 30 Agu 2026**: `docs/sales-crm/FIN02_SALES_FINANCE_PAYMENT_CONTRACT.md` — pemilik, produsen, konsumen, bentuk data, perilaku saat Finance tidak ada, dan syarat pengujiannya. Sisi Finance **tetap belum ada** |
| **Dicatat sebagai** | **FIN-02** — paket penyelidikan + 24 pertanyaan untuk Architecture Guardian: `docs/finance/FIN-02_CUSTOMER_RECEIVABLE_DOMAIN_GAP.md`; penyerahan: `docs/sales-crm/SALES_CRM_FIN02_ARCHITECTURE_HANDOFF.md` |

## K-09 · Pemenuhan → Penutupan Sales Order

| | |
|---|---|
| **Produsen** | Manufacturing (`work_orders.status`) + Logistik (`sales_order_lines.qty_shipped`) |
| **Konsumen** | Sales (penutupan komitmen komersial) |
| **Perintah** | `konfirmasi_pemenuhan_sales_order()` lalu `selesaikan_sales_order()` |
| **Otoritas** | konfirmasi: departemen **ppic** · penutupan: **kepemimpinan** — keduanya wewenang yang **sudah ada**, nol peran baru |
| **Prasyarat** | seluruh baris terkirim penuh · seluruh Work Order hidup selesai (minimal satu) · nol permintaan pembatalan menunggu |
| **Pembayaran** | **BUKAN prasyarat** — order boleh ditutup dengan tunggakan (aturan bisnis 29 Agu 2026) |
| **Arah** | **satu arah**: Sales membaca fakta produksi & pengiriman, tidak pernah menulis baliknya |
| **Anti-basi** | cuplikan pemenuhan saat konfirmasi dibandingkan ulang saat penutupan; berbeda → **ditolak** |
| **Jejak** | `status_transition_log` (pelaku, peran, departemen, alasan) + `sales_order_completion_approvals` |
| **Bukti** | `tests/penyelesaian_sales_order.test.ts` (22, empat mutasi menggigit) |

## Kontrak yang BELUM ADA sama sekali

Quotation → PO klien · Contract → Quotation/SO · Sample → R&D · Komplain → Mutu/Traceability ·
Retur/RMA → Persediaan · MRP → Pengadaan · Mutu → Disposisi lot.

## Aturan yang berlaku untuk kontrak berikutnya

1. **Satu arah untuk kebenaran, dua arah untuk visibilitas.** Domain konsumen boleh
   **membaca**; hanya pemilik yang **menulis**.
2. **Status milik domain lain DITURUNKAN, tidak disalin.** Salinan akan basi tanpa berbunyi.
3. **Perintah lintas domain lewat fungsi basis data**, bukan `update` dari aplikasi —
   supaya wewenang dan jejaknya tidak bisa dilewati.
4. **Nol kontrak boleh menciptakan sumber kebenaran kedua.**
