# FIN-02 — KONTRAK PEMBAYARAN SALES ↔ FINANCE

**Tanggal:** 30 Agustus 2026 · **Status:** kontrak DIDEFINISIKAN, sisi Finance **belum ada**
**Sifat:** kontrak antar domain — **bukan** izin membangun Finance dari dalam Sales.

## 1. Tujuan

Sales & CRM harus bisa **bekerja penuh tanpa** subsistem Finance di dalamnya, dan **tanpa
mengarang** angka keuangan. Dokumen ini menetapkan batas, bentuk data, dan perilaku Sales
**ketika Finance belum ada** — supaya begitu Finance lahir, Sales tinggal **membaca**, bukan
dibongkar.

## 2. Kepemilikan domain

| Milik **Sales / Commercial** | Milik **Finance** |
|---|---|
| Termin pembayaran yang disepakati | Pembayaran yang benar-benar diterima |
| Milestone pembayaran (kapan jatuh) | Alokasi pembayaran ke kewajiban |
| Persentase / nominal yang diwajibkan | Piutang & tunggakan |
| Hubungan ke transaksi (Sales Order) | Pelunasan (settlement) |
| Persyaratan pembayaran komersial | Jatuh tempo aktual |
| | Penyesuaian keuangan · verifikasi |

## 3. Sumber kebenaran

| Hal | Sumber | Keadaan |
|---|---|---|
| Termin | `payment_terms` + `payment_term_steps` | **ADA** |
| Kewajiban per SO | `sales_order_payment_obligations` (beku) | **ADA** |
| Pembayaran diterima | *Finance* | **BELUM ADA** |
| Piutang / tunggakan | *Finance* | **BELUM ADA** |
| Status pembayaran | **turunan** dari dua baris di atas | **TIDAK BISA DIHITUNG** |

## 4. Produsen

**Sales** memproduksi **kewajiban pembayaran**: nilai rupiah per tahap, pemicunya, dan offset
jatuh temponya — dibekukan saat penjadwalan, tidak pernah dihitung ulang.

## 5. Konsumen

**Finance** mengonsumsi kewajiban itu sebagai **dasar tagihan dan piutang**.
**Sales** kemudian menjadi konsumen **status turunan** milik Finance — **hanya membaca**.

## 6. Kontrak data

Yang Sales sediakan per Sales Order, per tahap:

```
sales_order_id · sequence_no · label_snapshot · percentage_snapshot
trigger_event_snapshot · due_offset_days_snapshot · amount
```

Yang Sales **TIDAK** sediakan, dan tidak boleh dikarang: `paid_amount` · `payment_date` ·
`payment_status` · `payment_reference` · `outstanding` · `settlement`.

Yang Sales **harapkan** dari Finance kelak (bentuk final milik Architecture Guardian):
per kewajiban — jumlah terverifikasi, sisa, dan keadaan turunan
(`UNPAID` / `PARTIALLY PAID` / `PAID` / `OVERDUE`).

## 7. Milestone pembayaran

Empat pemicu yang sah hari ini: `konfirmasi_order` · `sebelum_produksi` · `sebelum_kirim` ·
`setelah_kirim_n_hari`. Milestone menyatakan **kapan sebuah tagihan jatuh**, bukan apakah
sudah dibayar.

## 8. Persyaratan pembayaran

Persyaratan bersifat **per transaksi**, bukan kebijakan global. Termin master boleh berubah;
transaksi yang sudah memakainya **tidak ikut berubah**.

## 9. Verifikasi pembayaran

**Milik Finance. Belum ada.** Sales **tidak boleh** memverifikasi pembayarannya sendiri —
penjual menyatakan uangnya sudah masuk adalah pelanggaran pemisahan tugas.

## 10. Status pembayaran

**Diturunkan, tidak disimpan.** Selama Finance belum ada, status pembayaran **tidak ada** —
bukan `pending`, bukan `unpaid`, melainkan **tidak diketahui**.

> **KONFLIK YANG DITEMUKAN HARI INI — lihat §16.** Kolom
> `customer_purchase_orders.payment_status` sudah ada, **ditampilkan di layar**, dan
> **tidak pernah ditulis kode mana pun**.

## 11. Tunggakan (outstanding)

**Milik Finance.** Rumusnya kelak: kewajiban − pembayaran terverifikasi. Hari ini pengurangnya
tidak ada, jadi hasilnya **tidak bisa ditampilkan**, bukan nol.

## 12. Pelunasan (settlement)

**Milik Finance.** Sales tidak menyatakan sebuah transaksi lunas.

## 13. Gerbang pembayaran

```
Sales: syarat komersial  →  Finance: verifikasi  →  Produksi / Pengiriman: gerbang
```

| Termin | Yang tertahan |
|---|---|
| 60% sebelum produksi | **Produksi** |
| 40% sebelum kirim | **Pengiriman** |
| 30 hari setelah kirim | **tidak ada** |

**Gerbang mengikuti termin transaksi**, bukan aturan global `belum bayar = terblokir`.
**Belum diimplementasikan** — menunggu verifikasi Finance (tercatat **PJL-15**).

## 14. Otorisasi

Yang menetapkan aturan: **Sales**. Yang memverifikasi: **Finance**. Yang menjalankan produksi:
**Manufacturing**. Yang menjalankan pengiriman: **Delivery**. Yang menyetujui pengecualian:
wewenang sesuai tata kelola — **bukan** Sales sendiri.

## 15. Perilaku saat galat

Bila lapisan Finance kelak ada tetapi **gagal dijawab**: Sales menampilkan **"status pembayaran
tidak tersedia"**, bukan menebak, bukan menyimpan nilai terakhir sebagai kebenaran. Gerbang yang
bergantung padanya **gagal TERTUTUP** — aktivitas tertahan, bukan diloloskan.

## 16. Perilaku saat Finance TIDAK ADA — dan satu konflik nyata

**Aturan**: layar menampilkan **komitmen**, dan menyebut batasnya apa adanya.

**Sudah benar hari ini** — panel *Jadwal pembayaran* di Sales Order: kolom *Tahap · Kapan
ditagihkan · Porsi · Nilai*, **nol kolom "Terbayar"/"Sisa"**, disertai kalimat menetap bahwa
FABRIX belum mencatat penerimaan pembayaran.

### KONFLIK — `customer_purchase_orders.payment_status`

| | |
|---|---|
| **FINDING** | Layar PO Klien menampilkan **"Status bayar"** yang tidak punya sumber |
| **AS-IS** | Kolom `payment_status` ber-`check ('pending','partial','confirmed')`, bawaan `'pending'` |
| **EVIDENCE** | Disisir seluruh `src`, `app`, `supabase/migrations`, `tests`: **nol kode menulisnya** selain bawaan kolom dan satu migrasi contoh kasus. Ditampilkan di `CustomerPurchaseOrdersPage.tsx` baris 723. Di data nyata: **1 baris, seluruhnya `pending`** |
| **TO-BE** | Status pembayaran **diturunkan dari Finance**, atau **tidak ditampilkan sama sekali** |
| **GAP** | Nilai yang selalu `pending` terbaca sebagai fakta keuangan, padahal ia hanya nilai bawaan kolom |
| **OWNERSHIP** | Finance (kelak). Hari ini: **tidak ada pemiliknya** |
| **IMPACT** | Pengguna bisa menyimpulkan pelanggan **belum membayar** padahal sistem **tidak tahu apa-apa**. Ini kelas "angka yang berbohong tanpa terlihat berbohong" |
| **RECOMMENDATION** | **Sembunyikan** dari layar sampai Finance ada. Kolomnya **jangan dihapus dulu** — penggantinya belum terbukti bekerja |
| **DECISION REQUIRED** | Pemilik produk: sembunyikan, atau ubah labelnya jadi catatan manual yang memang diisi orang? |

**Tidak diubah di giliran ini** — sesuai perintah §5: konflik **didokumentasikan**, bukan
ditambal buta. Tercatat sebagai task **PJL-17**.

## 17. Percobaan ulang (retry)

Pembacaan status Finance boleh diulang. **Perintah yang mengubah keadaan tidak boleh diulang
membabi buta** — lihat §18.

## 18. Idempotensi

Penjadwalan kewajiban **menolak** dijalankan dua kali untuk Sales Order yang sama, dengan pesan
yang mengarahkan ke alur amandemen. Pola yang sama dipakai jalur kanonik pembuatan Sales Order
(kunci diturunkan + kekangan unik).

## 19. Konsistensi historis

Kewajiban adalah **cuplikan beku**. Master termin berubah 60/40 → 50/50; Sales Order lama
**tetap 60/40**. Terbukti struktural: seluruh nilai `*_snapshot`, **nol trigger**, dan fungsi
penjadwalan menolak menjadwal ulang.

## 20. Hubungan dengan jejak keputusan

Keputusan keuangan berkonsekuensi memakai **mekanisme kanonik** (`status_transition_log` +
`decision_reason_categories`). **DILARANG** `finance_decision_log`.

## 21. Keamanan

Gagal tertutup: identitas · tenant · `company_id` · peran · kepemilikan diperiksa **sebelum**
data tersentuh. Sales **membaca** status keuangan turunan; Sales **tidak memutasi** data
Finance. **Nol fungsi keuangan boleh dipanggil `anon`/`PUBLIC`** tanpa alasan tertulis.

Terukur hari ini: keempat fungsi pembayaran/penutupan hanya memberi `execute` kepada
`postgres`, `authenticated`, `service_role`.

## 22. Syarat pengujian

Wajib lahir **bersama** Finance, bukan sesudahnya:

1. Sales **tidak bisa** memutasi data Finance — uji penolakan **menyebut lapisan** yang menolak.
2. Status pembayaran **diturunkan**: mengubah pembayaran mengubah tampilan Sales **tanpa** kolom
   status di sisi Sales.
3. Kewajiban historis **tidak berubah** saat master termin diubah.
4. Pembayaran sebagian / kelebihan / pembalikan **tidak merusak** total kewajiban.
5. Gerbang gagal **TERTUTUP** saat Finance tidak menjawab.
6. Isolasi antar tenant pada seluruh tabel keuangan baru.
7. Selalu ada **kasus berhasil yang berwenang** berdampingan dengan kasus ditolak.

---

## Penegasan BD-10 di dalam kontrak ini

**Pembayaran TIDAK menggerbangi penyelesaian Sales Order.**

Sah, dan ketiganya nyata: `COMPLETED + OUTSTANDING` · `COMPLETED + PARTIALLY PAID` ·
`COMPLETED + PAID`.

Pembayaran **boleh** menggerbangi **produksi** dan **pengiriman** bila termin transaksinya
memang mensyaratkan — **tidak pernah** penutupan order.

**Diaudit 30 Agu 2026**: disisir seluruh `src`, `app`, dan migrasi untuk pola
*"pembayaran belum lunas → tidak boleh selesai"* — **nol kejadian**. Fungsi
`selesaikan_sales_order()` **nol** menyebut pembayaran, dan itu disengaja.
