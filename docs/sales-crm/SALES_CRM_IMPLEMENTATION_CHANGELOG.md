# SALES_CRM_IMPLEMENTATION_CHANGELOG

## WS-01 / WS-03 — PO klien: galat menempel di isian yang salah · 29 Agu 2026

**Golongan keputusan: SAFE LOCAL CORRECTION.** Aturannya sudah kanonik (`DS-25`), kontraknya
sudah ada dan terbukti di dua modul, dan **nol aturan bisnis diubah**. Tidak ada keputusan
baru yang diambil.

### Masalah

PO klien adalah formulir **terbesar** di permukaan Sales: 21 kontrol, **modal bertahap empat
langkah**, baris item berulang. Seluruh penolakan muncul sebagai **satu kalimat di dasar
modal** — dan pada modal bertahap, kalimat itu bisa berada di **langkah yang berbeda** dari
isian yang salah.

### Yang berubah — tiga berkas

| Berkas | Perubahan |
|---|---|
| `customerPurchaseOrderValidation.ts` | memakai `buatKontrakGalatField`; hasil membawa `field` + `line`; **kalimat pesan tidak diubah satu pun** |
| `createCustomerPurchaseOrder.ts` | meneruskan `field`/`line`; **mencari indeks baris** yang itemnya tidak sah; galat 409 nomor ganda kini menunjuk `po_number` |
| `CustomerPurchaseOrdersPage.tsx` | `poFieldError` sebagai daftar · 6 kontrol menerima `invalid`+`invalidText` · notifikasi digerbang · galat dicabut saat isian diubah / baris dihapus · **modal melompat ke langkah tempat isian itu berada** |

**Bonus koreksi**: `paymentTermsOptions` sebelumnya **disalin** di halaman dan di modul
validasi. Dua salinan untuk satu daftar — menambah pilihan di satu tempat membuat server dan
layar tidak sepakat, dan tidak ada yang berbunyi. Sekarang satu sumber.

### Cacat yang saya PERKENALKAN sendiri lalu perbaiki

Ditemukan lewat **menjalankan**, bukan membaca: jawaban 409 untuk `po_number` (langkah 0)
dikirim saat modal berada di langkah 3. Kontrolnya ditandai dengan benar — tetapi langkahnya
**sedang tersembunyi**, jadi layar tidak menampilkan apa pun, dan notifikasi formulir ikut
digerbang mati karena *"sudah ada galat field"*.

Kelas yang sama dengan field tak dikenal: galatnya bukan salah tempat, **galatnya hilang**.
Bedanya penyebabnya bukan nama yang salah melainkan **langkah** yang salah.

Diperbaiki dengan peta `LANGKAH_FIELD` + `setLangkah`, dan dikunci uji (k). Diverifikasi ulang
di peramban: modal **pindah dari langkah 3 ke langkah 0** dan pesannya muncul di `po-nomor`.

### Uji

`tests/validasi_field_po_klien.test.ts` — **11 penjaga**, MERAH lebih dulu (7 gagal), HIJAU
sesudah. **Enam mutasi dibuktikan menggigit**, satu di antaranya berbunyi di **typecheck**
(`TS2345` saat nama field salah ketik di server).

> **Satu penjaga saya sendiri terlalu longgar dan diperketat**: uji (h) semula hanya mencari
> `galatPoKlien('x')`, sehingga mencabut `invalidText` sambil membiarkan `invalid` tetap
> **hijau** — padahal kontrolnya menyala merah **tanpa menjelaskan apa yang salah**. Kini
> kedua properti wajib ada.

### Bukti peramban

Enam lebar (360–1920), non-GET diblokir, **nol baris tertulis**:

| Kasus | Hasil |
|---|---|
| Server menolak baris (`qty_ordered`, line 0) | ditandai di `po-qty-0`, `aria-invalid="true"` + `aria-errormessage` |
| Server menolak isian tingkat atas (`po_number`, 409) | **modal pindah ke langkah 0**, pesan di `po-nomor` |
| Field tak dikenal (`po_numberr`) | **naik ke notifikasi formulir dengan kalimat aslinya** |
| Galat izin (403) | notifikasi formulir, nol tanda field |
| Enam lebar | pesan tampil di keenamnya, **nol terpotong**, kaki modal terlihat, nol gulir mendatar di modal |

### UX FINDING — dicatat, TIDAK diperbaiki

**Problem**: di **360px**, tombol **"Batal"** di kaki modal bertahap terpotong tepi kiri —
terukur `kiri: −63, kanan: 50`.
**Current**: tiga tombol berjajar di `ModalFooter` Carbon tanpa pembungkusan di layar sempit.
**Expected**: seluruh aksi terjangkau di 360px (aturan responsif proyek).
**Governance**: `FooterBertahap` adalah **komponen bersama**, dipakai **4 halaman**
(BOM, PO klien, Master Item, HR). §32 mewajibkan **audit konsumen lebih dulu**, bukan
perbaikan lokal.
**Impact**: pengguna di HP tidak bisa menekan "Batal" di keempat formulir bertahap.
**Fix**: belum dilakukan — butuh audit konsumen + penjaga.
**Regression**: menyentuh 4 halaman sekaligus.
