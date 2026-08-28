# KELAS VALIDASI TINGKAT FIELD — AUDIT & PILOT (`DS-25`)

Standar yang lahir dari audit ini: `FABRIX_FIELD_VALIDATION_CLASS_STANDARD.md`
Handoff: `FABRIX_FIELD_VALIDATION_CLASS_HANDOFF.md`

---

## 1. BASELINE

| | |
|---|---|
| HEAD awal | `891e3cd` |
| Pohon kerja | bersih, kecuali `docs/00-GOVERNANCE/` (untracked, sudah ada sebelumnya) |
| Uji sebelum | 77 berkas · 499 lulus · 7 dilewati |
| Lint sebelum | 28 (16 error, 12 warning) |
| Typecheck | bersih |

## 2. EVIDENCE — DAN ANGKA YANG DIREKONSILIASI

| Yang diukur | Hasil |
|---|---|
| Kontrol form (9 jenis, sama dengan sapuan sebelumnya) | **237** di **26** halaman |
| Kontrol form (11 jenis, + `PasswordInput`/`Checkbox`/`RadioButton`) | **247** di **28** halaman |
| `invalidText` sebelum batch ini | **5** |
| `InlineNotification` di halaman | **110** |
| Pesan validasi dari server (4xx) | **368** kemunculan |
| Pesan validasi sisi klien | **68** kemunculan |
| Pesan **unik** seluruhnya | **225** |

Angka **237** dipertahankan sebagai angka resmi supaya sebanding dengan laporan sebelumnya;
**247** disebut karena daftar jenis kontrolnya berbeda, bukan karena ada yang berubah.

## 3. FALSE POSITIVE — DAN INI TEMUAN TERPENTINGNYA

> **455 dari 569 pesan validasi server (80%) MEMANG SEHARUSNYA di tingkat formulir.**
> Kelas ini bukan *"semuanya salah tempat"*.

Digolongkan dengan pertanyaan §1 standar — *"bisakah pengguna memperbaikinya dengan mengubah
satu isian yang terlihat?"*:

| Golongan | Jumlah | Contoh | Vonis |
|---|---|---|---|
| Izin / peran | 5 unik | *"Role Anda tidak punya izin membuat PO ke supplier."* | **PASS** — form-level benar |
| Sesi / login | 7 unik | *"Sesi Anda sudah tidak valid."* | **PASS** |
| Entitas tidak ditemukan | 13 unik | *"Work Order tidak ditemukan."* | **PASS** |
| Keadaan bisnis | 23 unik | *"PO ini sudah diterima penuh atau dibatalkan."* | **PASS** |
| Penjaga parameter rute | belasan | *"ID BOM tidak valid."* | **PASS** — tidak pernah dilihat pengguna lewat formulir |

**Menggantinya jadi `invalidText` akan MEMPERBURUK layar**: menandai sebuah isian untuk galat
yang tidak bisa diperbaiki dari isian itu membuat orang mengubah hal yang benar.

## 4. CACAT SEBENARNYA

**114 galat golongan A di 59 modul server** — pesan yang **sudah menyebut satu isian**, tetapi
tampil sebagai satu kalimat di tingkat formulir.

Metodenya disebut supaya angkanya tidak dikira presisi: penggolongan di atas memakai
**penyaring kata** (*"wajib dipilih"*, *"harus angka"*, *"tidak boleh negatif"*, …) dikurangi
kata yang menandai golongan B/C. Itu **batas atas**, bukan hitungan final — penggolongan yang
mengikat harus dilakukan per pesan dengan pertanyaan §1, dan itulah isi matriks rollout §9.

## 5. ROOT CAUSE

**Satu akar, dan bukan "halaman lupa memakai `invalidText`".**

> **Jawaban server tidak pernah menyebutkan FIELD-nya sebagai data.** Ia hanya mengirim
> kalimat. Halaman karena itu **tidak punya cara** menandai kontrol yang benar — bukan tidak
> mau, tidak bisa.

Akibat turunannya, dan inilah yang membuatnya kelas dan bukan kumpulan cacat lepas:

- **RC-1** — validator berhenti di galat pertama, jadi isian salah kedua baru ketahuan setelah simpan berikutnya.
- **RC-2** — galat pada baris berulang kehilangan nomor barisnya (*"salah satu baris"*), padahal validatornya tahu persis indeksnya; loop-nya membuangnya.
- **RC-3** — baris yang terisi separuh **dibuang diam-diam** oleh penyaring sebelum dikirim: pengguna mengisi item lalu lupa jumlahnya, barisnya hilang dari PO, dan tidak ada yang memberi tahu.
- **RC-4** — pemeriksaan sisi klien menggabungkan dua isian jadi satu kalimat (*"Supplier dan lokasi pabrik wajib dipilih."*).

Satu-satunya jalan keluar yang tidak melahirkan kelas cacat baru: **field dikirim sebagai
data**. Memetakan pesan ke field dengan mencocokkan teks adalah kelas **"kebetulan benar"**
yang sudah empat kali menggigit proyek ini — ia bekerja sampai seseorang memperbaiki satu
kalimat, lalu galatnya pindah diam-diam ke kontrol yang salah.

## 6. CARBON CROSS-CHECK

Diukur dari paket terpasang **dan** dari DOM yang benar-benar dirender. Ketujuh kontrol yang
dipakai repo ini menerima `invalid` + `invalidText` — **tidak ada yang perlu dibungkus**.

**TIGA mekanisme ARIA, bukan satu:**

| Kontrol | `aria-invalid` | Tautan pesan |
|---|---|---|
| `TextInput` · `PasswordInput` | `true` | `aria-errormessage` |
| `NumberInput` | `true` | `aria-describedby` |
| `Dropdown` · `ComboBox` | **tidak dipasang** | `aria-describedby` |

> **Koreksi terhadap dokumen standar versi pertama saya sendiri**: ia menyatakan `NumberInput`
> memakai `aria-errormessage` bersama `TextInput`. **Keliru** — hanya `TextInput`/
> `PasswordInput` yang lewat `getTextInputProps`. Kekeliruannya lahir dari **membaca satu
> berkas lalu menggeneralisasi**; yang menangkapnya adalah **menjalankan** dan membaca atribut
> dari modal sungguhan.

## 7. STANDAR FABRIX

Ditetapkan di `FABRIX_FIELD_VALIDATION_CLASS_STANDARD.md`. Intinya satu pertanyaan:
**"bisakah pengguna memperbaikinya dengan mengubah satu isian yang terlihat?"** — bisa →
field; tidak → formulir. Empat golongan (A field · B formulir · C bisnis/keadaan · D
berhasil), `field`/`line` dikirim **sebagai data**, dan mekanisme Carbon dipakai apa adanya.

**Yang TIDAK ditetapkan, dan sengaja**: field mana yang **wajib diisi secara bisnis** dan
kalimat penolakan apa yang dipakai. Register kanonik sudah memutuskan itu milik pemilik
produk (F-03: *"The mechanism is not [domain knowledge]"*), dan CLAUDE.md menyebut hal yang
sama.

## 8. PILOT — modal "Buat PO" di `/purchasing`

**Dipilih berdasarkan bukti, bukan urutan daftar.** Ia satu-satunya formulir yang memuat
**keempat golongan sekaligus** plus baris berulang:

| Pesan | Golongan | Sesudah |
|---|---|---|
| *"Role Anda tidak punya izin…"* | C | tetap `InlineNotification` |
| *"User belum terkait dengan perusahaan…"* | C | tetap `InlineNotification` |
| *"Minimal 1 baris item wajib diisi."* | **B** | tetap `InlineNotification` — penggunanya harus **menambah** baris |
| *"Supplier wajib dipilih."* | A | `invalidText` pada Dropdown supplier |
| *"Lokasi pabrik (alamat kirim) wajib dipilih."* | A | `invalidText` pada Dropdown pabrik |
| *"Item pada salah satu baris tidak valid."* | A + baris | `invalidText` pada Dropdown item **baris ke-N** |
| *"Jumlah pesan harus angka positif."* | A + baris | `invalidText` pada NumberInput **baris ke-N** |
| *"Harga satuan harus angka positif."* | A + baris | `invalidText` pada NumberInput **baris ke-N** |

## 9. YANG BERUBAH — dan yang SENGAJA tidak

**Berubah (3 berkas):**

1. `purchaseOrderValidation.ts` — hasilnya kini membawa `field` dan `line`. **Kalimat pesannya tidak diubah satu pun** (§6 butir 5: memindahkan dan menulis ulang sekaligus membuat tidak ada yang tahu mana yang memperbaiki apa).
2. `createPurchaseOrder.ts` — meneruskan `field`/`line`, menandai supplier dan pabrik, dan **mencari indeks baris** yang itemnya tidak sah alih-alih membiarkannya *"salah satu baris"*.
3. `PurchasingPage.tsx` — `poFieldError` sebagai **daftar** (§5.1 menuntut seluruh isian salah ditandai sekaligus), lima kontrol menerima `invalid`/`invalidText`, notifikasi formulir digerbang, dan galat dibersihkan saat isian diubah · baris dihapus · modal dibuka · sebelum kirim ulang.

**TIDAK berubah:** kalimat pesan · aturan bisnis · field `required` mana pun · skema · rute ·
navigasi · tema · 21 halaman form lain · komponen bersama.

## 10. UJI

`tests/validasi_field_purchase_order.test.ts` — **8 uji**, MERAH lebih dulu (5 gagal),
HIJAU sesudah. **Menguji perilaku, bukan jumlah `invalidText`.**

Tiga uji **hijau sejak awal**, dan itu disengaja: (a) masukan sah tidak menghasilkan galat,
(d) galat tingkat formulir **tetap** tidak menyebut field, (e) kalimat pesannya tidak berubah.
Ketiganya menjaga yang **sudah benar** — pertahanan false positive dalam bentuk uji.

**Setiap penjaga dibuktikan menggigit:**

| Mutasi | Yang berbunyi |
|---|---|
| `field` dicabut dari galat supplier | (b) |
| nomor baris dicabut | (c) |
| galat formulir **dipaksa** mengaku milik field | (d) |
| `invalidText` dicabut dari kontrol baris | (f) |
| gerbang notifikasi dicabut | (h) |

> **Dua penjaga saya sendiri dilonggarkan** sebelum dipakai: versi pertama menuntut
> `setPoFieldError(null)` dan mencocokkan syarat render sebagai teks persis — keduanya
> menguji **detail implementasi**, bukan perilaku, dan itu persis yang dilarang kelas ini.

## 11. BUKTI PERAMBAN

Tenant uji. Seluruh non-GET **diblokir atau dijawab fixture** → **nol baris tertulis**.

| Kasus | Hasil terukur |
|---|---|
| Kirim kosong | **dua** pesan field tampil sekaligus, ditautkan `aria-describedby` ke kontrolnya · **nol** notifikasi formulir |
| Baris terisi separuh | pesan pada **NumberInput baris 0**, `aria-invalid="true"` |
| Server menolak **dengan** `field` | pesan pada kontrol yang tepat, `aria-invalid="true"` |
| Server menolak **tanpa** `field` | **nol** field ditandai, notifikasi formulir muncul |

**Enam lebar** (360/672/768/1280/1440/1920): pesan field tampil di keenamnya, **nol
terpotong**, nol gulir menyamping, nol elemen melewati tepi kanan maupun kiri.

> **Catatan pengukur, dicatat supaya tidak dibaca terbalik**: penghitung "ditandai" pada
> ringkasan enam lebar menghitung `aria-invalid="true"`, dan Carbon **tidak memasangnya pada
> Dropdown** — jadi kolom itu menunjukkan 0 sementara **kedua pesannya benar-benar tampil dan
> tertaut**. Yang membuktikan bukan penghitung itu, melainkan `pesanTampil=2` di setiap lebar.

## 12. AKSESIBILITAS

| Yang diperiksa | Hasil |
|---|---|
| `aria-invalid` | `true` pada NumberInput; **tidak dipasang** Carbon pada Dropdown → **T-V1** |
| Tautan pesan | `aria-describedby`/`aria-errormessage` menunjuk id yang **ada dan tampak** |
| Hubungan label | tidak disentuh — `titleText`/`label` Carbon tetap |
| Mekanisme buatan sendiri | **nol** — nol `aria-*` ditulis tangan, dan penjaga (f) melarangnya |
| Fokus | **tidak dipindahkan** — §5.7 sengaja belum mewajibkannya |

## 13. KEAMANAN DATA

**Nol mutasi.** Non-GET diblokir; jawaban 400/403 disuntik sebagai fixture jawaban, bukan
dihasilkan basis data. **Nol fixture dibuat**, nol yang perlu dibersihkan. Basis data nyata
**tidak disentuh** selama pengujian.

## 14. MATRIKS ROLLOUT — DIUKUR, BELUM DIKERJAKAN

| | |
|---|---|
| Modul server dengan pesan 4xx | **135** |
| Modul dengan galat golongan A | **59** |
| Galat golongan A (batas atas) | **114** |
| Galat golongan B/C — **PASS, tidak diubah** | **455** |
| Modul yang sudah mengirim `field` | **1** (pilot) |

**Sepuluh kandidat terbesar** (A = golongan A, BC = tetap tingkat formulir):

| Modul | A | BC |
|---|---|---|
| `customerDeliveryAddresses.ts` | 9 | 13 |
| `createProductionDisruption.ts` | 5 | 2 |
| `createShipmentWithSignature.ts` | 5 | 8 |
| `recordWorkOrderStepProgress.ts` | 5 | 7 |
| `recordOpeningBalance.ts` | 4 | 4 |
| `recordStockAdjustment.ts` | 4 | 4 |
| `recordWorkOrderOutput.ts` | 4 | 5 |
| `uploadDocument.ts` | 3 | 5 |
| `createProductionBatch.ts` | 3 | 5 |
| `deleteOrArchiveCustomer.ts` | 3 | 11 |

**Risiko rollout, disebut apa adanya**: polanya terbukti **dapat diulang** — server menambah
`field`, halaman memetakannya — tetapi **tidak setiap modul punya formulir yang sepadan**.
`deleteOrArchiveCustomer` misalnya dipicu dari sebuah tombol, bukan formulir; galatnya
mungkin tetap benar di tingkat formulir. **Penggolongan per pesan wajib dilakukan sebelum
tiap modul disentuh**, dan itu sebabnya batch ini berhenti di satu pilot.

## 15. TEMUAN TERTUNDA

| Kode | Temuan | Urgensi jujur |
|---|---|---|
| **T-V1** | `Dropdown`/`ComboBox` Carbon **tidak memancarkan `aria-invalid`** — pesannya dibacakan lewat `aria-describedby`, tetapi kontrolnya tidak ditandai invalid secara programatis. Menyentuh setiap Dropdown di aplikasi | **Penting** — tambalan sebagian melahirkan dua perilaku |
| **T-V2** | Validator berhenti di galat **pertama**; §5.1 menuntut seluruhnya ditandai. Sisi klien sudah memenuhi (dua field sekaligus), sisi server belum | **Penting** |
| **T-V3** | 58 modul server lain masih mengirim galat golongan A tanpa `field` | **Penting** — inti rollout |
| **T-V4** | Pemetaan `field` server→formulir memakai kesepakatan **nama string**; belum ada penjaga yang memastikan nama yang dikirim benar-benar ada di formulir | **Bisa menunggu** — mulai menggigit begitu modul kedua ikut |
| **T-V5** | Fokus tidak berpindah ke field yang ditolak (§5.7) | **Bisa menunggu** — butuh keputusan aksesibilitas |

## 16. LANGKAH BERIKUTNYA

Lihat handoff. Ringkasnya: **jangan** melanjutkan ke 58 modul sekaligus; golongkan per pesan
lebih dulu, dan tutup **T-V4** sebelum modul kedua — penjaga nama field harus ada sebelum
kesepakatan string itu dipakai di banyak tempat.
