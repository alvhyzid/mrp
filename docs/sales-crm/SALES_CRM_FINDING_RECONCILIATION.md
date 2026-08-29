# SALES_CRM_FINDING_RECONCILIATION

**Tanggal rekonsiliasi:** 29 Agustus 2026
**Sumber temuan:** Architecture Guardian Review (SC-01..SC-05)
**Mode:** verifikasi ulang bukti, BUKAN audit baru dari nol
**Bukti diambil dari:** kode repo (sensus), skema & katalog Postgres proyek NYATA (`kfvtrwuuqcjfkkuqizxt`, **SELECT saja, nol mutasi**)

> **ATURAN YANG DIPATUHI DI SINI.** Temuan lama **tidak** dianggap benar hanya karena
> sudah tertulis. Tiap SC diverifikasi ulang. Hasilnya: **2 temuan TETAP**,
> **3 temuan BERUBAH MATERIAL**, dan **2 temuan BARU** lahir dari verifikasi itu.

---

## Ringkasan hasil verifikasi

| Kode | Judul | Hasil verifikasi | Keyakinan |
|---|---|---|---|
| **SC-01** | Sales Order Lifecycle | **DIPERLUAS** — mesin statusnya ternyata SUDAH kanonik di database; yang nihil adalah kode yang menggerakkannya | **TINGGI** |
| **SC-01b** | *(BARU)* Jalur aplikasi tidak menyalin snapshot identitas | **BARU — P0** | **TINGGI** |
| **SC-02** | Customer PO Hold / Cancel | **DIPERTAJAM** — transisinya sudah kanonik; yang nihil adalah pemicu & wewenangnya | **TINGGI** |
| **SC-03** | Sales Order Row Access | **DIPERTAJAM** — lubangnya persis SATU tabel, dan gagal-tertutup | **TINGGI** |
| **SC-04** | Sales Order Transaction Integrity | **BERUBAH MATERIAL** — jalur atomiknya SUDAH ADA di database dan **tidak dipakai** | **TINGGI** |
| **SC-05** | Shipping Address | **BERUBAH MATERIAL** — BL-04 **terjawab bukti**; sisa celahnya UI, bukan sumber kebenaran | **TINGGI** |
| **SC-05b** | *(BARU)* Alamat tersimpan tidak bisa dipilih saat membuat pengiriman | **BARU — P1, AMAN DIKERJAKAN** | **TINGGI** |

**Keadaan data nyata saat verifikasi (baca-saja, 29 Agu 2026):**

```
sales_orders            0      sales_order_lines        0
customer_purchase_orders 1     customer_po_approvals    3 (finance/ppic/manager, SEMUA pending)
customers                1     customer_delivery_addresses 0
shipments                0     work_orders              0
customers.shipping_address terisi: 0
status_transition_log    0 baris  (nol transisi status PERNAH terjadi di sistem ini)
```

> **Kenapa angka ini penting untuk MEMBACA severity.** Beberapa temuan di bawah berstatus
> **P0** tetapi **nol baris data terdampak** — karena belum ada satu Sales Order pun yang
> lahir. Itu bukan alasan menunda; itu justru **jendela untuk memperbaiki sebelum baris
> pertama terbentuk**. Setelah SO pertama terbit, sebagian temuan berubah dari "perbaiki
> kode" menjadi "perbaiki kode **dan** perbaiki data".

---

# SC-01 — Sales Order Lifecycle

## Current Evidence

**E1 — Nol kode mengubah status Sales Order.** Sensus seluruh `src/`:

```
.from('sales_orders') …  .insert(  → 1 tempat  (processCustomerPurchaseOrder.ts:112)
.from('sales_orders') …  .delete(  → 1 tempat  (processCustomerPurchaseOrder.ts:169, kompensasi)
.from('sales_orders') …  .update(  → NOL tempat
```

**E2 — Status yang di-insert selalu `confirmed`** (`processCustomerPurchaseOrder.ts:117`, literal, bukan variabel).

**E3 — TETAPI mesin statusnya SUDAH KANONIK DI DATABASE.** Tabel `status_transition_rules`
memuat aturan sebagai **data**, ditegakkan trigger `enforce_status_transition` pada
`sales_orders`, dan setiap transisi dicatat ke `status_transition_log`:

```
sales_orders:  confirmed     -> cancelled
               confirmed     -> in_production
               in_production -> cancelled
               in_production -> completed
```

**E4 — `status_transition_log` berisi NOL baris** untuk seluruh tabel. Tidak ada satu pun
transisi status yang pernah terjadi di sistem ini, di tabel mana pun.

**E5 — CHECK constraint** `sales_orders_status_check` = `confirmed | in_production | completed | cancelled`.

**E6 — Model persetujuan tiga departemen SUDAH ADA DAN BEKERJA — tetapi melekat pada PO
Klien, bukan pada Sales Order.** `customer_po_approvals` ber-CHECK
`department = finance | ppic | manager`, dibuat otomatis oleh trigger
`create_customer_po_approvals` setiap PO Klien terbit, dan gerbang "3 dari 3 approved"
ditegakkan **dua kali**: di `process_customer_purchase_order()` dan lagi di
`enforce_status_transition()`.

**E7 — Konsumen hilir sudah mengandalkan status yang tidak pernah tercapai.**
`getDashboardSummary.ts:30` menghitung `status IN ('confirmed','in_production')` — cabang
`in_production` mustahil bernilai benar hari ini.

## AS-IS

Sales Order **lahir langsung dalam keadaan `confirmed`**, sebagai **hasil** dari persetujuan
tiga departemen atas PO Klien. Sejak lahir, statusnya **tidak pernah berubah lagi** —
selamanya, lewat jalur mana pun yang ada di aplikasi. Tiga dari empat status tidak dapat
dicapai, bukan karena aturannya belum ada, melainkan karena **nol kode yang menjalankannya**.

## Business Meaning

Aturan bisnis yang disebutkan pemilik produk — *"Sales Order butuh persetujuan Finance,
PPIC, dan Manager/GM; setelah ketiganya setuju, SO menjadi Confirmed"* — **sudah terpenuhi
hari ini**, hanya dengan urutan yang berbeda dari yang mungkin dibayangkan:

> Persetujuan terjadi pada **dokumen sebelum SO** (PO Klien). Sales Order **tidak pernah
> berstatus "menunggu persetujuan"**, karena ia baru **ada** setelah persetujuan lengkap.
> **Keberadaan Sales Order ITU SENDIRI adalah bukti ketiga departemen sudah setuju.**

Yang **belum** punya arti bisnis sama sekali: kapan sebuah SO berhenti berjalan
(`completed`) dan siapa yang boleh membatalkannya (`cancelled`).

## Architecture Implication

Tiga hal harus dipisahkan, dan sekarang tercampur dalam satu kolom `status`:

| Lapis | Isi | Pemilik menurut DEC-S11 |
|---|---|---|
| **Komersial** | `confirmed`, `cancelled` | **Sales** |
| **Persetujuan** | finance / ppic / manager | **sudah ada** di PO Klien |
| **Eksekusi** | produksi berjalan, sudah terkirim | **Manufacturing** & **Logistics**, bukan Sales |

DEC-S11 (ditutup pemilik produk) menyatakan: *Sales memiliki CANCELLED; Manufacturing/Work
Order memiliki IN PRODUCTION; Delivery/Shipment + bukti penyelesaian berkontribusi pada
COMPLETED.*

**KETEGANGAN YANG WAJIB DISEBUT, bukan ditutupi:** `status_transition_rules` di database
mengizinkan `sales_orders` bertransisi ke `in_production` dan `completed` — artinya database
memperlakukan keduanya sebagai **status tersimpan milik baris SO**. DEC-S11 memperlakukan
keduanya sebagai **milik domain lain**. Keduanya bisa didamaikan dengan dua cara yang
sama-sama sah, dan **memilih di antaranya bukan wewenang Claude Code**:

- **Opsi A — status tersimpan, ditulis domain pemilik.** Aturan DB dipertahankan; yang
  menulis `in_production` adalah Manufacturing saat Work Order mulai, dan `completed`
  adalah Logistics saat pengiriman tuntas. Kolom `status` jadi papan bersama antar domain.
- **Opsi B — status komersial saja, eksekusi diturunkan.** `sales_orders.status` hanya
  `confirmed`/`cancelled`; `in_production`/`completed` **dihitung** dari Work Order &
  Shipment, tidak pernah disimpan. Dua baris aturan DB yang menuju keduanya jadi mati dan
  **wajib dicabut**, bukan dibiarkan (aturan yang tidak pernah dipakai adalah pemicu palsu).

**Yang sudah dikerjakan dan SENGAJA netral terhadap pilihan ini:** WS-A (batch sebelumnya)
menambahkan **visibilitas eksekusi TURUNAN** — `turunkanEksekusiSo()` di
`src/features/mrp/server/eksekusiSalesOrder.ts`, ditampilkan sebagai Tag terpisah di samping
Tag status komersial. Ia **nol perubahan skema, nol penulisan status, nol pencabutan aturan**.
Karena tidak menghapus apa pun, ia tetap benar apa pun keputusan A/B nanti.

## Required Correction

1. **KEPUTUSAN dulu** (A atau B) — lihat *Decision Required*.
2. Setelah keputusan: bangun jalur transisi yang benar-benar dijalankan, beserta
   pencatatan alasan.
3. Perbaiki `getDashboardSummary.ts` yang sudah mengandalkan `in_production`.
4. **Jangan menambah status baru.** Empat yang ada belum satu pun hidup.

## Acceptance Criteria

- Setiap status yang tercantum di CHECK constraint **dapat dicapai lewat layar**, atau
  dicabut dari CHECK.
- `status_transition_log` bertambah baris pada setiap transisi (sudah otomatis lewat trigger).
- Transisi terlarang **ditolak** dengan pesan yang bisa dibaca orang pabrik, bukan jargon Postgres.
- Wewenang ditegakkan di **server**, bukan hanya menyembunyikan tombol.
- Dashboard tidak lagi menghitung status yang mustahil.

## Implementation Work Order

**WO-S01** — lihat `SALES_CRM_NEXT_WORK_ORDERS.md`.

## Dependencies

Memblokir: penyerahan SO → Work Order. Diblokir oleh: keputusan A/B.

## Decision Required

**ARCHITECTURE DECISION REQUIRED — AD-01** (lihat bagian akhir dokumen ini), ditambah
**BUSINESS DECISION REQUIRED — BD-01..BD-04** (kapan `completed`, siapa boleh `cancel`,
apakah boleh batal setelah Work Order dibuat, apakah pembayaran memengaruhi penyelesaian).

## Status

**TETAP — DIPERLUAS.** Menunggu keputusan. **TIDAK BOLEH DIIMPLEMENTASIKAN** di batch ini.

## Confidence

**HIGH** — seluruh pernyataan di atas berasal dari sensus kode dan katalog Postgres yang
dijalankan, bukan dari pembacaan dokumen.

---

# SC-01b — *(TEMUAN BARU)* Jalur aplikasi tidak menyalin snapshot identitas ke Sales Order

> Lahir saat memverifikasi SC-04. **Prioritas P0.** Dicatat terpisah karena akibatnya
> berbeda dari SC-01: bukan status yang macet, melainkan **angka/identitas yang salah**.

## Current Evidence

**E1 — Fungsi database menyalin snapshot; jalur aplikasi tidak.**

| | Fungsi DB `process_customer_purchase_order()` | TypeScript `processCustomerPurchaseOrder.ts` |
|---|---|---|
| `customer_name_snapshot` | **ya** (diwarisi dari CPO) | **TIDAK** |
| `customer_billing_address_snapshot` | **ya** | **TIDAK** |
| `customer_npwp_snapshot` | **ya** | **TIDAK** |
| `idempotency_key` | **TIDAK** | **ya** |

Kolom yang benar-benar di-insert jalur TypeScript (`processCustomerPurchaseOrder.ts:113-121`):
`company_id, customer_purchase_order_id, customer_id, production_plant_id, status, so_number, idempotency_key` — **tiga kolom snapshot tidak disebut sama sekali**.

**E2 — Jalur yang DIPAKAI aplikasi adalah jalur TypeScript.**
`app/api/customer-purchase-orders/process/route.ts` memanggil `processCustomerPurchaseOrder()`.
Fungsi DB hanya dipanggil oleh **dua berkas test** (`pmb07a_identity_snapshot.test.ts`,
`mlvt_case_study_skeleton.test.ts`) — **nol pemanggil di kode aplikasi**.

**E3 — Akibatnya terbaca di layar sebagai keterangan yang keliru.**
`listSalesOrders.ts:105` menetapkan `identity_predates_snapshot: so.customer_name_snapshot === null`,
dengan komentar *"SO terbit sebelum kolom snapshot ada"*. SO yang dibuat **hari ini** lewat
aplikasi akan `null`, sehingga ditandai seolah terbit sebelum kolomnya ada. Alamat penagihan
dan NPWP jatuh ke `null` (`listSalesOrders.ts:101-102`); nama jatuh ke **join hidup** ke
`customers` — artinya **berubah bila pelanggan diubah namanya kelak**, yang persis kebalikan
dari tujuan snapshot.

## Business Meaning

PMB-07a membekukan identitas komersial supaya dokumen yang sudah terbit tidak berubah diam-diam
saat data master pelanggan diperbarui. Untuk Sales Order, **jaminan itu tidak berlaku** lewat
jalur yang dipakai orang.

## Architecture Implication

Contoh **"dua jalur hidup"** persis seperti yang diperingatkan CLAUDE.md: perbaikan (PMB-07a)
diterapkan di satu jalur, jalur kedua tidak ikut, dan hasilnya terlihat seperti perbaikan yang
"sudah diterapkan" padahal jalur yang dipakai tidak berubah.

## Required Correction

Digabung ke **WO-S02** (SC-04), karena keduanya berakar pada duplikasi jalur yang sama.
Memperbaiki SC-01b sendirian berarti menambal salinan kedua — bukan menutup kelasnya.

## Acceptance Criteria

SO yang dibuat lewat layar memiliki ketiga kolom snapshot terisi; `identity_predates_snapshot`
bernilai `true` **hanya** untuk baris yang benar-benar terbit sebelum kolomnya ada.

## Dependencies

Sama dengan SC-04.

## Decision Required

Tidak ada keputusan bisnis. Tercakup di **AD-02** (jalur mana yang kanonik).

## Status

**BARU · P0 · nol baris terdampak** (0 Sales Order di data nyata). Jendela perbaikan terbuka.

## Confidence

**HIGH**

---

# SC-02 — Customer PO Hold / Cancel

## Current Evidence

**E1 — Nilainya sah di skema.** `customer_purchase_orders_status_check`
= `new | on_hold | cancelled | processed`.

**E2 — Transisinya SUDAH KANONIK,** di `status_transition_rules`:

```
customer_purchase_orders:  new     -> on_hold
                           new     -> cancelled
                           new     -> processed
                           on_hold -> new          (= "release")
                           on_hold -> cancelled
```

Yang **tidak** ada, dan karena itu terlarang: `processed -> apa pun`, `cancelled -> apa pun`.
Artinya, dari bukti: **PO yang sudah diproses tidak bisa ditahan/dibatalkan lagi**, dan
**pembatalan bersifat final** (tidak bisa diaktifkan kembali).

**E3 — Di UI keduanya hanya LABEL, bukan aksi.** `CustomerPurchaseOrdersPage.tsx:69-78`
memetakan `on_hold: 'Ditunda'` / `cancelled: 'Dibatalkan'` beserta warna Tag. Sensus
seluruh `src/` + `app/`: kata `on_hold` hanya muncul di **dua** berkas — halaman itu dan
`src/lib/glossary.ts`. **Nol endpoint, nol tombol, nol fungsi server.**

**E4 — Data nyata:** 0 PO `on_hold`, 0 PO `cancelled` (dari 1 PO yang ada).

**E5 — Kolom alasan ADA tetapi tidak pernah diisi.** `status_transition_log` punya kolom
`reason`, dan `enforce_status_transition()` selalu menulis `reason = null` — nilainya
di-hardcode di trigger.

## AS-IS

Halaman PO Klien **sanggup menampilkan** status Ditunda dan Dibatalkan, tetapi **tidak ada
apa pun di seluruh sistem yang bisa menghasilkannya**. Ini kejadian **KEENAM** dari kelas
"status/alert/tombol tanpa pemicu" yang tercatat di CLAUDE.md.

## Business Meaning

**BELUM ADA.** Yang sudah terjawab bukti hanyalah **bentuk transisinya**; yang belum terjawab
adalah **artinya**:

| Pertanyaan §7.1 | Terjawab bukti? |
|---|---|
| Apakah PO tetap "aktif" saat ditahan? | **Ya** — `on_hold -> new` dan `on_hold -> cancelled` ada; `on_hold -> processed` **tidak ada** → **konversi ke SO TERBLOKIR selama ditahan** |
| Apakah bisa direaktivasi setelah dibatalkan? | **Ya — TIDAK BISA.** `cancelled` terminal |
| Apakah riwayat terjaga? | **Ya** — `status_transition_log` mencatat tiap transisi |
| Siapa boleh menahan / melepas / membatalkan? | **TIDAK** — UNKNOWN |
| Apakah alasan wajib? | **TIDAK** — UNKNOWN (kolomnya ada, isinya selalu kosong) |
| Apa **arti bisnis** "ditahan"? | **TIDAK** — UNKNOWN |

## Architecture Implication

Tidak ada mesin status baru yang perlu dibangun. Yang kurang adalah **pemicu, wewenang, dan
alasan**. Menambahkan tombol tanpa ketiganya akan mengulang kelas cacat yang sama, bukan
menutupnya.

## Required Correction

**JANGAN membuat tombol sekarang.** Aturan §7.2 dipatuhi.

## Acceptance Criteria

*(Ditulis lengkap di WO-S04, aktif hanya setelah BD-05..BD-07 dijawab.)*

## Dependencies

Menyentuh konversi PO → SO: PO yang ditahan tidak boleh bisa diproses. Ini **sudah**
ditegakkan trigger; jalur aplikasi wajib memberi pesan yang bisa dibaca, bukan galat mentah.

## Decision Required

**BUSINESS DECISION REQUIRED — BD-05, BD-06, BD-07.**

## Status

**TETAP — DIPERTAJAM.** `WAITING FOR BUSINESS DECISION`.

## Confidence

**HIGH** untuk bentuk transisi & ketiadaan pemicu; **UNKNOWN** untuk arti bisnisnya —
dan ketidaktahuan itu **tidak diisi tebakan**.

---

# SC-03 — Sales Order Row Access

## Current Evidence

**E1 — Sensus kebijakan RLS seluruh tabel Sales (proyek NYATA, baca-saja):**

| Tabel | RLS aktif | Jumlah kebijakan |
|---|---|---|
| `customers` | ya | 2 |
| `customer_purchase_orders` | ya | 3 |
| `customer_purchase_order_lines` | ya | 1 |
| `customer_po_approvals` | ya | 2 |
| `customer_delivery_addresses` | ya | 2 |
| `sales_orders` | ya | 2 |
| **`sales_order_lines`** | **ya** | **0** |
| `shipments` | ya | 2 |
| `shipment_lines` | ya | 2 |

**Lubangnya persis SATU tabel**, dan seluruh tetangganya terjaga.

**E2 — Kebijakan `sales_orders` yang ada:**

```
sales_orders_select_for_company [SELECT]  company_id = jwt_company_id()
sales_orders_update_ppic        [UPDATE]  company_id = jwt_company_id()
                                          AND ( leadership OR ppic_manager
                                                OR ppic_staff OR production_manager )
```

Tidak ada kebijakan INSERT maupun DELETE untuk `sales_orders` → keduanya tertutup bagi
klien ber-RLS.

**E3 — Kenapa aplikasi tetap jalan.** Seluruh jalur baca/tulis Sales memakai
`getAdminClient()` (service role) yang **melewati RLS**; penyaringan tenant dilakukan di
kode aplikasi lewat `appUser.company_id`.

**E4 — Bandingkan dengan pola kanonik yang sudah dipakai tetangganya:**
`customer_po_lines_write_ppic` menegakkan kepemilikan **lewat induknya** —
`EXISTS (select 1 from customer_purchase_orders cpo where cpo.… = … and cpo.company_id = jwt_company_id())`,
digabung peran. Pola yang sama persis dapat dipakai untuk `sales_order_lines` lewat
`sales_orders`.

## AS-IS

Baris Sales Order Line **tidak terjaga di tingkat baris**. Yang menjaganya hari ini hanyalah
kode aplikasi. Karena kebijakan nihil dan RLS menyala, klien ber-RLS mana pun mendapat
**nol baris** — **gagal-tertutup, bukan bocor**.

## Business Meaning

Tidak ada kebocoran data hari ini. Yang hilang adalah **lapis kedua** yang dijanjikan
Prinsip Arsitektur #1 CLAUDE.md: *"Terapkan RLS untuk isolasi antar tenant, **bukan cuma
filter di kode aplikasi**."*

## Architecture Implication

Ini bentuk berbahaya versi **diam**: tidak ada yang gagal, tidak ada yang merah, dan
perlindungannya tetap tidak ada. Ia baru terasa ketika ada jalur baru yang **tidak** memakai
service role — jalur itu akan mendapat nol baris, dan orang akan mengira datanya hilang.

**Wewenang di sini TIDAK BOLEH ditebak** — pola kanoniknya sudah ada di tetangga, jadi
menyalinnya adalah keputusan **teknis**, bukan kebijakan hak akses baru. Aturan CLAUDE.md
"Dilarang membangun sistem identitas/peran/persetujuan PARALEL" berarti: **PERLUAS** yang
ada (`jwt_company_id()` + `jwt_app_role()`), jangan bikin model kedua.

## Required Correction

Tambahkan kebijakan `sales_order_lines` yang **meniru persis** pola
`customer_po_lines_write_ppic`, menegakkan kepemilikan lewat induk `sales_orders` dan
menyelaraskan peran dengan `sales_orders_update_ppic`. **Jangan mencabut RLS.**

## Acceptance Criteria

- Pengguna berwenang di company yang sama: **bisa baca**.
- Pengguna company lain: **nol baris** — diuji langsung, bukan disimpulkan.
- Peran tanpa wewenang tulis: **ditolak di server**, bukan hanya tombolnya disembunyikan.
- Jalur aplikasi yang ada **tidak berubah perilakunya** (service role tetap lewat).
- Isolasi tenant terbukti lewat test, bukan lewat pembacaan kebijakan.

## Implementation Work Order

**WO-S03.**

## Dependencies

Nihil. **Dapat berjalan paralel penuh.**

## Decision Required

**Tidak ada** — pola kanoniknya sudah ada di tabel tetangga. Bila ternyata peran yang tepat
berbeda dari `sales_orders_update_ppic`, barulah jadi keputusan; sampai bukti menunjukkan
sebaliknya, **selaraskan dengan induknya**.

## Status

**TETAP — DIPERTAJAM.** `SAFE TO IMPLEMENT` (dengan catatan uji isolasi wajib).

## Confidence

**HIGH**

---

# SC-04 — Sales Order Transaction Integrity

> **TEMUAN INI BERUBAH SECARA MATERIAL.** Rumusan lama — *"pembuatan SO memakai kompensasi
> manual, bukan transaksi"* — **benar tetapi tidak lengkap**, dan ketidaklengkapannya
> mengubah perbaikannya.

## Current Evidence

**E1 — Kompensasi manual memang ada** (`processCustomerPurchaseOrder.ts:167-171`):

```ts
if (soLinesInsertError) {
  await adminClient.from('sales_orders').delete().eq('sales_order_id', insertedSo.sales_order_id);
  return { status: 500, body: { error: soLinesInsertError.message } };
}
```

Bila `delete` itu sendiri gagal, tertinggal Sales Order **tanpa baris** — dan `so_number`-nya
sudah terpakai.

**E2 — YANG BARU: jalur ATOMIK sudah ada di database, dan tidak dipakai.**
`public.process_customer_purchase_order(integer, integer)` — plpgsql, `security definer`,
`grant execute … to authenticated`, terakhir diperbarui migrasi `20260827480000`. Ia
melakukan **dalam satu transaksi implisit**: validasi kepemilikan (`jwt_company_id()`),
wewenang (`jwt_is_company_leadership()`), gerbang status `new`, gerbang 3 persetujuan,
validasi pabrik, penomoran SO, insert SO, insert seluruh SO lines, dan update status PO.
Gagal di titik mana pun → **seluruhnya batal**, tanpa kompensasi apa pun.

**E3 — Nol pemanggil di aplikasi.** Hanya `tests/pmb07a_identity_snapshot.test.ts:201` dan
`tests/mlvt_case_study_skeleton.test.ts:162`. Route produksi memanggil versi TypeScript.

**E4 — Kedua jalur SALING KEKURANGAN, dan itu inti masalahnya:**

| Kemampuan | Fungsi DB | Jalur TypeScript (yang dipakai) |
|---|---|---|
| Atomik (satu transaksi) | **ya** | tidak — kompensasi manual |
| Wewenang ditegakkan server-side lewat JWT | **ya** | via `appUser` + service role |
| Snapshot identitas (PMB-07a) | **ya** | **tidak** *(= SC-01b)* |
| `idempotency_key` + balasan "replayed" | **tidak** | **ya** |
| Pesan galat yang bisa dibaca orang pabrik | tidak (`raise exception`) | **ya** |

**E5 — Pemeriksaan yang menurunkan risiko Opsi A: KEDUA jalur memakai gerbang wewenang
yang SAMA PERSIS.** Diukur baris per baris, bukan diasumsikan setara:

| Gerbang | Fungsi DB | TypeScript |
|---|---|---|
| Wewenang peran | `jwt_is_company_leadership()` | `isCompanyLeadership(appUser.role)` |
| Kepemilikan company | `v_po.company_id <> jwt_company_id()` | `po.company_id !== appUser.company_id` |
| Status PO wajib `new` | ya | ya |
| Gerbang 3 persetujuan | ya | ya |
| Validasi pabrik milik company | ya | ya |

Artinya berpindah ke fungsi DB **tidak melonggarkan maupun memperketat** siapa boleh memproses
PO Klien. Yang berpindah hanyalah **tempat penegakannya** — dari kode aplikasi ke database.
Itu tetap wajib diuji per peran, tetapi risikonya jauh lebih kecil daripada bila keduanya berbeda.

**E6 — Bukti bahwa duplikasi ini SUDAH DISADARI dan tetap dibiarkan.**
`processCustomerPurchaseOrder.ts` memuat komentar:
*"Format & aturan HARUS identik dengan fungsi DB process_customer_purchase_order()"* —
yaitu penjagaan yang **bergantung pada penulis berikutnya mengingatnya**. Persis bentuk
"kebetulan benar" yang dicatat CLAUDE.md sebagai kelas cacat keempat. Dan ia **sudah
meleset**: snapshot identitas ditambahkan ke fungsi DB, tidak ke jalur TypeScript.

## AS-IS

Ada **dua implementasi lengkap** dari satu proses bisnis yang sama. Yang dipakai adalah
yang **tidak atomik dan tidak menyalin snapshot**. Yang tidak dipakai adalah yang atomik
tetapi tidak punya idempotensi.

## Business Meaning

Sebuah PO Klien yang diproses saat jaringan/DB tersendat dapat menghasilkan **Sales Order
tanpa satu pun baris barang**, sementara nomor SO-nya sudah terpakai untuk tahun berjalan.
Karena nomor dihitung dari **jumlah baris tahun berjalan** (aturan yang tercatat di
CLAUDE.md), SO hantu itu **menggeser penomoran seluruh SO berikutnya**.

## Architecture Implication

Perbaikan yang benar **bukan** "tulis transaksi" — transaksinya sudah ada. Yang benar adalah
**memilih satu jalur kanonik dan mematikan yang lain**, sambil memindahkan kemampuan yang
hanya dimiliki jalur yang kalah. Menambal jalur TypeScript agar juga menyalin snapshot akan
**melanggengkan dua jalur**, dan cacat berikutnya akan lahir dengan cara yang sama persis.

Ini menyentuh fungsi `security definer` dan **memindahkan penegakan wewenang** dari
service-role ke JWT. Karena itu ia **bukan** keputusan teknis biasa.

## Required Correction

Satu jalur kanonik. Rekomendasi berbukti: **fungsi DB sebagai jalur kanonik**, diperluas
dengan `idempotency_key`, dan jalur TypeScript menyusut jadi pemanggil RPC yang
menerjemahkan `raise exception` menjadi pesan Bahasa Indonesia yang bisa dibaca.
**Keputusan tetap milik Architecture Guardian** — lihat AD-02.

## Acceptance Criteria

Skenario gagal: nol SO yatim · nol baris yatim · nol commit sebagian · nol nomor SO
terbakar · audit tidak mencatat kejadian yang tidak terjadi.
Skenario berhasil: SO + seluruh baris + snapshot identitas + status PO `processed`
tersimpan; permintaan ulang mengembalikan SO yang sama (`replayed`), bukan SO kedua.
Wajib: **test yang benar-benar menggagalkan insert baris** dan membuktikan nol sisa —
bukan test yang hanya memanggil jalur berhasil.

## Implementation Work Order

**WO-S02.**

## Dependencies

Menyerap **SC-01b**. Tidak bergantung pada SC-01 — pilihan model status tidak mengubah
keatomikan pembuatan.

## Decision Required

**ARCHITECTURE DECISION REQUIRED — AD-02.**

## Status

**BERUBAH MATERIAL.** `SAFE TO INVESTIGATE` sekarang; `SAFE TO IMPLEMENT` setelah AD-02.

## Confidence

**HIGH**

---

# SC-05 — Shipping Address

> **TEMUAN INI BERUBAH SECARA MATERIAL.** BL-04 dicatat sebagai *"mana sumber kebenaran saat
> pengiriman dibuat **belum diverifikasi**"*. **Sekarang sudah diverifikasi**, dan jawabannya
> mengubah bentuk pekerjaannya.

## Current Evidence

**E1 — Layarnya SUDAH ADA.** WS-05 (batch sebelumnya) membangun pengelolaan alamat kirim di
`/customers`: baris pelanggan dapat dimekarkan, alamat dimuat lewat
`GET /api/customer-delivery-addresses?customer_id=…`, ditambah lewat `POST`, diarsipkan lewat
`DELETE`. Temuan lama *"nol layar"* **tidak berlaku lagi**.

**E2 — Sumber kebenaran alamat pengiriman, terukur dari kode:**

```
customer_delivery_addresses   = DAFTAR MASTER (dipilih)
        │  createShipmentWithSignature.ts:81-108 — bila delivery_address_id dikirim,
        │  alamatnya DIBACA dari daftar lalu DISALIN ke teks
        ▼
shipments.delivery_address    = TEKS BEKU, sumber kebenaran untuk pengiriman itu
shipments.delivery_address_id = JEJAK REFERENSI saja
```

`delivery_address_id` ditulis **setelah** RPC sukses, lewat `update` terpisah
(`createShipmentWithSignature.ts:201`), dan komentarnya menyatakan tegas:
*"Kegagalan di sini TIDAK membatalkan shipment yang sudah tercipta — delivery_address (teks
beku) sudah benar apa pun hasilnya, kolom ini murni jejak referensi."*

Yang membaca alamat pengiriman ke layar/dokumen — `listShipments`, `getShipmentDetail`,
`getShipmentByPodToken`, `listSalesOrders`, `PodConfirmationPage` — **seluruhnya membaca
`delivery_address` (teks beku)**, tidak satu pun membaca `delivery_address_id`.

**E3 — `customers.shipping_address` TIDAK PERNAH dibaca saat membuat pengiriman.** Sensus
seluruh pemakainya: `listCustomers.ts:23` (dimuat ke daftar), `customerValidation.ts:21,54`
(diurai dari formulir), `CustomersPage.tsx:52,81,290,315,802` (satu `TextInput`). **Nol
jalur** dari kolom itu ke `createShipmentWithSignature`.

**E4 — Nilai bawaan alamat di formulir pengiriman berasal dari RIWAYAT PENGIRIMAN, bukan dari
master pelanggan.** `ShipmentsPage.tsx:268-274` mengambil `delivery_address` dari pengiriman
terakhir pelanggan yang sama sebagai titik awal yang bisa diedit.

**E5 — Formulir pengiriman TIDAK PERNAH mengirim `delivery_address_id`.** Sensus
`ShipmentsPage.tsx`: nol kemunculan `delivery_address_id`, nol pemanggilan
`/api/customer-delivery-addresses`. Kemampuan server ada, **pintunya belum dibuka**.

**E6 — `sales_orders` tidak punya kolom alamat apa pun.** Daftar kolomnya (terukur):
`sales_order_id, company_id, customer_purchase_order_id, customer_id, production_plant_id, status, created_at, so_number, idempotency_key, customer_name_snapshot, customer_billing_address_snapshot, customer_npwp_snapshot`.

**E7 — `POST /api/customer-delivery-addresses/[addressId]/restore` punya NOL pemanggil UI.**

**E8 — Data nyata:** 0 `customer_delivery_addresses`, 0 pelanggan dengan
`shipping_address` terisi, 0 pengiriman. **Nol data terdampak dari arah mana pun.**

## AS-IS

Berlapis, dan **lapisannya sudah benar**: daftar master → dipilih → **dibekukan** sebagai teks
pada pengiriman → id disimpan sebagai jejak. Pengiriman historis **tidak berubah** saat alamat
master diubah kelak — jaminan §10.2 sudah terpenuhi **di tingkat pengiriman**.

## Business Meaning

**Tidak ada duplikasi sumber kebenaran untuk pengiriman.** Yang duplikat adalah di tingkat
**pelanggan**: `customers.shipping_address` (satu kotak teks bebas di formulir pelanggan) hidup
berdampingan dengan `customer_delivery_addresses` (daftar sungguhan), dan **hanya yang kedua
yang berpengaruh pada apa pun**. Orang bisa mengetik alamat di kotak itu dan alamat itu
**tidak akan pernah dipakai**, tanpa satu pun tanda di layar.

Itu masuk **golongan C** menurut aturan CLAUDE.md — field yang tidak dipakai perhitungan.
Uji lanjutannya: apakah ia berguna sebagai **catatan**? Berbeda dari Nomor BPOM/Kode Halal
(catatan kepatuhan yang diminta), kotak ini **menyaru sebagai field operasional** dan
mengundang orang mengisinya untuk tujuan yang tidak akan tercapai.

## Architecture Implication

**BL-04 tidak lagi berbentuk "sumber kebenaran mana yang menang saat mengirim"** — itu sudah
terjawab. Yang tersisa adalah keputusan **nasib kolom lama**, dan itu memang menyentuh skema
→ tetap **WAITING FOR ARCHITECTURE DECISION**, sesuai larangan §10.4.

Bagian UI-nya **tidak menyentuh sumber kebenaran sama sekali** → §17 berlaku: **jangan
memblokir seluruh workstream** karena satu bagiannya menunggu keputusan.

Untuk alamat di tingkat **Sales Order** (§10.2): butuh kolom baru → **skema** → ditahan.
Dan sebelum menambah kolom, pertanyaan bisnisnya harus dijawab dulu: **apakah alamat tujuan
perlu ditetapkan saat order, atau cukup saat mengirim?** Hari ini sistem menganutnya
saat mengirim, dan itu bekerja.

## Required Correction

Dipecah tiga, **sengaja**:

| Bagian | Menyentuh skema? | Klasifikasi |
|---|---|---|
| **(a)** Pemilih alamat tersimpan di formulir pengiriman *(= SC-05b)* | tidak | **SAFE TO IMPLEMENT** |
| **(b)** Nasib `customers.shipping_address` | ya | **WAITING FOR ARCHITECTURE DECISION (BL-04)** |
| **(c)** Alamat tujuan di tingkat Sales Order | ya | **WAITING FOR BUSINESS DECISION (BD-08)** |

## Acceptance Criteria

*(a)*: alamat tersimpan dapat dipilih; yang terpilih **dibekukan** ke `delivery_address`;
`delivery_address_id` tercatat; alamat sekali-pakai **tetap bisa diketik**; alamat terarsip
tidak muncul; keadaan kosong menawarkan jalan ke pengelolaan alamat; enam lebar wajib lulus
tiga pemeriksaan tepi.

## Implementation Work Order

**WO-S05** (bagian a) · **WO-S05b** (bagian b & c, ditahan).

## Dependencies

Bagian (a): **nihil**. Bagian (b) dan (c): keputusan.

## Decision Required

**BL-04 diperbarui** (lihat bawah) + **BD-08**.

## Status

**BERUBAH MATERIAL.** Sebagian `SAFE TO IMPLEMENT`, sebagian `WAITING FOR DECISION`.

## Confidence

**HIGH**

---

# SC-05b — *(TEMUAN BARU)* Alamat tersimpan tidak bisa dipilih saat membuat pengiriman

## Current Evidence

Server menerima `delivery_address_id` dan memvalidasinya lengkap
(`createShipmentWithSignature.ts:81-108`: milik company yang sama, tidak terarsip, alamatnya
disalin jadi teks beku). `ShipmentsPage.tsx`: **nol kemunculan** `delivery_address_id`.

## Business Meaning

Alamat yang susah payah didaftarkan di halaman Pelanggan **tidak muncul** di tempat ia
dibutuhkan. Petugas gudang tetap mengetik ulang alamat — sumber salah ketik yang persis
ingin dihindari daftar alamat itu.

## Architecture Implication

Ini **kemampuan server yang tidak punya pintu**, bukan kemampuan yang belum ada. Nol
perubahan skema, nol perubahan sumber kebenaran, nol perubahan kontrak lintas domain.

## Status

**BARU · P1 · `SAFE TO IMPLEMENT`** → **WO-S05**.

## Confidence

**HIGH**

---

# Master Document / DEC-S10 (§11)

**Diperiksa, tidak ditemukan pertentangan yang memblokir.** Registry dokumen terpusat
(*Master Dokumen*) masih **digerbang** sampai SAS001 & SAS005 terkirim (tercatat di CLAUDE.md),
dan aturan yang berlaku maju sudah sesuai arah bisnis §11: setiap titik unggah **baru** wajib
lewat `uploadFileWithMetadata` yang menyimpan **berkas + metadata + checksum + rujukan
entitas** — yaitu repositori dokumen, **bukan** basis data keputusan bisnis. Kebenaran bisnis
tetap di Sales Order / PO / persetujuan.

**WO-S06 TIDAK DIBUAT** — syaratnya (*"ONLY IF current evidence shows implementation
conflict"*) tidak terpenuhi.

---

# ARCHITECTURE DECISION REQUIRED

## AD-01 — Sales Order: status eksekusi disimpan atau diturunkan?

**Problem.** `status_transition_rules` memperlakukan `in_production` dan `completed` sebagai
status **tersimpan** milik baris Sales Order. DEC-S11 memberikan kepemilikan keduanya kepada
Manufacturing dan Logistics. Keduanya belum didamaikan.

**Evidence.** `status_transition_rules` (4 aturan untuk `sales_orders`) · trigger
`enforce_status_transition` aktif · `status_transition_log` **0 baris** · nol `.update()`
pada `sales_orders` di seluruh `src/` · DEC-S11 tertutup pada 29 Agu 2026.

**Current behavior.** Status selamanya `confirmed`. Visibilitas eksekusi **diturunkan** dan
ditampilkan terpisah (WS-A), tanpa menyentuh status tersimpan.

**Canonical expectation.** `FABRIX_STATE_MACHINE_REGISTRY` menyatakan sendiri:
*"Do not copy these blindly into code. Reconcile with current implementation and approved
domain architecture."* Jadi aturan DB **bukan** jawaban otomatis.

**Options.**
- **A — Status tersimpan, ditulis domain pemilik.** Aturan DB dipertahankan; Manufacturing
  menulis `in_production`, Logistics menulis `completed`. *Untung:* satu kolom bisa dibaca
  siapa pun, riwayatnya otomatis masuk `status_transition_log`. *Rugi:* tiga domain menulis
  satu kolom milik Sales — batas domain jadi tipis, dan status bisa basi bila penulisnya gagal.
- **B — Komersial saja, eksekusi diturunkan.** `status` hanya `confirmed`/`cancelled`; sisanya
  dihitung. *Untung:* batas domain tegas, mustahil basi, sudah berjalan hari ini (WS-A).
  *Rugi:* tidak ada riwayat "kapan mulai produksi" di log status, dan **dua baris
  `status_transition_rules` wajib dicabut** supaya tidak jadi aturan hantu.

**Recommendation.** **Opsi B**, dengan alasan yang bisa diuji: status turunan **tidak bisa
basi**, sedangkan status tersimpan bisa — dan proyek ini sudah punya kelas cacat
"status yang berbohong tanpa terlihat berbohong". Konsekuensi B yang **wajib ikut dikerjakan**:
mencabut dua aturan transisi yang jadi mati.

**Impact.** WO-S01 · dashboard · penyerahan SO → Work Order.
**Affected workstreams.** WS-02 (Sales Order lifecycle).
**Safe workstreams still available.** WO-S03, WO-S05 (bagian a), dan penyelidikan WO-S02.

## AD-02 — Pembuatan Sales Order: fungsi DB atau TypeScript sebagai jalur kanonik?

**Problem.** Dua implementasi lengkap untuk satu proses; yang dipakai bukan yang atomik, dan
tiap jalur punya kemampuan yang tidak dimiliki yang lain.

**Evidence.** E1–E5 di SC-04, ditambah SC-01b sebagai bukti bahwa duplikasi ini **sudah
melahirkan cacat nyata**.

**Current behavior.** Route memanggil TypeScript; fungsi DB hanya dipanggil dua test.

**Canonical expectation.** CLAUDE.md: *"Setelah komponen bersama ada, menulis jalur kedua
untuk hal yang sama adalah CACAT, bukan pilihan"*, dan *"ini tidak bisa diselesaikan dengan
disiplin — hanya dengan pengawas."*

**Options.**
- **A — Fungsi DB kanonik.** Tambahkan `idempotency_key` ke fungsi; TypeScript menyusut jadi
  pemanggil RPC + penerjemah pesan galat. *Untung:* atomik sungguhan, wewenang ditegakkan
  database, snapshot ikut dengan sendirinya. *Rugi:* menyentuh `security definer`, dan
  memindahkan penegakan wewenang dari service-role ke JWT — perlu uji peran menyeluruh.
- **B — TypeScript kanonik.** Cabut fungsi DB; bungkus tulisan dalam satu RPC transaksional
  baru. *Untung:* pesan galat tetap ramah. *Rugi:* menulis ulang yang sudah ada dan sudah teruji.
- **C — Biarkan keduanya, tambal snapshot di TypeScript.** **Tidak direkomendasikan** — persis
  cara cacat ini lahir.

**Recommendation.** **Opsi A**, dengan pengawas wajib: sebuah test yang **gagal keras** bila
ada jalur kedua yang menulis `sales_orders` di luar RPC kanonik. Tanpa pengawas itu, jalur
kedua akan lahir lagi.

**Impact.** WO-S02 (menyerap SC-01b).
**Affected workstreams.** Pembuatan Sales Order.
**Safe workstreams still available.** Seluruhnya — WO-S02 dapat diselidiki penuh tanpa keputusan.

## BL-04 *(DIPERBARUI — bukan lagi "belum diverifikasi")*

**Problem.** `customers.shipping_address` hidup berdampingan dengan
`customer_delivery_addresses`.

**Yang SUDAH terjawab bukti** (dan karena itu **tidak lagi jadi pertanyaan**): pembuatan
pengiriman **tidak pernah membaca** `customers.shipping_address`. Sumber kebenaran pengiriman
adalah `shipments.delivery_address` (teks beku); `delivery_address_id` adalah jejak referensi;
`customer_delivery_addresses` adalah daftar master.

**Yang MASIH jadi keputusan:** nasib kolom lama — dibiarkan, disembunyikan dari formulir,
atau dicabut lewat migrasi.

**Options.** (1) biarkan apa adanya *(rugi: mengundang pengisian yang tidak berdampak)* ·
(2) sembunyikan dari formulir pelanggan, kolom tetap ada *(nol risiko data, menutup jalan
salah paham, reversibel)* · (3) migrasikan isinya jadi baris `customer_delivery_addresses`
lalu cabut kolomnya *(paling bersih, menyentuh skema)*.

**Recommendation.** **Opsi 2 sekarang, opsi 3 kelak** — karena **0 pelanggan** punya nilai di
kolom itu, migrasi hari ini memindahkan nol baris; dan aturan CLAUDE.md menegaskan pengaman/
kolom lama dicabut **hanya setelah penggantinya terbukti bekerja** (yaitu setelah WO-S05
membuktikan pemilih alamat dipakai sungguhan).

**Impact.** WO-S05b. **Safe workstreams still available.** WO-S05 bagian (a) berjalan penuh.

---

# BUSINESS DECISION REQUIRED

Ditulis sebagai pertanyaan yang bisa dijawab pemilik produk, **tanpa jawaban yang dikarang**.

| Kode | Pertanyaan | Kenapa penting | Memblokir |
|---|---|---|---|
| **BD-01** | Sebuah order dianggap **SELESAI** kapan? Saat barang terkirim, saat pelanggan menandatangani terima, atau saat pembayaran lunas? | Menentukan arti `completed`, dan ikut menentukan kapan margin diakui | WO-S01 |
| **BD-02** | **Siapa** yang boleh membatalkan Sales Order? | Wewenang, tidak boleh ditebak | WO-S01 |
| **BD-03** | Boleh membatalkan setelah **Work Order dibuat**? Setelah **produksi mulai**? Bila boleh, perlu persetujuan siapa? | Bahan sudah terpakai — pembatalan punya biaya nyata | WO-S01 |
| **BD-04** | Bila salah satu departemen **menolak** PO Klien: PO kembali dapat diperbaiki, atau mati? | Hari ini `rejected` ada di CHECK; akibatnya belum ditentukan | WO-S01, WO-S04 |
| **BD-05** | Apa arti **"Ditunda"** bagi PO Klien dalam pekerjaan sehari-hari? | Tanpa ini, tombolnya cuma mengubah warna | WO-S04 |
| **BD-06** | **Siapa** boleh menahan, melepas, dan membatalkan PO Klien? | Wewenang | WO-S04 |
| **BD-07** | **Alasan wajib** diisi saat menahan/membatalkan? | Kolom `reason` sudah ada dan selalu kosong | WO-S04 |
| **BD-08** | Alamat tujuan ditetapkan saat **order diterima**, atau cukup saat **barang dikirim**? | Menentukan perlu-tidaknya kolom alamat di Sales Order | WO-S05b |

**Workstreams still READY meski kedelapan pertanyaan belum dijawab:** WO-S03 (akses baris),
WO-S05 bagian (a) (pemilih alamat), dan penyelidikan WO-S02.

---

# Dependency Map

```
                          ┌──────────────────────────────────────┐
   AD-01 ─────────────────▶  WO-S01  Sales Order Lifecycle       │  P0  DITAHAN
   BD-01..BD-04 ──────────▶  (status, persetujuan, pembatalan)   │
                          └───────────────┬──────────────────────┘
                                          │ menentukan
                                          ▼
                                  penyerahan SO → Work Order
                                  (domain Manufacturing)

   AD-02 ─────────────────▶┌──────────────────────────────────────┐
                           │  WO-S02  Transaction Integrity       │  P0  SELIDIKI SEKARANG
   SC-01b diserap ────────▶│  + snapshot identitas                │      bangun setelah AD-02
                           └──────────────────────────────────────┘
                                  ⇅ TIDAK bergantung pada WO-S01

   (nol dependensi) ──────▶┌──────────────────────────────────────┐
                           │  WO-S03  Sales Order Row Access      │  P1  AMAN DIKERJAKAN
                           └──────────────────────────────────────┘

   BD-05..BD-07 ──────────▶┌──────────────────────────────────────┐
                           │  WO-S04  Customer PO Hold / Cancel   │  P1  DITAHAN
                           └───────────────┬──────────────────────┘
                                           │ menyentuh
                                           ▼
                                  konversi PO → SO
                                  (sudah dijaga trigger)

   (nol dependensi) ──────▶┌──────────────────────────────────────┐
                           │  WO-S05  Pemilih alamat di pengiriman│  P1  AMAN DIKERJAKAN
                           └──────────────────────────────────────┘
   BL-04 ─────────────────▶┌──────────────────────────────────────┐
   BD-08 ─────────────────▶│  WO-S05b Kolom lama & alamat di SO   │  P2  DITAHAN
                           └──────────────────────────────────────┘
```

**Aturan paralel yang berlaku (§13):** WO-S03 dan WO-S05 **tidak berbagi entitas, status,
maupun migrasi** dengan yang lain → **paralel penuh**. WO-S01 dan WO-S04 berbagi konsep
transisi status → **diurutkan**, WO-S01 lebih dulu. WO-S02 berbagi tabel `sales_orders`
dengan WO-S01 → **diurutkan** bila keduanya nanti terbuka bersamaan.

---

# Klasifikasi akhir

| WO | Judul | Prioritas | Klasifikasi |
|---|---|---|---|
| **WO-S01** | Sales Order Lifecycle & Approval | **P0** | **WAITING FOR ARCHITECTURE DECISION** (AD-01) **+ BUSINESS DECISION** (BD-01..04) |
| **WO-S02** | Sales Order Transaction Integrity *(+ SC-01b)* | **P0** | **SAFE TO INVESTIGATE** sekarang · implementasi menunggu **AD-02** |
| **WO-S03** | Sales Order Row Access | **P1** | **SAFE TO IMPLEMENT** |
| **WO-S04** | Customer PO Hold / Cancel | **P1** | **WAITING FOR BUSINESS DECISION** (BD-05..07) |
| **WO-S05** | Pemilih alamat tersimpan di formulir pengiriman | **P1** | **SAFE TO IMPLEMENT** |
| **WO-S05b** | Nasib kolom lama + alamat di tingkat SO | P2 | **WAITING FOR ARCHITECTURE DECISION** (BL-04) **+ BD-08** |
| ~~WO-S06~~ | Master Document | — | **TIDAK DIBUAT** — syaratnya tidak terpenuhi |

**Dua** dari tujuh boleh dikerjakan sekarang. **Satu** boleh diselidiki penuh. **Empat**
ditahan menunggu keputusan — dan penahanan itu **tidak memblokir** yang dua.
