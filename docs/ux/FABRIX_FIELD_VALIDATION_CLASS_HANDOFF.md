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

## T-V4 — PENJAGA KONTRAK PEMETAAN FIELD (**SELESAI**)

**Yang dicegah**, dan ini bentuk kegagalan paling sulit ditemukan di kelas ini:

> nama field salah ketik → nol kontrol cocok → notifikasi formulir **ikut digerbang mati** →
> **pengguna tidak melihat apa pun** → test tetap hijau.

Diverifikasi langsung: sebelum T-V4, jawaban `{ error, field: 'quantitty' }` menghasilkan
**nol pesan di layar**. Sesudahnya, kalimat aslinya muncul sebagai notifikasi formulir.

**Kontraknya dua lapis** — karena satu lapis tidak cukup:

| Lapis | Isi |
|---|---|
| Kompilasi | enam nama field sebagai satu sumber → tipe `FieldPo`, dipakai validator **dan** pembangun jawaban |
| Runtime | satu pintu `petakanGalatServerPo`; halaman **dilarang** membaca `body.field` sendiri |

`line` = **indeks berbasis nol**. Tiga keadaan naik ke tingkat formulir dengan **kalimat
aslinya**: nama tak dikenal · field baris tanpa `line` sah · `line` di luar jangkauan.

**Lubang yang ditemukan lewat menjalankan, bukan membaca**: mutasi nama salah ketik di
`createPurchaseOrder` **tidak berbunyi sama sekali** di typecheck, karena `ApiResult.body`
bertipe `Record<string, unknown>`. Kalau tidak diuji, ia akan tercatat sebagai "dijaga saat
kompilasi" padahal separuhnya tidak. Ditutup dengan pembangun bertipe.

**Satu cacat lain ikut ditemukan dan diperbaiki**: kedua dropdown tingkat atas **tidak
mencabut tandanya** saat diperbaiki — galat menyala di isian yang sudah benar. Keduanya kini
lewat satu pintu.

## T-V5 — KONTRAK BERSAMA, PILOT #2 (**SELESAI**)

**Kandidat yang Anda tunjuk tidak bisa dipakai, dan itu temuan — bukan hambatan yang saya
akali.** `customerDeliveryAddresses.ts` punya **nol pemanggil UI**: diverifikasi lewat
pencarian di seluruh berkas TSX, lewat sensus route yatim DS-25, dan lewat komentar modul itu
sendiri. Tanpa layar, seluruh bukti peramban dan aksesibilitas — yaitu inti misi batch ini —
tidak bisa dijalankan. `recordOpeningBalance.ts` bernasib sama.

**Pengganti dipilih dengan pengukuran: `recordStockAdjustment` di `/warehouse`** — dan justru
karena ia **berbeda** dari pilot pertama: bukan modal, **nol baris berulang**, dan punya
**field bersyarat**. Kalau satu kontrak melayani dua bentuk berbeda tanpa cabang khusus, ia
terbukti sebagai pola.

**Hasilnya: terbukti.** `src/lib/kontrakGalatField.ts` melayani keduanya; modul hanya
menyumbang daftar nama. **Pilot #1 tetap 17/17 hijau tanpa satu uji pun disunting** meski
mekanismenya dipindahkan ke pabrik bersama.

**Golongan A modul ini bertambah 4 → 6**, dan itu diukur bukan diduga: daftar lot yang
ditawarkan berisi status `available` **dan** `expired`, jadi pengguna memang bisa memilih lot
yang akan ditolak — dan bisa memperbaikinya dengan memilih lot lain.

## LANGKAH BERIKUTNYA — SATU REKOMENDASI

**Polanya sekarang terbukti untuk dua bentuk formulir, dan rollout berikutnya boleh memakai
kontrak yang sama.** Yang saya sarankan BUKAN modul ketiga, melainkan **memisahkan dua kelas
pekerjaan yang selama ini tercampur di daftar 58 modul**:

1. **Modul yang punya layar** — ikut pola ini, satu per satu, dengan penggolongan A/B/C per
   pesan. Kandidat terukur berikutnya: `recordWorkOrderStepProgress` (4 golongan A, dipakai
   dua halaman), lalu `createProductionBatch` (3, tiga halaman).
2. **Modul yang TIDAK punya layar sama sekali** — `customerDeliveryAddresses` dan
   `recordOpeningBalance` sudah terbukti begitu, dan mungkin ada lagi. Untuk modul ini,
   memasang kontrak field **tidak menghasilkan apa pun yang bisa dilihat pengguna**; yang
   dibutuhkan lebih dulu adalah layarnya.

**Sensus mana dari 59 modul yang benar-benar punya layar belum pernah dilakukan** — dan tanpa
itu, rollout akan mengerjakan modul yang hasilnya tidak bisa diverifikasi siapa pun. Itu
langkah berikutnya yang paling murah dan paling menentukan.

**JANGAN** menyapu 58 modul sekaligus: penggolongan per pesan wajib dilakukan dulu, dan
sebagian modul (mis. `deleteOrArchiveCustomer`) dipicu **tombol**, bukan formulir — galatnya
mungkin memang benar di tingkat formulir.

## STOP

Sesuai brief: berhenti setelah pilot dan analisis kelas. Tidak melanjutkan ke halaman lain,
tidak ke `/production`. Menunggu handoff.
