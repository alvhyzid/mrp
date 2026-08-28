# KELAS VALIDASI TINGKAT FIELD — HANDOFF (`DS-25`)

Audit: `FABRIX_FIELD_VALIDATION_CLASS_AUDIT.md` · Standar: `FABRIX_FIELD_VALIDATION_CLASS_STANDARD.md`

---

## TEMUAN YANG PALING MENGUBAH RENCANA

> **80% pesan validasi yang ada sekarang SUDAH BENAR di tingkat formulir** — 455 dari 569.
> Kelas ini bukan *"semuanya salah tempat"*.

Kalau seluruh `InlineNotification` diganti jadi `invalidText`, layarnya akan **lebih buruk**:
menandai sebuah isian untuk galat yang tidak bisa diperbaiki dari isian itu membuat orang
mengubah hal yang benar. Yang salah tempat: **114 galat di 59 modul** — pesan yang sudah
menyebut satu isian tetapi tampil sebagai kalimat di dasar formulir.

## AKAR — satu, dan bukan "halaman lupa"

**Jawaban server tidak pernah menyebutkan field-nya sebagai data, hanya kalimat.** Halaman
karena itu **tidak punya cara** menandai kontrol yang benar — bukan tidak mau, tidak bisa.

Jalan keluarnya: `field` (dan `line` untuk baris berulang) dikirim **sebagai data**.
Mencocokkan pesan dengan teks ditolak sejak awal — itu kelas "kebetulan benar" yang sudah
empat kali menggigit proyek ini.

## STANDAR YANG DITETAPKAN

Satu pertanyaan menentukan segalanya:

> **Bisakah pengguna memperbaiki galat ini dengan mengubah SATU isian yang terlihat?**
> Bisa → field. Tidak → formulir.

Empat golongan: **A** field · **B** formulir · **C** bisnis/keadaan · **D** berhasil.
Golongan B dan C dicatat **PASS**, bukan utang.

**Yang sengaja TIDAK ditetapkan**: field mana yang wajib diisi secara bisnis, dan kalimat
penolakan apa yang dipakai. Register kanonik sudah menempatkan itu pada Anda (F-03: *"the
mechanism is not domain knowledge"*).

## PILOT — modal "Buat PO" di `/purchasing`

Dipilih karena satu-satunya formulir yang memuat **keempat golongan sekaligus** plus baris
berulang. Tiga berkas berubah; **nol kalimat pesan diubah**, nol aturan bisnis, nol `required`
baru, nol halaman lain.

Yang sekarang terjadi di layar:

- Kirim kosong → **dua** isian ditandai sekaligus, bukan satu kalimat gabungan di dasar modal.
- Baris ke-3 salah → **baris ke-3** yang ditandai, bukan *"salah satu baris"*.
- Baris terisi separuh → ditandai. **Sebelumnya baris itu dibuang diam-diam** dan PO terkirim tanpanya, tanpa ada yang memberi tahu.
- Galat izin/sesi → tetap di notifikasi formulir, **dan itu memang benar**.

## BUKTI

- **Uji**: 8, MERAH lebih dulu (5 gagal) lalu HIJAU; tiap penjaga dibuktikan menggigit. Tiga uji hijau sejak awal menjaga yang **sudah benar**.
- **Peramban**: empat kasus (kosong · separuh · server-dengan-field · server-tanpa-field) plus **enam lebar** — pesan tampil di keenamnya, nol terpotong, nol gulir menyamping, nol elemen melewati kedua tepi.
- **Aksesibilitas**: pesan tertaut ke kontrolnya lewat atribut yang **Carbon sendiri** pancarkan; nol `aria-*` ditulis tangan, dan penjaga melarangnya.
- **Data**: nol mutasi, nol fixture, basis data nyata tidak disentuh saat pengujian.

## DUA KOREKSI YANG SAYA BUAT TERHADAP DIRI SENDIRI

1. **Standar versi pertama saya salah soal Carbon**: ia menulis `NumberInput` memakai `aria-errormessage` bersama `TextInput`. Keliru — hanya `TextInput`/`PasswordInput`. Ada **tiga** mekanisme, bukan dua. Ditangkap dengan **menjalankan**, bukan membaca.
2. **Dua penjaga saya sendiri menguji detail implementasi**, bukan perilaku (menuntut `setPoFieldError(null)` dan mencocokkan syarat render sebagai teks persis). Dilonggarkan sebelum dipakai.

## LANGKAH BERIKUTNYA — SATU REKOMENDASI

**Tutup `T-V4` lebih dulu: penjaga yang memastikan nama `field` yang dikirim server benar-benar
ada di formulirnya.** Alasannya urutan, bukan kerapian — pemetaan itu kesepakatan **nama
string**, dan selama belum dijaga, modul kedua akan menyalinnya dengan nama yang salah ketik
dan galatnya menghilang **tanpa satu pun test merah**. Itu bentuk kegagalan yang paling sulit
ditemukan, dan biayanya paling kecil **sekarang**, saat pemakainya baru satu.

Sesudah itu baru modul kedua. Kandidat terbesar `customerDeliveryAddresses.ts` (9 golongan A).

**JANGAN** menyapu 58 modul sekaligus: penggolongan per pesan wajib dilakukan dulu, dan
sebagian modul (mis. `deleteOrArchiveCustomer`) dipicu **tombol**, bukan formulir — galatnya
mungkin memang benar di tingkat formulir.

## STOP

Sesuai brief: berhenti setelah pilot dan analisis kelas. Tidak melanjutkan ke halaman lain,
tidak ke `/production`. Menunggu handoff.
