# STANDAR VALIDASI FABRIX — DI MANA SEBUAH GALAT MUNCUL

> **Status: BERLAKU untuk pekerjaan baru** sejak `DS-25`. Layar lama dibereskan bertahap
> lewat matriks rollout, bukan sekaligus.
>
> **Yang TIDAK ditetapkan dokumen ini**: field mana yang **wajib diisi secara bisnis**, dan
> kalimat penolakan apa yang seharusnya dipakai. Itu **keputusan pemilik produk** —
> ditegaskan register kanonik pada F-03: *"Which fields are business-required, and what each
> rejection message should say, is domain knowledge. **The mechanism is not.**"*
> Dokumen ini hanya menetapkan **mekanismenya**.

---

## 1. PERTANYAAN YANG MENENTUKAN SEGALANYA

> **Bisakah pengguna memperbaiki galat ini dengan mengubah SATU isian yang terlihat di layar?**

- **Bisa** → galat itu milik **field** tersebut.
- **Tidak bisa** → galat itu milik **formulir**.

Bukan "berapa panjang pesannya", bukan "apakah dari server atau dari peramban". Yang
menentukan hanya: **apakah ada satu isian yang bisa ditunjuk.**

**Tujuannya bukan mengurangi jumlah `InlineNotification`.** Sebagian besar
`InlineNotification` yang ada hari ini **benar** dan harus tetap. Tujuannya: galat muncul di
tempat yang paling membantu orang memperbaikinya.

## 2. EMPAT GOLONGAN

| Golongan | Contoh nyata dari repo ini | Tempatnya |
|---|---|---|
| **A — Galat field** | *"Supplier wajib dipilih."* · *"Jumlah pesan harus angka positif."* | `invalid` + `invalidText` **pada field itu** |
| **B — Galat formulir** | *"Minimal 1 baris item wajib diisi."* · *"Sesi Anda sudah tidak valid."* | `InlineNotification kind="error"` di dalam formulir |
| **C — Galat bisnis / keadaan** | *"PO ini sudah diterima penuh atau dibatalkan."* · *"Role Anda tidak punya izin…"* | `InlineNotification` pada konteks yang sesuai |
| **D — Berhasil** | *"PO berhasil dibuat."* | **Notifikasi**, bukan modal (aturan unggah butir 6–7) |

**Golongan C sengaja dipisah dari B.** Keduanya tampil sama, tetapi artinya berbeda: B
berarti *"perbaiki isian Anda"*, C berarti *"keadaan sistem menolak, dan mengubah isian
tidak akan menolong"*. Menyatukannya membuat orang mencari kesalahan yang tidak ada.

## 3. GOLONGAN A TIDAK BOLEH DITEBAK DARI TEKS PESAN

**Server WAJIB menyebutkan field-nya sebagai DATA, bukan menitipkannya di dalam kalimat.**

```ts
// BENAR — mekanismenya eksplisit
return { status: 400, body: { error: 'Supplier wajib dipilih.', field: 'supplier_id' } };

// SALAH — halaman harus menebak dari kalimat
return { status: 400, body: { error: 'Supplier wajib dipilih.' } };
```

**Kenapa ini aturan keras.** Memetakan pesan ke field dengan mencocokkan teks adalah kelas
cacat **"kebetulan benar"** yang sudah empat kali menggigit proyek ini: ia bekerja sampai
seseorang memperbaiki satu kalimat, lalu galatnya diam-diam pindah ke tempat yang salah —
dan tidak ada yang gagal, tidak ada yang merah.

**Bentuk jawabannya:**

| Kunci | Isi | Kapan |
|---|---|---|
| `error` | kalimat untuk manusia | selalu |
| `field` | nama field yang persis dipakai di formulir | hanya untuk golongan **A** |
| `line` | indeks baris, mulai 0 | hanya bila field itu ada di baris berulang |

**Ketiadaan `field` bermakna**: *"ini bukan golongan A"* — dan halaman menampilkannya di
tingkat formulir. Jadi jalur lamanya tetap benar tanpa perubahan apa pun; penambahan `field`
bersifat **menambah**, tidak merusak pemanggil yang belum tahu.

## 4. MEKANISME CARBON — DIPAKAI APA ADANYA, JANGAN DIBUAT SENDIRI

Diukur dari paket terpasang `@carbon/react` 1.114.0 **dan dibuktikan dari DOM yang
benar-benar dirender**. Ada **TIGA** mekanisme berbeda, bukan dua:

| Keluarga kontrol | `aria-invalid` | Tautan ke pesannya |
|---|---|---|
| `TextInput` · `PasswordInput` | **`true`** | **`aria-errormessage`** |
| `NumberInput` | **`true`** | **`aria-describedby`** |
| `Dropdown` · `ComboBox` | **TIDAK DIPASANG** | `aria-describedby` |

> **KOREKSI, dicatat karena catatannya sendiri sempat salah.** Versi pertama halaman ini
> menyatakan `NumberInput` memakai `aria-errormessage` dan menggabungkannya dengan
> `TextInput`. Itu **keliru**: hanya `TextInput`/`PasswordInput` yang lewat
> `getTextInputProps`; `NumberInput` menyusun `aria-describedby`-nya sendiri
> (`NumberInput.js:275,378-379`). Kekeliruannya lahir dari **membaca satu berkas lalu
> menggeneralisasi**, dan yang menangkapnya adalah **menjalankan** — membaca atribut dari DOM
> modal yang sungguhan.

**Yang harus dilakukan halaman hanyalah mengoper `invalid` dan `invalidText`.** Jangan
menulis `aria-*` sendiri untuk keluarga yang sudah ditangani Carbon — itu melahirkan jalur
kedua yang menyimpang begitu Carbon berubah.

**BATAS YANG DISEBUT TERBUKA**: `Dropdown` dan `ComboBox` **tidak pernah** memancarkan
`aria-invalid` (nol kemunculan di `Dropdown.js`). Pesannya **tetap dibacakan** lewat
`aria-describedby` — jadi penggunanya mendengar apa yang salah — tetapi kontrolnya tidak
ditandai *invalid* secara programatis. Ini **keterbatasan Carbon**, bukan pilihan kita, dan
menambalnya menyentuh setiap `Dropdown` di aplikasi. Dicatat sebagai temuan tertunda **T-V1**,
bukan ditambal di satu halaman — tambalan sebagian justru melahirkan dua perilaku.

Ketujuh kontrol yang dipakai repo ini (`TextInput`, `NumberInput`, `TextArea`, `Select`,
`Dropdown`, `ComboBox`, `DatePickerInput`) seluruhnya menerima `invalid` + `invalidText`.
**Tidak ada yang perlu dibungkus.**

## 4b. T-V4 — KONTRAK PEMETAAN FIELD DI BATAS SERVER → KLIEN

**`field` adalah nama yang menyeberangi batas jaringan. Batas harus punya penjaga.**

### Masalahnya

`string` lolos TypeScript, tetapi jawaban server adalah data **runtime**. Sebuah nama yang
salah ketik menghasilkan bentuk kegagalan paling sulit ditemukan di seluruh kelas ini:

> server mengirim galat → nol kontrol cocok → notifikasi formulir **ikut digerbang mati**
> karena "sudah ada galat field" → **pengguna tidak melihat apa pun** → test tetap hijau.

Galatnya bukan salah tempat. Galatnya **hilang**.

### Kontraknya — dua lapis, karena satu lapis tidak cukup

**Lapis 1, saat kompilasi.** Daftar nama sebagai satu sumber:

```ts
export const FIELD_PO       = ['supplier_id', 'production_plant_id', 'expected_date'] as const;
export const FIELD_PO_BARIS = ['item_id', 'qty_ordered', 'unit_price'] as const;
export type  FieldPo        = (typeof FIELD_PO)[number] | (typeof FIELD_PO_BARIS)[number];
```

Namanya **sama persis** dengan kunci state formulir dan kunci `FormLine` — itulah yang
membuat pemetaannya bisa dijamin, bukan sekadar diharapkan.

> **LAPIS KOMPILASI PUNYA LUBANG YANG HARUS DITUTUP SENGAJA, dan ini ditemukan lewat
> menjalankan mutasi — bukan lewat membaca.** Tipe hasil validator tidak berlaku di dalam
> `ApiResult.body`, yang bertipe `Record<string, unknown>`: menulis `field: 'supplier'`
> langsung di sana **lolos typecheck sepenuhnya**. Karena itu galat golongan A **wajib**
> disusun lewat pembangun bertipe (`galatFieldPo(error, field, line?)`), bukan objek mentah.

**Lapis 2, saat berjalan.** Satu pintu memetakan jawaban server:

```ts
petakanGalatServerPo(body, jumlahBaris): { jenis: 'field'; … } | { jenis: 'formulir'; pesan }
```

Halaman **tidak boleh** membaca `body.field` sendiri.

### Semantik `line`

**Indeks baris berbasis NOL**, mengacu ke urutan baris **saat jawaban diterima**. Ia hanya
bermakna untuk field di `FIELD_PO_BARIS`.

### Tiga keadaan yang NAIK ke tingkat formulir

Ketiganya berarti *"pemetaannya tidak bisa dipercaya"*, dan **menandai kontrol yang salah
lebih buruk daripada menampilkan kalimatnya apa adanya**:

1. `field` tidak ada di daftar — salah ketik, nama lama, atau modul lain.
2. Field baris **tanpa** `line` yang sah — barisnya tidak bisa ditebak.
3. `line` di luar jangkauan baris yang sedang tampil — termasuk setelah baris dihapus.

**Kalimat aslinya SELALU dipertahankan.** Galat tidak boleh hilang hanya karena pemetaannya
gagal, dan tidak ada pesan baru yang dikarang.

### Satu keadaan yang SENGAJA tidak dinaikkan

Field **non-baris** yang membawa `line`. Pemetaannya tidak gagal — `supplier_id` tidak
ambigu — dan yang tidak bermakna hanyalah `line`-nya. Menaikkannya justru **memindahkan galat
yang sebenarnya bisa ditunjuk**. Ditulis di sini supaya tidak dikira kelalaian.

### Menghapus tanda

Isian tingkat atas dan isian baris keduanya lewat **satu pintu** yang menyimpan nilai **dan**
mencabut tandanya. Menghapus sebuah baris membuang **seluruh** tanda, karena indeks baris
bergeser dan tanda yang tertinggal akan menunjuk baris yang salah.

## 4c. KONTRAK BERSAMA — SATU MEKANISME, BANYAK MODUL (T-V5)

**Mekanismenya hidup di `src/lib/kontrakGalatField.ts`. Modul hanya menyumbang DAFTAR NAMA.**

```ts
const kontrak = buatKontrakGalatField(FIELD_ATAS, FIELD_BARIS);
export const galatFieldX  = kontrak.galatField;   // server menyusun jawaban
export const petakanGalatX = kontrak.petakan;     // halaman memetakan jawaban
```

**Modul tanpa baris berulang mengirim daftar baris KOSONG** — dan tidak menulis perlakuan
khusus apa pun. Kontraklah yang menolak `line` mana pun. Itu ujinya: bila sebuah modul perlu
menambah cabang sendiri, kontraknya belum terbukti.

### Yang WAJIB bersama

Tipe hasil · pemeta runtime · pembangun jawaban bertipe · keempat aturan keputusan
(nama tak dikenal, field baris tanpa `line` sah, `line` di luar jangkauan, field non-baris
membawa `line`).

### Yang WAJIB tetap milik modul

Registri nama · kalimat pesan · penggolongan A/B/C · pengikatan ke kontrol · aturan pencabutan
bersyarat. Ketiganya yang terakhir bergantung pada **bentuk formulir**, dan memaksakannya jadi
satu hanya menambah cabang.

### Aturan tambahan yang lahir dari pilot kedua

**Registri WAJIB mencerminkan kontrol yang benar-benar ada di layar.** Nama yang ada di
registri tetapi tidak punya kontrol akan lolos pemeriksaan runtime lalu ditandai pada sesuatu
yang tidak ada — dan galatnya hilang persis seperti kalau namanya salah ketik. Ini kelas
tersendiri, dan dijaga oleh uji yang mencocokkan setiap nama registri dengan pengikatannya di
halaman.

**Field BERSYARAT wajib mencabut tandanya saat syaratnya berubah.** Contohnya catatan yang
hanya wajib untuk alasan tertentu: begitu alasannya diganti, kewajibannya lenyap dan tandanya
harus ikut lenyap — kalau tidak, ia menyala pada isian yang tidak bisa diperbaiki dengan cara
apa pun.

## 5. ATURAN TURUNAN

**5.1 Banyak field salah sekaligus.** Tandai **seluruhnya**, jangan berhenti di yang pertama.
Berhenti di yang pertama memaksa orang menyimpan berulang kali untuk menemukan sisanya.
*Batas yang jujur:* validator hari ini memang berhenti di yang pertama; mengubahnya adalah
pekerjaan tersendiri, dan sampai itu terjadi standarnya belum terpenuhi penuh.

**5.2 Baris berulang.** Galat pada baris ke-N ditandai **pada kontrol di baris ke-N**, bukan
sebagai kalimat *"salah satu baris tidak valid"*. Kalimat itu memindahkan pekerjaan mencari
ke pengguna.

**5.3 Galat hilang saat isiannya diperbaiki.** Begitu pengguna mengubah field yang ditandai,
tandanya dicabut — galat yang menetap setelah diperbaiki melatih orang mengabaikannya.

**5.4 Field bersyarat.** Field yang hilang dari layar **wajib** ikut menghapus galatnya.
Galat yatim tidak bisa diperbaiki siapa pun karena isiannya sudah tidak ada.

**5.5 Modal.** Berlaku sama persis. Galat formulir diletakkan **di dalam badan modal**, dekat
tombol simpan — bukan sebagai toast di luar, karena keputusannya masih berlangsung di modal.

**5.6 Berhasil pakai notifikasi, gagal boleh menetap.** Pesan berhasil hilang sendiri setelah
5 detik; pesan gagal **tidak pernah** hilang sendiri. (Aturan unggah butir 7 — alasannya
panduan Carbon: jangan memakai toast untuk hal yang harus diingat sambil bekerja.)

**5.7 Fokus.** Bila penyimpanan ditolak karena satu field, fokus **boleh** dipindahkan ke
field itu. **Belum diwajibkan** — dan sengaja: memindahkan fokus tanpa mengumumkan apa yang
terjadi bisa membingungkan pengguna pembaca layar. Diputuskan saat ada bukti pemakaian nyata.

## 6. YANG DILARANG

1. **Mengganti `InlineNotification` jadi `invalidText` hanya karena pencarian teks menemukannya.** Golongan ditentukan pertanyaan §1, bukan oleh komponen yang sedang dipakai.
2. **Menandai field `required` yang belum diputuskan pemilik produk.** `required` mengubah **apa yang sistem tolak untuk dicatat** — itu aturan bisnis.
3. **Mencocokkan pesan dengan teks** untuk menentukan field-nya (§3).
4. **Menulis mekanisme aksesibilitas sendiri** ketika Carbon sudah menyediakannya (§4).
5. **Mengubah kalimat pesan** sambil memindahkannya. Memindahkan dan menulis ulang sekaligus membuat tidak ada yang tahu mana yang memperbaiki apa.

## 7. BAGAIMANA SEBUAH LAYAR DINYATAKAN PATUH

1. Setiap pesan galat dari formulir itu digolongkan A/B/C/D, **dengan alasannya**.
2. Golongan A membawa `field` dari server, dan halaman menandai kontrolnya.
3. Golongan B dan C tetap di tingkat formulir — **dicatat sebagai PASS**, bukan sebagai utang.
4. Ada penjaga yang menguji **perilaku**, bukan jumlah `invalidText`.
5. Diukur di enam lebar; teks galat tidak terpotong dan tidak menutupi isian.
