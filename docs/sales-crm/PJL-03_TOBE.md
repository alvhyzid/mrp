# PJL-03 TO-BE

**Dasar:** aturan bisnis terkunci 29 Agustus 2026 · **Lingkup:** penyelesaian Sales Order saja.
**Di luar lingkup dan tidak disentuh:** Finance, gerbang pembayaran, Quotation, Sample,
Contract, RMA, amandemen, kode produk pelanggan.

## 1. Kelayakan penyelesaian (completion eligibility)

Dihitung **di server**, dari fakta milik domain lain — nol angka baru disimpan di Sales.

| # | Syarat | Sumbernya |
|---|---|---|
| 1 | Status SO `confirmed` atau `in_production` | Sales |
| 2 | SO punya **minimal satu baris** | Sales |
| 3 | **Setiap** baris `qty_shipped >= qty_ordered` | Logistik, lewat `qty_shipped` |
| 4 | **Setiap** Work Order hidup di SO ini berstatus `completed`, dan **minimal ada satu** | Manufacturing |
| 5 | **Tidak ada** permintaan pembatalan yang masih `pending` | Sales |
| 6 | Konfirmasi pemenuhan PPIC **sudah ada** dan **belum basi** | PJL-03 |

**Pembayaran TIDAK termasuk syarat.** Order boleh selesai dengan tunggakan.

### Keputusan sadar pada syarat 4 — SO tanpa Work Order sama sekali

Aturan bisnis menyebut *"seluruh quantity yang menjadi commitment sudah diproduksi"*. Bila
sebuah SO **tidak punya Work Order sama sekali** (mis. barang diambil dari stok lama), tidak ada
**bukti produksi** untuk diperiksa.

Yang dilakukan: **GAGAL TERTUTUP** — tidak layak diselesaikan, dengan keterangan apa adanya
*"belum ada Work Order sebagai bukti produksi"*.

**Ini BUKAN aturan bisnis baru yang dikarang**, melainkan bacaan paling konservatif dari aturan
yang ada. Keadaan sebaliknya (menganggap "tanpa WO" = "sudah diproduksi") akan membuat SO yang
belum pernah diproduksi bisa ditutup. **Dicatat sebagai pertanyaan terbuka untuk pemilik
produk** (PJL-16), bukan diputuskan diam-diam.

## 2. Wewenang

**Nol peran baru. Nol izin baru.** Memakai `canApproveDepartment` yang sudah ada:

| Langkah | Departemen | Peran |
|---|---|---|
| Konfirmasi pemenuhan | `ppic` | **`ppic_manager`** |
| Konfirmasi akhir (penutupan) | `manager` | **kepemimpinan** |

**Pemisahan tugas melekat**: satu pengguna hanya punya satu peran, jadi orang yang
mengonfirmasi pemenuhan **tidak mungkin** orang yang menutup. Dijaga eksplisit juga di fungsi.

## 3. Transisi status

```
SO layak  →  konfirmasi pemenuhan (PPIC)  →  konfirmasi akhir (Manager/GM)
          →  Decision Record  →  sales_orders.status = 'completed'
```

**Yang ditambahkan ke `status_transition_rules`: satu baris — `confirmed → completed`.**
Nol status baru. Alasannya ada di audit AS-IS: `in_production` **tidak pernah ditulis kode mana
pun**, sehingga tanpa baris ini jalur penyelesaian tidak bisa dilalui.

**DILARANG:** tombol di layar yang langsung mengubah status tanpa fungsi berwewenang.

## 4. Decision Record

Memakai mekanisme **kanonik yang sudah ada** — `status_transition_log` + kategori alasan +
`pasang_konteks_keputusan()`. **Nol tabel log baru.**

Yang bisa direkonstruksi: siapa · apa · kapan · kenapa · atas apa · keadaan sebelum · keadaan
sesudah · bukti (cuplikan pemenuhan saat konfirmasi).

Kategori alasan baru untuk `sales_orders`: aksi `fulfillment_confirm` (departemen `ppic`) dan
`completion` (departemen `manager`).

## 5. Sumber kebenaran

| Entitas | Pemilik | Sumber kebenaran | Konsumen |
|---|---|---|---|
| Produksi | Manufacturing | `work_orders.status` | Sales (**membaca**) |
| Pengiriman | Logistik | `shipments` → `sales_order_lines.qty_shipped` | Sales (**membaca**) |
| Pemenuhan | **turunan**, bukan tabel | dihitung dari dua baris di atas | Sales |
| Komitmen komersial | Sales | `sales_orders` + `sales_order_lines` | semua |
| Konfirmasi pemenuhan | Sales (PJL-03) | `sales_order_completion_approvals` | Sales |
| Pembayaran | **Finance — belum ada** | — | — |

**Nol sumber kebenaran duplikat.** Yang ditambahkan hanyalah **keputusan manusia**, bukan
salinan fakta domain lain.

## 6. Perilaku layar

Panel detail Sales Order menampilkan **kenapa**, bukan hanya bisa/tidak bisa:

```
Produksi   : 2 / 2 Work Order selesai
Pengiriman : 9.800 / 10.000
Pemenuhan  : BELUM LENGKAP
Penutupan  : belum bisa — masih ada 200 belum dikirim
```

Bila tidak layak, penyebabnya disebut **satu per satu**, bukan "tidak bisa diselesaikan".
Modal konfirmasi transaksional dengan kategori alasan; hasil lewat notifikasi.

## 7. Keamanan

Wajib login · terisolasi tenant · ber-`company_id` · wewenang diperiksa · **gagal tertutup**.
`anon` dan `PUBLIC` dicabut dari kedua fungsi. Ditolak: anonim, perusahaan lain, peran salah,
pelaku tak berwenang. **Kasus berhasil yang berwenang wajib ikut diuji.**

## 8. Batas transaksi & data basi

- `select ... for update` pada baris Sales Order → dua penutupan bersamaan **berurutan**, yang
  kedua melihat status yang sudah berubah.
- Konfirmasi pemenuhan menyimpan **cuplikan pemenuhan** (`qty` per baris + status Work Order).
- Saat penutupan, cuplikan itu **dihitung ulang dan dibandingkan**. Berbeda → **ditolak**,
  dengan pesan bahwa keadaannya berubah dan konfirmasi perlu diulang.
- Seluruhnya dalam satu fungsi = satu transaksi.

## 9. Kontrak lintas domain (K-09)

**Pemenuhan (Manufacturing + Logistik) → penutupan Sales Order.**

Arah **satu**: Sales **membaca** fakta produksi & pengiriman, dan **tidak pernah menulis**
balik. Yang lahir di Sales hanyalah **keputusan penutupan** beserta jejaknya.

Kontrak ini **tidak menyentuh** K-06/K-07/K-08 (Finance) — penyelesaian order **tidak
bergantung pembayaran**.
