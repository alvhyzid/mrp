# FABRIX AS-IS → TO-BE RECONCILIATION
## Mandatory gate for existing implementation

### Evidence hierarchy
Running application/browser → database/schema → routes → API/services → tests → navigation config → architecture docs.

### For every affected capability record
Domain | Entity | Current owner | Current model | Current state | Current route/page | Actual behavior | Target owner | Target model | Target state | Conflict | Decision | Migration | Tests | Evidence.

### Decision vocabulary
KEEP | ADAPT | MIGRATE | DEPRECATE | DECISION REQUIRED | UNKNOWN

### Prohibitions during audit
No new business feature, no destructive refactor, no data deletion, no route rewrite, no unapproved migration.

### Gate
No implementation proceeds where a known conflict is unresolved and materially affects correctness.

---

# REKONSILIASI AS-IS → TO-BE, SELURUH PROYEK — 29 Agustus 2026

> Gerbang ini mensyaratkan pencatatan per kapabilitas dan **nol kapabilitas pernah dicatat**.
> Berikut rekonsiliasi tingkat domain, seluruhnya dari pengukuran basis data dan kode —
> bukan dari dokumen arsitektur, yang justru berada di **urutan paling bawah** hierarki bukti.

## Perbedaan yang paling menentukan: TERBANGUN ≠ TERPAKAI

Diukur di tenant nyata (PT Indo Taste Manufacture), 29 Agu 2026:

| Entitas | Baris | Entitas | Baris |
|---|---:|---|---:|
| employees | **30** | boms | **0** |
| users | **8** | routings | **0** |
| items | **1** | work_orders | **0** |
| customers | **1** | production_batches | **0** |
| customer_purchase_orders | **1** | lots | **0** |
| data_change_audit_log | **598** | shipments | **0** |
| | | sales_orders | **0** |
| | | suppliers · purchase_orders | **0** |
| | | status_transition_log | **0** |

**Artinya**: hampir seluruh sistem **sudah terbangun dan belum pernah dipakai**. Setiap
klaim "bekerja" hari ini bersandar pada **test**, bukan pada pemakaian di lantai produksi.
Itu bukan cacat — tapi wajib disebut, karena keduanya sering tertukar.

## Rekonsiliasi per domain

| Domain | AS-IS (terukur) | Jurang ke TO-BE | Keputusan |
|---|---|---|---|
| **Identitas & tenant** | 16 peran + `sales`, RLS 161 kebijakan, isolasi terbukti | 1 dari 8 akun manusia sungguhan | **KEEP** |
| **Master data** | Item, pelanggan, alamat kirim, supplier, pabrik, work center | pabrik/work center/shift **belum punya jalur lewat layar** | **ADAPT** |
| **Sales & CRM** | PO klien → SO (jalur kanonik), tahan/lepas/batal, permintaan pembatalan, termin & kewajiban bayar | Quotation · Contract · Sample · kode produk pelanggan · amandemen SO · komplain/retur **nol tabel** | **DECISION REQUIRED** (AD-03) |
| **Manufacturing** | BOM, routing, Work Order, batch, cuplikan BOM/routing, multi-output | **belum pernah dijalankan sekali pun** pada data nyata | **KEEP** |
| **Persediaan & lot** | pergerakan by lot, genealogy, peringatan stok gabungan | 0 lot; masa simpan **tidak pernah dihitung** dari `shelf_life_days` | **ADAPT** |
| **Logistics** | pengiriman + surat jalan + POD + alamat **beku** | 0 pengiriman | **KEEP** |
| **Pengadaan** | supplier, PO, penerimaan barang | 0 supplier, 0 PO; PO ke supplier **tidak bernomor** | **ADAPT** |
| **Costing & margin** | tiga golongan biaya SDM, baseline terkunci, Margin Watch | bersandar pada batch yang belum pernah ada | **KEEP** |
| **HR & kehadiran** | 30 karyawan, kehadiran geo/QR, cuti, KPI | riwayat KPI dulu lahir dari kunjungan halaman — sudah dijaga test | **KEEP** |
| **Finance (piutang)** | **TIDAK ADA** — nol tabel pembayaran/piutang/ledger | seluruhnya | **DECISION REQUIRED** (FIN-02) |
| **Mutu / QMS** | nol modul; QC dikerjakan Spv Produksi merangkap | pemeriksa = pelapor, tercatat QMS-01 | **UNKNOWN** |
| **Jejak & tata kelola** | `status_transition_log` diperluas (pelaku, peran, alasan) | **5 dari 6** mesin status belum punya pengisi (AUD-50) | **ADAPT** |

## Konflik yang masih terbuka

| Konflik | Bentuk | Gerbang |
|---|---|---|
| **AD-03** | baseline menyebut **11** status SO; implementasi memakai **4** | memblokir penamaan status & amandemen SO |
| **FIN-02** | Sales menghasilkan kewajiban; **tidak ada** yang mencatat pembayaran | memblokir BD-10, status pembayaran, dan gerbang produksi/pengiriman. **TIDAK memblokir penyelesaian Sales Order** — lihat koreksi di bawah |
| **BD-09** | ~~toleransi kurang-kirim belum ditetapkan~~ → **TERKUNCI 29 Agu 2026: nol toleransi otomatis** | tidak lagi konflik |
| **BD-01** | ~~kapan order dianggap selesai~~ → **TERKUNCI 29 Agu 2026: berbasis pemenuhan, bukan pembayaran** | tidak lagi konflik |
| **BL-04** | kolom alamat lama di `customers` masih ada berdampingan dengan daftar alamat baru | perlu keputusan KEEP/DEPRECATE |

## Kepatuhan terhadap larangan saat audit

Selama seluruh pekerjaan ini: **nol** `DROP`, **nol** `TRUNCATE`, **nol** penghapusan Sales
Order / PO klien / data produksi / pengiriman / riwayat keputusan di tenant nyata. Seluruh
verifikasi memakai **tenant uji** dan fixture yang dibuat lalu dibersihkan sendiri. Peran
Sales dibuat; **nol pengguna sungguhan ditugaskan** ke peran itu.


## KOREKSI 29 Agustus 2026 (malam) — rantai penghambat yang keliru

Berkas ini sebelumnya mencatat bahwa **FIN-02 → BD-10 → penyelesaian Sales Order terblokir**.
**Rantai itu tidak lagi benar**, dan dicatat di sini apa adanya alih-alih dihapus.

Pemilik produk menetapkan pada 29 Agustus 2026:

- Sales Order boleh **COMPLETED** meski pelanggan masih punya **tunggakan**. Syaratnya
  **pemenuhan**: seluruh kuantitas diproduksi, seluruhnya dikirim, PPIC mengonfirmasi, dan
  Manager/GM konfirmasi akhir.
- Kurang kirim **tidak** otomatis selesai, dan **tidak ada toleransi otomatis**. Sisa komitmen
  terlacak sampai dipenuhi atau dibatalkan secara sah.
- Status pembayaran (`UNPAID → PARTIALLY PAID → PAID`) **terpisah** dari siklus Sales Order.

**Yang masih benar:** FIN-02 tetap memblokir **BD-10**, **status pembayaran**, dan **gerbang
produksi/pengiriman** yang lahir dari milestone termin.

Rincian: `docs/finance/FIN-02_ARCHITECTURE_RECONCILIATION.md`.
