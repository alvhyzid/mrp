# PJL-03 ARCHITECTURE IMPLEMENTATION REPORT

**Tanggal:** 29 Agustus 2026 · **Lingkup:** penyelesaian Sales Order · **FIN-02: tidak disentuh**

## 1. AS-IS

Rincian di `PJL-03_ASIS_COMPLETION_AUDIT.md`. Tiga temuan yang menentukan bentuk pekerjaan ini:

1. Transisi **`confirmed → completed` tidak ada** di `status_transition_rules`, dan
   **`in_production` tidak pernah ditulis kode mana pun** — jalur penutupan tidak bisa dilalui.
2. **Nol tempat** merekam konfirmasi PPIC (konfirmasi tidak mengubah status, jadi tidak punya
   baris di log transisi).
3. **Nol pemeriksa kelayakan** di sisi server, dan **nol keterangan** di layar.

## 2. TO-BE

Rincian di `PJL-03_TOBE.md`. Bentuk akhirnya: kelayakan dihitung **satu kali di server**,
dipakai layar maupun kedua fungsi; dua konfirmasi dua departemen; jejak lewat mekanisme kanonik.

## 3. Aturan bisnis

**Penyelesaian = PEMENUHAN, bukan pembayaran.** Order boleh **COMPLETED** meski pelanggan
menunggak. Syarat: seluruh komitmen **diproduksi**, seluruhnya **dikirim**, **PPIC** konfirmasi,
**Manager/GM** konfirmasi akhir. **Nol toleransi kurang-kirim.**

## 4. Mesin status

Ditambahkan **satu jalur**: `confirmed → completed`. **Nol status baru** — AD-03 tidak tersentuh
dan tetap terbuka. Jalur `in_production → completed` yang sudah ada dibiarkan apa adanya.

```
layak  →  konfirmasi PPIC  →  konfirmasi Manager/GM  →  Decision Record  →  completed
```

## 5. Kepemilikan

| Fakta | Pemilik | Peran Sales |
|---|---|---|
| Produksi | Manufacturing | **membaca** |
| Pengiriman | Logistik | **membaca** |
| Konfirmasi & penutupan | Sales (PJL-03) | menulis **keputusan**, bukan fakta |

**Nol fakta domain lain disalin ke Sales.**

## 6. Sumber kebenaran

Kelayakan **tidak disimpan**; ia diturunkan setiap kali dibaca oleh
`kelayakan_penyelesaian_so()`. Yang disimpan hanya **keputusan manusia**
(`sales_order_completion_approvals`) dan **status akhir** Sales Order.

## 7. Decision Record

Memakai mekanisme kanonik: `pasang_konteks_keputusan()` → trigger `enforce_status_transition`
menulis `status_transition_log` dengan pelaku, peran, departemen, kategori alasan, catatan.
**Nol tabel log baru.** Kategori alasan baru: `fulfillment_confirm` (ppic) dan `completion`
(manager).

**Terbukti**, bukan dinyatakan: test (16) membaca barisnya dan memeriksa kelima kolomnya.

## 8. Keamanan

| Uji | Hasil |
|---|---|
| Anonim memanggil penutupan | **DITOLAK `42501`** — lapisan izin basis data, bukan aturan bisnis |
| Gudang mengonfirmasi | DITOLAK — "Hanya PPIC" |
| Sales mengonfirmasi | DITOLAK — "Hanya PPIC" |
| PPIC perusahaan lain | DITOLAK — "tidak ditemukan di perusahaan Anda" |
| PPIC menutup order | DITOLAK — "Hanya Manager atau General Manager" |
| Pimpinan berwenang menutup | **BERHASIL** |

`anon` dan `PUBLIC` dicabut dari keempat fungsi baru. **Nol peran baru, nol izin baru.**

## 9. UI/UX

Panel **Penutupan order** di detail Sales Order, **terpisah** dari blok Pembatalan (aturan modal
nomor 9: aksi merusak tidak berdempetan dengan aksi biasa).

Menjelaskan **kenapa**, bukan sekadar bisa/tidak: Produksi *x/y* Work Order · Pengiriman
*x/y* · Pemenuhan *Lengkap/Belum lengkap*, dan bila belum layak — **daftar sebabnya satu per
satu**, mis. *"Masih ada 200 dari 10.000 yang belum dikirim."*

Modal transaksional Carbon dengan kategori alasan wajib; **bukan** varian berbahaya —
menutup order bukan tindakan merusak. Nol angka px dan nol warna heksadesimal di SCSS-nya.

## 10. Test

`tests/penyelesaian_sales_order.test.ts` — **23 pemeriksaan, seluruhnya lulus**.

**Regresi penuh sesudahnya: 91 berkas · 690 lulus · 7 dilewati · 0 gagal** (1.655 detik), dan
jumlahnya dicocokkan dengan kode sumber — **697 = 697**, jadi nol pemeriksaan diam-diam tidak
ikut terkumpul.

**Uji mutasi: empat penjaga dirusak sengaja, keempatnya MENGGIGIT, lalu dikembalikan.**

| Penjaga dirusak | Akibat |
|---|---|
| Wewenang pimpinan | **1 gagal** |
| Nol toleransi kurang-kirim | **2 gagal** |
| Penjaga data basi | **1 gagal** |
| Pemisahan tugas | **2 gagal** |
| *(dipulihkan)* | **22 lulus** (sebelum pemeriksaan ke-23 ditambahkan) |

Penjaga data basi punya testnya **sendiri** (22), yang menjaga kelayakan tetap `true` sambil
mengubah cuplikan — tanpa itu, penjaganya bisa dicabut tanpa satu test pun gagal.

## 11. Bukti peramban

Enam lebar (**360 · 672 · 768 · 1280 · 1440 · 1920**), tiga arah tepi (gulir menyamping,
tepi kanan, tepi kiri), keadaan layak dan belum layak, modal terbuka, ESC menutup, pesan galat
saat kategori kosong. Rinciannya di `scratchpad/e2e/pjl03-verif.log`.

Seluruh permintaan **non-GET diblokir fixture** — **nol tulisan** ke basis data selama
verifikasi tampilan.

## 12. Keamanan data

Test memakai perusahaan uji berpola `Pjl03*TestCorp` yang dibuat dan **dihapus sendiri**.
Diperiksa sesudah regresi penuh: **nol** company berpola `Pjl03*`, **nol** pengguna `pjl03.*`,
di **kedua** proyek (nyata maupun uji).
**Nol** data nyata disentuh: nol Sales Order nyata, nol PO klien, nol produksi, nol pengiriman.
Migrasi hanya menambah **struktur** dan **master semua tenant** (satu aturan transisi, lima
kategori alasan) — **nol baris berisi nama, alamat, atau angka milik satu perusahaan**.

## 13. Risiko yang tersisa

1. **SO tanpa Work Order tidak bisa ditutup** — sengaja gagal tertutup. Bila kelak ada penjualan
   dari stok lama tanpa Work Order, order itu **akan mentok**. Dicatat sebagai **PJL-16**.
2. **Kelayakan dihitung ulang tiap pembacaan daftar** — satu RPC untuk seluruh SO perusahaan.
   Pada ratusan SO ini perlu diukur ulang; hari ini nol SO di tenant nyata.
3. **Sisa komitmen** yang tidak akan pernah dipenuhi hanya bisa diselesaikan lewat pembatalan
   yang sah. Itu memang aturannya, tetapi berarti order menggantung sampai ada yang memutuskan.

## 14. Keputusan yang masih terbuka

**AD-03** (kosakata status) · **FIN-02** & **BD-10** (pembayaran — **tidak** menghalangi
penutupan) · **DEC-S13** (override) · **PJL-16** (SO tanpa Work Order).

## 15. Pekerjaan berikutnya yang disarankan

1. **PJL-16** — keputusan pemilik produk soal SO tanpa Work Order.
2. **FIN-02** — keputusan Architecture Guardian.
3. **PJL-13** — layar termin pembayaran.
4. **QA-04** — satu pesanan penuh dijalankan di tenant uji, lalu uji jalur emas.
