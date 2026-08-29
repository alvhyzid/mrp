# SALES_CRM_LIFECYCLE_RECONCILIATION

**Tanggal:** 29 Agustus 2026 · **Menjawab:** §4–§8 perintah eksekusi (WS-S01)
**Keputusan yang berlaku:** AD-01, BD-01, BD-02, BD-03 — seluruhnya **CLOSED**

---

## 1. KONFLIK KANONIK — dilaporkan, tidak diselesaikan diam-diam (§31)

§4.1 memerintahkan memakai **nama dan transisi kanonik dari `FABRIX_STATE_MACHINE_REGISTRY`**
dan melarang mengarang state baru. Registry itu, dibuka apa adanya, berbunyi:

```
Sales Order:
DRAFT → SUBMITTED → VALIDATING → PENDING_APPROVAL → CONFIRMED → IN_FULFILLMENT
      → PARTIALLY_FULFILLED → FULFILLED → CLOSED
Terminal: CANCELLED, REJECTED
```

Dan tiga baris di bawahnya, registry itu **membantah dirinya sendiri**:

> *"Do not copy these blindly into code. Reconcile with current implementation and approved
> domain architecture."*

Sementara implementasi hari ini, terukur dari CHECK constraint:

```
sales_orders.status  ∈  { confirmed, in_production, completed, cancelled }
```

**Jaraknya bukan soal penamaan.** Registry memuat **sebelas** state; basis data memuat
**empat**, dan **tiga di antaranya tidak pernah tercapai**. Menyalin registry apa adanya
akan menambahkan **tujuh state yang tidak satu pun punya pemicu** — persis kelas cacat yang
sudah terjadi **enam kali** di proyek ini dan yang aturannya melarang keras.

### ARCHITECTURE DECISION REQUIRED — AD-03

**Problem.** Registry kanonik dan implementasi memakai kosakata state yang berbeda, dan
registry sendiri melarang penyalinan buta. Tidak ada satu sumber yang bisa dipakai tanpa
melanggar sesuatu.

**Evidence.** `docs/00-GOVERNANCE/FABRIX_STATE_MACHINE_REGISTRY.md` baris 15–17 ·
`sales_orders_status_check` · `status_transition_rules` (4 aturan untuk `sales_orders`) ·
`status_transition_log` **0 baris** — belum pernah ada satu perpindahan status pun.

**Options.**
1. **Registry diperbarui mengikuti model yang disetujui**, lalu kode mengikuti registry.
   *Untung:* registry kembali jadi sumber tunggal. *Rugi:* menyentuh dokumen tata kelola.
2. **Kode diperluas mengikuti registry apa adanya.** *Rugi:* tujuh state tanpa pemicu, dan
   sebagian (`IN_FULFILLMENT`, `PARTIALLY_FULFILLED`, `FULFILLED`) **mencerminkan eksekusi**
   — yang menurut **AD-01** bukan milik Sales Order.
3. **Registry ditandai sebagai contoh, bukan kanon**, dan kanon Sales Order ditulis
   tersendiri.

**Recommendation.** **Opsi 1**, dengan model yang lahir dari AD-01 + BD-01 (bagian 2 di
bawah). Opsi 2 ditolak dengan alasan yang bisa diuji: ia melanggar AD-01 pada tiga state
sekaligus.

**Impact.** Seluruh WS-S01. **Safe workstreams tetap jalan:** pembatalan terkendali
(bagian 3) **tidak** bergantung pada penamaan state, karena `cancelled` sudah ada di
kedua sumber.

---

## 2. Model yang lahir dari AD-01 + BD-01 (usulan, menunggu AD-03)

**AD-01, apa adanya:** *Sales Order tidak memiliki ownership atas production/shipment status.*

**BD-01, apa adanya:** penyelesaian Sales Order butuh **empat** hal — kuantitas terpenuhi
sesuai aturan pemenuhan, konfirmasi PPIC/otoritas pemenuhan, konfirmasi Finance atas
kewajiban pembayaran **sesuai payment terms transaksi**, dan konfirmasi akhir Manager/GM.

Keduanya digabung menghasilkan pemisahan berikut:

| Lapis | Isi | Disimpan? | Pemilik |
|---|---|---|---|
| **Komersial** | `confirmed`, `cancelled`, dan satu state penyelesaian | **ya** | Sales |
| **Persetujuan** | finance · ppic · manager | **ya** (sudah ada di PO klien) | masing-masing departemen |
| **Eksekusi** | kemajuan produksi, kemajuan pengiriman, status pembayaran | **TIDAK** — dihitung | Manufacturing · Logistics · Finance |

**Konsekuensi yang paling menentukan, dan ia mengubah temuan lama:** karena eksekusi
**dihitung**, `in_production` sebagai *status tersimpan* **tidak lagi punya alasan untuk
ada**. Dua baris `status_transition_rules` yang menuju dan berangkat darinya menjadi
**aturan hantu** — dan aturan yang tidak pernah dipakai adalah pemicu palsu yang wajib
dicabut, bukan dibiarkan.

**Yang sudah dibangun dan SENGAJA netral:** visibilitas eksekusi turunan
(`src/features/mrp/server/eksekusiSalesOrder.ts`) — dihitung dari Work Order dan pengiriman,
ditampilkan sebagai Tag terpisah, **nol perubahan skema, nol penulisan status**. Ia tetap
benar apa pun hasil AD-03.

**Yang BELUM ada dan wajib ada sebelum penyelesaian bisa dibangun** — masing-masing perlu
sumbernya sendiri, dan tidak satu pun boleh ditebak:
- **aturan pemenuhan**: berapa toleransi kurang-kirim yang dianggap "terpenuhi"?
- **kewajiban pembayaran menurut terms**: hari ini `payment_terms` hanya `full | tempo`, dan
  **tidak ada** tabel jatuh tempo maupun penerimaan pembayaran. Finance **belum punya
  tempat** untuk menyatakan kewajiban terpenuhi.
- **konfirmasi PPIC dan Manager/GM atas Sales Order**: `customer_po_approvals` melekat pada
  **PO klien**, bukan Sales Order. Persetujuan tingkat Sales Order **belum ada entitasnya**.

> **BUSINESS DECISION REQUIRED — BD-09:** apa aturan pemenuhan yang dipakai (toleransi
> kurang/lebih kirim), dan **BD-10:** dari mana Finance menyatakan kewajiban pembayaran
> terpenuhi, mengingat penerimaan pembayaran belum tercatat di sistem?
>
> Keduanya **tidak ditebak**, sesuai §8: *"Jika business rule belum cukup ... jangan invent."*

---

## 3. Pembatalan terkendali — SIAP dibangun, tidak terhalang AD-03

BD-02 dan BD-03 sudah tertutup dan **tidak bergantung pada penamaan state**, karena
`cancelled` ada di kedua sumber. Empat tingkat kendali sesuai tahap eksekusi:

| Tahap | Alur |
|---|---|
| Sebelum dikonfirmasi | Sales → Batal → alasan → jejak |
| Setelah dikonfirmasi | Sales → **usul batal** → tinjauan Manager/GM → persetujuan → pembatalan terkendali |
| Setelah Work Order dibuat | usul → **tinjauan dampak** → persetujuan → pembatalan terkendali |
| Setelah produksi dimulai | usul → tinjauan dampak → **departemen terdampak** → persetujuan → pembatalan terkendali |

**LARANGAN KERAS (§6, §28), ditulis di sini supaya tidak tergerus saat implementasi:**
pembatalan **TIDAK BOLEH menghapus** Sales Order, Work Order, riwayat produksi, pemakaian
bahan, riwayat persediaan, ketertelusuran lot, maupun riwayat pengiriman. Kuantitas yang
sudah terkirim tetap eksekusi historis; pembatalan hanya menyentuh komitmen yang **belum**
dieksekusi. Barang yang sudah terkirim ditangani lewat Retur/RMA, Penggantian, Komplain,
atau Penyesuaian Komersial — **bukan** lewat penghapusan.

**Fondasinya sudah ada dan terbukti bekerja:** kolom jejak keputusan + katalog alasan +
pola RPC ber-konteks yang dibangun WS-S04/WS-S05 dipakai apa adanya. Yang perlu ditambahkan
hanya **entitas permintaan pembatalan** (siapa mengusulkan, siapa meninjau, apa hasilnya) —
dan itu memang belum ada.

---

## 4. Status akhir WS-S01

| Bagian | Status |
|---|---|
| Pemisahan lapis komersial / persetujuan / eksekusi | **DIRUMUSKAN** — menunggu AD-03 |
| Visibilitas eksekusi turunan | **SUDAH ADA**, netral terhadap AD-03 |
| Penamaan state kanonik | **TERBLOKIR — AD-03** |
| Penyelesaian order | **SIAP DIBANGUN** — BD-01 & BD-09 **terkunci** 29 Agu 2026 (berbasis pemenuhan, nol toleransi). Sebelumnya tercatat *"TERBLOKIR — BD-09, BD-10"*; BD-10 **tidak lagi** menahannya |
| Pembatalan terkendali | **SIAP DIBANGUN** — butuh entitas permintaan pembatalan |
