# FABRIX FORM GOVERNANCE — FINAL HANDOFF

**28 Agustus 2026 · HEAD sebelum batch `4d39c0c` · nol perubahan sumber, nol perubahan `build_tasks`**

> Ditulis supaya seseorang tanpa konteks percakapan bisa langsung melanjutkan.

---

## KEADAAN SAAT INI

Rantai **AUDIT → BUKTI → GOVERNANCE → KEPUTUSAN** selesai. Yang tersisa hanya persetujuan
pemilik produk, lalu implementasi bisa dimulai.

Seluruh standar berstatus **PROPOSED**. Tidak ada yang boleh disebut kanonik, final, atau
disetujui.

## KEPUTUSAN YANG SUDAH MANTAP

**D-A — bentuk halaman formulir penuh: RECOMMENDED STANDARD.**
`<form>` sungguhan + `<Tile>` per kelompok + `<h2>` + kisi `auto-fit` + lebar dibatasi.
Diperiksa ulang di batch ini; tidak ditemukan alasan kuat untuk pilihan lain.

**D-B — bentuk baris berulang: RECOMMENDED STANDARD.**
Yang sekarang tetap. **Nol perubahan kode.** Analisis tandingan yang batch lalu gagal
dijalankan **sudah dijalankan**, dengan tujuan mencari alasan rekomendasi itu salah — tiga
dari lima serangan gagal, dua bertahan tetapi kecil, dan satu-satunya yang tidak bisa
dipatahkan bukti adalah pertanyaan alur kerja yang sudah ditampung Pengecualian 2.

**BATAS MODAL** ditetapkan menurut sifat pekerjaan: modal · modal bertahap · halaman penuh
**hanya bila alurnya bercabang**. Panjang saja bukan alasan.

**Nol alur kerja berpindah ke halaman penuh** — termasuk BOM.

## KEPUTUSAN YANG MASIH DIBUTUHKAN

Tiga, ada di `FABRIX_FORM_GOVERNANCE_FINAL_DECISION_PACKAGE.md`:

1. Terima D-A dan D-B?
2. Status absensi mana yang dihitung **"hadir hari ini"**? (menentukan arti angka, bukan teknis)
3. Terima usulan penyelesaian tabrakan `DS-21`?

## REKONSILIASI KODE TASK

Satu tabrakan: **`DS-21`** — register mencadangkannya untuk temuan token paralel (F-01/F-11)
dua puluh jam sebelum saya memakainya untuk cacat indikator langkah, tanpa membaca register itu.

**`DS-22` tidak bertabrakan.** **Nol data rusak, nol task tertimpa.** Yang hilang: tempat
untuk F-01/F-11. Kode kosong berikutnya **`DS-23`**.

Sebab strukturalnya perlu diingat: **pencadangan ID hidup di markdown, pengalokasian ID
membaca basis data.** Selama keduanya terpisah, tabrakan yang sama akan terulang.

Rincian: `FABRIX_TASK_ID_RECONCILIATION_DS21_DS22.md`.

## STATUS P0 — KEDUANYA MASIH TERBUKA

| P0 | Keadaan | Bukti |
|---|---|---|
| `/hr` "Hadir hari ini" selalu 0 | **TERBUKA** | penulis menulis `'HADIR'`/`'TERLAMBAT'` (huruf besar) di `recomputeAttendanceDay.ts:142-145`; penyaring membaca `'present'`/`'late'` di `HrDashboardPage.tsx:360`; kekangan basis data mengizinkan keduanya |
| `/purchasing` berhasil tampil sebagai "Gagal" | **TERBUKA** | notifikasi bersyarat ada-tidaknya pesan (`:1175`), `title="Gagal"` dipaku mati (`:1177`, `:1292`, `:1393`), jalur berhasil mengisi pesan yang sama dan tidak menutup modal (`:363-368`) |

**Nol task kanonik memiliki keduanya.** Keduanya **PROPOSED**, belum dibuat.

## PILOT — BERUBAH

Master Plan menyarankan **BOM**. **Saran itu gugur** karena BOM tetap modal.

**Pilot sekarang: `/company/setelan`** — satu-satunya halaman formulir penuh yang sudah ada,
butuh **satu elemen** (`<form>`), dan langsung menjadi cetakan resmi D-A.

BOM tetap berharga sebagai pilot untuk **kelas cacat lintas halaman**, karena risiko
responsif dan siklus hidupnya sudah ditutup DS-17/DS-21/DS-22.

## BATCH BERIKUTNYA

Tunggu persetujuan. Sesudahnya, urutannya:

1. **P0** — `/hr` (butuh jawaban pertanyaan 2) dan `/purchasing` (tidak butuh keputusan)
2. **Cetakan** — `/company/setelan` diberi `<form>`
3. **Kelas cacat lintas halaman** — galat menempel field, keadaan yang tidak dirender,
   elemen mentah, teks Inggris
4. **Halaman bernilai tinggi** — `/ppic`, `/customers`, `/routing`, `/production`, dst.

## DI LUAR LINGKUP BATCH INI

Nol implementasi · nol perubahan `src/`, `app/`, `components/`, `tests/`, `supabase/` ·
nol migrasi · nol perubahan `build_tasks` · nol task baru · T-1 tidak disentuh ·
`docs/00-GOVERNANCE/` tidak ikut · DS-06, DS-20, AUD-42, MST-09 tidak dikerjakan ·
Master Plan **tidak diubah** (koreksinya hidup di dokumen rekonsiliasi terpisah).

## YANG PERLU DIWASPADAI SESI BERIKUTNYA

**Sepuluh temuan lain di register juga menunggu ID** — validasi tingkat field (F-03),
mekanisme bantuan yang kanonik (F-04), lapisan shadcn mati (F-05), `AreaNotifikasi` baru di
6 dari 39 halaman (F-07), tiga perlakuan memuat (F-08), aksi massal (F-09), sisa gaya
`SalesOrdersPage` (F-10), gerbang regresi visual (F-13), enam komponen di atas 1.100 baris
(F-15), dan tabel tanpa pembagian halaman (F-16). Jangan memakai kode DS berikutnya tanpa
memeriksa daftar itu lebih dulu.

**Enam konflik governance** (K-1…K-6 di Decision Record) masih terbuka, termasuk empat yang
sudah diangkat register sendiri.
