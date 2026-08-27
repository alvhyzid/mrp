# EXECUTIVE DECISION — FORM GOVERNANCE FABRIX

**STATUS: PROPOSED.** Bukan kanonik, bukan final, belum disetujui.
**28 Agustus 2026 · HEAD `4d39c0c` · nol perubahan sumber, nol perubahan `build_tasks`**

> Dokumen ini dibuat untuk dibaca **kurang dari 10 menit**. Rinciannya ada di
> `FABRIX_FORM_GOVERNANCE_STANDARD.md` dan `FABRIX_FORM_GOVERNANCE_DECISION_RECORD.md`.

---

## D-A — BENTUK HALAMAN FORMULIR PENUH

**REKOMENDASI**

> `<form>` sungguhan · `<Tile>` per kelompok makna · `<h2>` sebagai judul kelompok ·
> kisi `repeat(auto-fit, minmax(min(100%, 20rem), 1fr))` · lebar halaman dibatasi.

**KENAPA** — empat pengukuran dari paket Carbon terpasang, bukan pendapat:

| Yang diukur | Hasil | Artinya |
|---|---|---|
| `.cds--form` (dipancarkan `<Form>` Carbon) | **nol aturan CSS** | memakainya upacara tanpa akibat |
| `<Stack>` | **nol multi-kolom, nol media query** | tidak bisa jadi kerangka |
| Carbon membatasi lebar field | **tidak sama sekali** | kita harus membatasinya sendiri |
| `<legend>` `FormGroup` | 12px `text-secondary`, bukan heading | tidak layak jadi judul bagian |

Ditambah: opsi ini **satu-satunya yang sudah terbukti berjalan** — `/company/setelan`.

**Diperiksa ulang di batch ini** terhadap Carbon resmi, komponen Carbon, implementasi yang
ada, aksesibilitas, responsif, validasi, keyboard, dan perawatan. **Tidak ditemukan alasan
kuat untuk pilihan lain**, sehingga tidak ada alternatif baru dibuat.

**KONSEKUENSI**

- Satu halaman perlu **satu koreksi**: `/company/setelan` tidak punya elemen `<form>` sama
  sekali — Enter tidak menyimpan, `required` HTML tidak berlaku. Perbaikannya satu elemen.
- FABRIX menyatakan bentuk formulir halamannya **deviasi beralasan**, bukan penerapan
  Carbon — dan itu dicatat di `design-debt.md`.
- `<FluidForm>` **ditolak**: ia menyalakan mode lewat context yang dibaca **17 komponen** dan
  **memindahkan tempat pesan galat**. Nol pengalaman di FABRIX.

**PUTUSAN: RECOMMENDED STANDARD** — tidak membutuhkan keputusan Anda kecuali Anda menolaknya.

---

## D-B — BENTUK BARIS BERULANG

**REKOMENDASI**

> **Yang sekarang tetap**: kartu bergrid, label diulang tiap baris, kolom mengikuti lebar
> wadah lewat `repeat(auto-fit, minmax(min(15rem, 100%), 1fr))` (DS-22).
> **Nol perubahan kode.**

**KENAPA — sesudah analisis tandingan yang batch lalu gagal dijalankan**

Batch sebelumnya mengakui analisis tandingan D-B tidak berjalan. Batch ini menjalankannya,
dengan tujuan **mencari alasan rekomendasi itu salah**. Hasilnya:

| Serangan | Hasil |
|---|---|
| "Kolom bentuk B tidak sejajar antar baris" | **GAGAL.** Tiap baris grid dengan lebar sama → jumlah dan lebar kolom identik → kolomnya sejajar |
| "Galat per-baris tidak punya tempat" | **GAGAL, dan justru berbalik.** B punya ruang `invalidText` di bawah tiap kontrol; bentuk label-tersembunyi membuat pesan galat kehilangan penunjuk kolom |
| "B tidak punya pembagian halaman untuk baris banyak" | **GAGAL sebagai pembeda.** `Pagination` di BomsPage:803 milik **tabel daftar**, bukan baris komponen — ketiadaan itu berlaku untuk **keempat** opsi |
| "B paling tinggi" | **BERTAHAN, tapi kecil.** Label-tersembunyi hemat ±24px per kontrol: 360px 448→±352 (**−21%**), 768px 280→±232 (**−17%**) |
| "Label yang sama diulang N kali" | **BERTAHAN.** 4 label × N baris. Untuk 10 komponen = 40 label, 4 yang berbeda |

**Satu serangan yang tidak bisa dipatahkan bukti**: bagi orang yang mengisi BOM **berulang
kali**, label yang diulang adalah kebisingan; bagi yang pertama kali, ia pertolongan. Itu
pertanyaan **alur kerja**, bukan pertanyaan teknis — dan Pengecualian 2 di standar sudah
menampungnya dengan syarat yang **terukur**, bukan selera.

**KONSEKUENSI**

- **Nol perubahan kode.** Bentuknya sudah terpasang dan sudah bersih di 36 pengukuran.
- Bentuk label-tersembunyi tersedia lewat **Pengecualian 2**, dengan tiga syarat: kontrolnya
  pendek · judul kolom dibawa lewat `data-label` di bawah 672px · penghematan tinggi
  **diukur** ≥20%.
- **Batas yang jujur**: tidak satu pun dari keempat opsi menyelesaikan baris berjumlah puluhan.
  Jawaban untuk itu adalah pembagian halaman atau virtualisasi, dan **belum ada** di mana pun.

**PUTUSAN: RECOMMENDED STANDARD** — bertahan sesudah diserang.

---

## BATAS MODAL vs HALAMAN PENUH

Ditetapkan menurut **sifat pekerjaan**, bukan jumlah field. Jumlah field hanya sinyal sekunder.

| Bentuk | Dipakai ketika |
|---|---|
| **MODAL** | satu keputusan · aksi kontekstual · pengguna tetap berada di konteksnya · interaksi terbatas |
| **MODAL BERTAHAP** | pekerjaan panjang yang bisa dipecah jadi bagian yang **masing-masing berdiri sebagai satu konteks utuh**. Uji: judulnya menyebut satu hal. Judul "Lanjutan"/"Bagian 2" = pemecahan salah |
| **HALAMAN PENUH** | alurnya **BERCABANG** — langkah berikutnya bergantung pada pilihan sebelumnya sampai jalurnya berbeda · ATAU sudah `lg` dan masih menggulir banyak |

**Panjang saja BUKAN alasan** keluar dari modal. Itu keputusan Anda 26 Agu 2026
(`cetakan-halaman-data.md` §6e-2), dan ia **berlaku**.

---

## TABEL KEPUTUSAN PER ALUR KERJA

| Alur kerja | Sekarang | Target | Alasan | Pengecualian |
|---|---|---|---|---|
| **Master Item** | modal bertahap 3 langkah | **tetap** | tidak bercabang; judul tiap langkah menyebut satu hal | — |
| **Karyawan** | modal bertahap 3 langkah | **tetap** | tidak bercabang | seragamkan ukuran kontrol; cabut galat-sebelum-mengetik |
| **BOM** | modal bertahap 2 langkah | **tetap** | tidak bercabang. §6e-3 **diuji dan tidak berlaku** di sini | bila kelak pindah, **BUAT dan UBAH pindah bersama** |
| **PO Klien** | modal bertahap 4 langkah, **dua kolom** | **tetap bertahap**, **cabut dua kolom** | §6e: satu kolom; dua kolom dilarang eksplisit | — |
| **Supplier** | modal `md`, satu langkah | **tetap** | cetakan modal asli (PMB-11) | perbaiki notifikasi berhasil-sebagai-gagal (P0) |
| **Routing** | modal, baris berulang | **tetap** | tidak bercabang | baris berulangnya paling tinggi di repo — terapkan DS-22 |
| **Work Order** | modal | **tetap** | tidak bercabang | — |

**Nol alur kerja berpindah ke halaman penuh.**

---

## PILOT — BERUBAH DARI MASTER PLAN

Master Plan menyarankan **BOM** sebagai pilot halaman penuh. **Saran itu gugur**, karena BOM
tetap modal.

**Pilot yang diusulkan sekarang: `/company/setelan`.**

| Kriteria | Bukti |
|---|---|
| Sudah berupa halaman formulir penuh | satu-satunya di repo |
| Perubahan yang dibutuhkan | **satu elemen** — pembungkus `<form>` |
| Menetapkan pola untuk D-A | ya — ia menjadi cetakan resminya |
| Risiko terhadap alur kerja pabrik | rendah — halaman setelan, jarang disentuh |
| Bergantung pada keputusan lain | tidak |

**BOM tetap berharga sebagai pilot untuk hal LAIN**: ia layar terbaik untuk menerapkan
kelas cacat lintas halaman (galat menempel field, keadaan yang tidak dirender), karena
DS-17/DS-21/DS-22 sudah menutup risiko responsif dan siklus hidupnya.

---

## P0 — DIVALIDASI ULANG, KEDUANYA MASIH TERBUKA

Diperiksa baca-saja di HEAD `4d39c0c`. **Tidak diperbaiki.**

### P0-1 · `/hr` — "Hadir hari ini" selalu 0 — **MASIH TERBUKA**

| Bukti | Baris |
|---|---|
| Penulis menulis huruf BESAR: `'HADIR'`, `'TERLAMBAT'`, `'PULANG'`, `'DI_LUAR_AREA'`, `'ALPA'` | `recomputeAttendanceDay.ts:142-145` |
| Penyaring membaca huruf kecil: `a.status === 'present' \|\| a.status === 'late'` | `HrDashboardPage.tsx:360` |
| Kekangan basis data **mengizinkan KEDUA kosakata** | `20260823090000_attendance_geo_qr_w1.sql` |
| Peta label hanya memuat 5 kunci huruf kecil → slug mentah tampil di layar | `HrDashboardPage.tsx:88-94`, `:545` |

**Task kanonik: TIDAK ADA.** **PROPOSED.**

> **Satu hal yang harus Anda putuskan saat ini diperbaiki, dan ini bukan pertanyaan teknis**:
> status mana yang dihitung "hadir"? `'PULANG'` berarti sudah absen masuk **dan** pulang —
> orangnya jelas hadir. Memetakan huruf besar ke huruf kecil saja **tidak cukup**; harus
> ditetapkan mana yang masuk hitungan.

### P0-2 · `/purchasing` — penyimpanan berhasil tampil sebagai "Gagal" — **MASIH TERBUKA**

| Bukti | Baris |
|---|---|
| Notifikasi bersyarat **ada-tidaknya pesan**, bukan status galat | `PurchasingPage.tsx:1175-1179` |
| `kind="error"` dan `title="Gagal"` **dipaku mati** di tiga modal | `:1177`, `:1292`, `:1393` |
| Jalur berhasil mengisi pesan yang sama, mengosongkan form, **tidak menutup modal** | `:363-368` |
| Nol kekangan unik pada `suppliers.name` | disisir seluruh migrasi |

**Task kanonik: TIDAK ADA.** **PROPOSED.**

---

## REKONSILIASI KODE TASK

Satu tabrakan: **`DS-21`**. Register mencadangkannya untuk temuan token paralel (F-01/F-11)
pada 27 Agu 01:35; saya memakainya untuk cacat indikator langkah pada 27 Agu 21:22 tanpa
membaca register itu.

**`DS-22` tidak bertabrakan.** **Nol data rusak, nol task tertimpa.** Yang hilang adalah
tempat untuk F-01/F-11.

Rincian dan usulan penyelesaian: `FABRIX_TASK_ID_RECONCILIATION_DS21_DS22.md`.

---

## URUTAN IMPLEMENTASI

Setelah persetujuan Anda, urutannya:

### TAHAP 1 — KEBENARAN (P0), tidak bergantung pada D-A/D-B

| Halaman | Pekerjaan | Butuh keputusan Anda |
|---|---|---|
| `/hr` | samakan kosakata status absensi | **ya** — status mana yang "hadir" |
| `/purchasing` | pisahkan notifikasi berhasil dari gagal; tutup modal saat berhasil | tidak |

### TAHAP 2 — CETAKAN

| Halaman | Pekerjaan |
|---|---|
| `/company/setelan` | tambahkan `<form>`; ia jadi cetakan resmi D-A |

### TAHAP 3 — KELAS CACAT LINTAS HALAMAN

Dikerjakan sebagai **kelas**, bukan per halaman: galat menempel field (`invalidText` 5 dari
154 kontrol) · keadaan yang tidak dirender (14 halaman) · elemen mentah non-Carbon · teks
Inggris bocor ke layar.

### TAHAP 4 — HALAMAN BERNILAI TINGGI

`/ppic` (17 cacat) · `/customers` (16) · `/routing` (15) · `/production` (14) ·
`/work-orders` (13) · `/sales-orders` (11) · `/shipments` (11) · `/boms` (11)

### TAHAP 5 — SISANYA

14 halaman ber-severity MEDIUM/LOW, plus pengukuran responsif untuk **10 halaman yang masih
UNKNOWN** (publik, POD, cetak, internal).

---

# KEPUTUSAN YANG MEMBUTUHKAN ANDA

Hanya **tiga**. Sisanya sudah bisa diputuskan dari bukti.

### 1 · Terima D-A dan D-B seperti di atas?

Keduanya **RECOMMENDED STANDARD** — saya tidak meminta Anda memilih di antara opsi, hanya
menerima atau menolak. Bila menerima, konsekuensinya: **nol perubahan kode untuk D-B**, dan
**satu elemen** untuk D-A.

### 2 · Status absensi mana yang dihitung "hadir hari ini"?

Ini menentukan **arti angka** di dashboard HRD, jadi ia milik Anda, bukan saya.
Kandidatnya: `HADIR` · `TERLAMBAT` · `PULANG` · `DI_LUAR_AREA` · `ALPA` · `IZIN` · `SAKIT` ·
`CUTI` · `BELUM_HADIR` · `ISTIRAHAT` · `KOREKSI_PENDING`.

### 3 · Terima usulan penyelesaian tabrakan `DS-21`?

Yaitu: `DS-21`/`DS-22` tetap seperti adanya, F-01/F-11 dapat `DS-23`, dan pencadangan ID
berhenti hidup hanya di markdown.

---

**Sampai ketiganya dijawab, tidak ada implementasi yang dimulai.**
