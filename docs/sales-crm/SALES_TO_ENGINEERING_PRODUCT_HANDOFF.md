# PENYERAHAN SALES & CRM → ENGINEERING / PRODUCT

**Tanggal:** 30 Agustus 2026 · **Untuk:** agen fase Engineering / Product berikutnya
**Aturan induk:** **Engineering/Product memiliki arsitektur Product yang kanonik.
Sales TIDAK BOLEH membuat Master Product tandingan.**

> Dokumen ini ditulis supaya agen berikutnya **tidak perlu menemukan ulang semuanya**.
> Setiap pernyataan di sini punya bukti terukur di repositori — bukan ingatan.

## 1. Kapabilitas Sales yang sudah ada

| Kapabilitas | Keadaan |
|---|---|
| Pelanggan + alamat kirim (daftar, beku di dokumen) | **ADA** |
| PO Klien: buat, tahan, lepas, **lepas darurat**, batalkan | **ADA** |
| Persetujuan 3 departemen (finance · ppic · manager) | **ADA** |
| PO Klien → Sales Order lewat **satu jalur kanonik** | **ADA** |
| Sales Order + barisnya, identitas mitra **dibekukan** | **ADA** |
| Permintaan pembatalan (mengajukan ≠ membatalkan) | **ADA** |
| Termin pembayaran + kewajiban per Sales Order (beku) | **ADA** |
| Penutupan Sales Order (pemenuhan, bukan pembayaran) | **ADA** |
| Visibilitas eksekusi (produksi & pengiriman) — **diturunkan** | **ADA** |
| Quotation · Sample · Kontrak · Retur/RMA · Komplain · Kode produk pelanggan | **BELUM ADA** |

## 2. Ketergantungan Sales pada Product

| Sales butuh | Hari ini dipenuhi oleh |
|---|---|
| Identitas barang yang dijual | `items` (item_code, name, base_uom, type) |
| Harga jual per baris | `sales_order_lines.unit_price` — **diketik**, bukan dari master harga |
| Resep/struktur produk | `boms` — dipakai Manufacturing, **dibaca** Sales lewat kelayakan |
| Rute produksi | `routings` — milik Manufacturing |
| Spesifikasi produk pelanggan | **TIDAK ADA** |

## 3. Kebutuhan Product Reference

Sales membutuhkan **rujukan** ke produk, bukan salinan produk. Yang sudah ada: `item_id` pada
baris Sales Order dan PO Klien. **Nol duplikasi** atribut produk di tabel Sales — diperiksa:
`sales_order_lines` menyimpan `item_id`, qty, harga; **nol** nama/spesifikasi produk disalin.

## 4. Kebutuhan Kode Produk Pelanggan (DEC-S04)

**BELUM ADA — nol tabel, nol kolom.** Keputusan bisnisnya sudah ditutup: kode produk pelanggan
**berdampingan** dengan kode internal.

**BATAS YANG SUDAH DITETAPKAN**: kode produk pelanggan **TIDAK boleh melahirkan Product baru** —
ia **relasi/rujukan**, bukan identitas. Bentuk kanoniknya milik Engineering/Product.

## 5. Ketergantungan konfigurasi produk

Belum ada konsep varian/konfigurasi produk. Bila Engineering/Product membangunnya, Sales akan
**merujuk** konfigurasi, bukan menyimpannya.

## 6. Ketergantungan Sample (DEC-S03)

**BELUM ADA.** Keputusan bisnis: **Sales meminta, R&D mengerjakan**, antrean dan ketersediaan
bahan terlihat. `production_standard_samples` yang ada **bukan** ini.

## 7. Ketergantungan revisi produk

`boms` sudah **berversi** dan **dibekukan sebagai cuplikan** ke batch produksi
(`production_batch_bom_line_snapshots`). Aturan yang sudah terbukti (SD-2): mengedit master
**tidak** mengubah angka batch yang sudah berjalan.

**Yang belum ada**: versi pada **produk** itu sendiri, dan kaitannya ke komitmen komersial.

## 8. Ketergantungan Quotation (DEC-S02)

**BELUM ADA.** Keputusan: quotation adalah **objek terstruktur berversi**, bukan unggahan PDF.
Ia akan membutuhkan rujukan produk dan harga — **keduanya milik domain lain**, bukan Sales.

## 9. Ketergantungan harga

Hari ini harga jual **diketik di baris Sales Order**. **Tidak ada master harga jual.**
`supplier_item_prices` yang ada adalah harga **beli**, bukan jual.

> **FINDING** · **AS-IS** harga jual per baris, diketik · **EVIDENCE** nol tabel harga jual di
> 96 tabel · **TO-BE** master harga jual berversi · **GAP** harga historis tidak bisa
> direkonstruksi dari master · **OWNERSHIP** komersial (Sales) atau Product? **belum ditetapkan**
> · **IMPACT** SD-12 (nilai komersial wajib berversi/beku) belum berlaku untuk harga ·
> **RECOMMENDATION** tetapkan pemiliknya sebelum Quotation dibangun · **DECISION REQUIRED** ya.

## 10. Hubungan Pelanggan → Produk

**BELUM ADA.** Tidak ada tabel yang menghubungkan pelanggan dengan produk yang ia beli, selain
lewat riwayat order. Profil produk pelanggan (SLS-01) masih diparkir.

## 11. Hubungan Sales Order → Produk

Lewat `sales_order_lines.item_id`. **Satu arah**: Sales membaca `items`; Sales **tidak pernah**
membuat atau mengubah `items`.

## 12. Antarmuka Product yang dibutuhkan Sales

1. **Cari & pilih produk** yang boleh dijual (hari ini: seluruh `items` bertipe barang jadi).
2. **Rujukan stabil** ke produk beserta versinya.
3. **Satuan** dan konversinya.
4. **Status boleh-dijual** (aktif/nonaktif) — hari ini `items.archived_at`.
5. **Kode produk pelanggan** (DEC-S04) — belum ada.

## 13. Peristiwa (events) Product yang dibutuhkan Sales

Produk **dinonaktifkan** · spesifikasi **berubah versi** · satuan berubah. Hari ini **nol
mekanisme peristiwa** — Sales membaca keadaan terkini saat halaman dibuka.

## 14. Sumber kebenaran

| Hal | Pemilik |
|---|---|
| Produk / item / BOM / routing | **Manufacturing–Product** |
| Persediaan, lot, pergerakan stok | **Inventory** |
| Produksi | **Manufacturing** |
| Pengiriman | **Logistics** |
| Pembayaran, piutang | **Finance — belum ada** |
| Komitmen komersial (PO klien, Sales Order, termin) | **Sales** |

## 15. Kepemilikan entitas milik Sales

`customers` · `customer_delivery_addresses` · `customer_purchase_orders` (+ lines, approvals) ·
`sales_orders` (+ lines) · `cancellation_requests` · `payment_terms` · `payment_term_steps` ·
`sales_order_payment_obligations` · `sales_order_completion_approvals`.

## 16. Kontrak lintas domain yang sudah ada

**K-01** PO klien → Sales Order · **K-02** Sales Order → Work Order (Manufacturing membaca) ·
**K-03** Sales Order → Pengiriman · **K-04** eksekusi → visibilitas Sales (turunan) ·
**K-05** keputusan → jejak kanonik · **K-09** pemenuhan → penutupan Sales Order.
**Didefinisikan, sisi seberangnya belum ada**: K-06 (Finance).
**Belum ada**: K-07/K-08 (gerbang pembayaran).

## 17. Ketergantungan status

Sales menyimpan **3 status** (`confirmed`/`completed`/`cancelled`). Produksi dan pengiriman
**diturunkan**, tidak disimpan. **Jangan** menambahkan status milik domain lain ke Sales Order.

## 18. Ketergantungan izin

17 peran di `src/lib/roles.ts`. Yang relevan: `sales` · `finance_manager` · `ppic_manager` ·
kepemimpinan (`company_admin`, `general_manager`) · **`general_manager` sendirian** untuk
pelepasan darurat. Isolasi tenant lewat `company_id` + RLS (161 kebijakan).

## 19. Ketergantungan data

Sales **membaca**: `items`, `boms`, `work_orders`, `shipments`, `lots`, `work_order_outputs`,
`production_plants`. Sales **menulis**: hanya entitas di §15.

## 20. Yang Engineering/Product TIDAK BOLEH duplikasi

**Pelanggan** · **alamat kirim** · **PO klien** · **Sales Order** · **termin & kewajiban
pembayaran** · **permintaan pembatalan** · **jejak keputusan** (`status_transition_log`) ·
**katalog alasan** · **peran & izin** (`src/lib/roles.ts` + RLS).

Sebaliknya, **Sales tidak akan** membuat: master produk, master harga jual, BOM, routing,
persediaan, atau pembayaran.

## 21. Ketergantungan yang masih terbuka

**FIN-02** (Finance) · **PJL-13** layar termin · **PJL-15** gerbang pembayaran ·
**PJL-17** "Status bayar" tanpa sumber · **harga jual** (§9) · **kode produk pelanggan** ·
**Quotation** · **Sample** · **Retur/RMA**.

## 22. Risiko yang diketahui

1. **Harga jual tidak berversi** — order historis bisa kehilangan konteks harganya (SD-12).
2. **Nol peristiwa produk** — Sales tidak tahu bila spesifikasi berubah setelah order dibuat.
3. **Nol alokasi stok** — tidak ada tabel reservasi/alokasi; pemenuhan dari stok terlihat hanya
   **setelah** pengiriman terjadi (lewat lot), bukan saat dijanjikan.
4. **Inti manufaktur belum pernah dipakai** di tenant nyata — nol BOM, Work Order, batch,
   pengiriman. Seluruh kontrak lintas domain terbukti lewat **test**, belum lewat pemakaian.

## 23. Rekonsiliasi yang wajib dilakukan saat Engineering/Product mulai

1. **Tetapkan pemilik harga jual** (§9) sebelum Quotation dibangun.
2. **Tetapkan bentuk kode produk pelanggan** (DEC-S04) — relasi, **bukan** produk baru.
3. **Tetapkan versi produk** dan bagaimana komitmen komersial merujuknya.
4. **Periksa §20** sebelum membuat tabel apa pun yang namanya menyerupai milik Sales.
5. **Jalankan satu pesanan penuh** di tenant uji — dari PO klien sampai penutupan order —
   sebelum menganggap kontrak lintas domain terbukti (QA-04).
