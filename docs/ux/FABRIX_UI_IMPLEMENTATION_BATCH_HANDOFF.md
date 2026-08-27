# FABRIX — HANDOFF BATCH IMPLEMENTASI UI
## P0 correctness → reference UI → pattern validation

**28 Agustus 2026 · HEAD sebelum batch `4eb92c5` · tiga commit · TIDAK di-push**

---

# EXECUTIVE SUMMARY

Batch pertama yang benar-benar menyentuh kode sejak rantai governance selesai. Tiga
pekerjaan, tiga commit terpisah, dan **nol halaman lain disentuh**.

| | |
|---|---|
| Dua P0 kebenaran | **selesai** — `/hr` dan `/purchasing` |
| Cetakan halaman formulir penuh | **selesai** — `/company/setelan` |
| Uji | 447 → **476** (+29, seluruhnya baru) |
| Lint | 28 → **28** (nol tambahan) |
| Build produksi | **lulus** |
| Baris data tertulis | **NOL** |
| Komponen bersama baru | **nol** — dan itu keputusan, bukan kelalaian |

**Satu regresi lahir dari batch ini dan diperbaiki sebelum berhenti** — dijelaskan di
bagian `/company/setelan`.

---

## COMPLETED

1. `fix(hr): correct attendance status aggregation` — `71f8abe`
2. `fix(purchasing): correct success notification lifecycle` — `f363a93`
3. `feat(ux): establish full-page form reference pattern` — `cfece33`

---

## /hr

**AS-IS.** Kartu "Hadir hari ini" **selalu 0** untuk absensi yang dibuat sistem.

Sebabnya satu kolom dengan **dua kosakata yang sama-sah**, dan kekangan basis data
mengizinkan keduanya sehingga tidak ada yang berbunyi:

| | |
|---|---|
| `recomputeAttendanceDay.ts:142-145` menulis | `HADIR` · `TERLAMBAT` · `PULANG` · `DI_LUAR_AREA` · `ALPA` · dan `leave_type` (`IZIN`/`SAKIT`/`CUTI`) |
| `HrDashboardPage.tsx:360` menyaring | `'present'` · `'late'` |

Kolom Status ikut menampilkan **slug mentah**, karena peta labelnya hanya memuat lima
kunci huruf kecil.

**TO-BE.** Satu modul kosakata bersama: `src/features/attendance/statusAbsensi.ts`,
diekspor lewat pintu resmi feature.

**GAP yang menarik**: peta yang **LENGKAP dan BENAR** sebenarnya sudah ada di
`AttendancePage` — memuat kedua kosakata. Yang tidak ada adalah **pemakaian bersamanya**.
Ini kelas "dua jalur hidup" yang sudah lima kali menggigit proyek ini, dan kali ini
pengetahuannya bahkan sudah benar di salah satu jalur.

**Keputusan pemilik produk yang diterapkan**: `HADIR`, `TERLAMBAT`, `PULANG` dihitung hadir.

**Dua hal yang ditambahkan di luar daftar itu, beserta alasannya:**
- `present` dan `late` **ikut dihitung**. Keduanya tidak ditulis satu pun kode server,
  tetapi kolomnya masih `default 'present'`, kekangannya masih mengizinkannya, dan jalur
  absen-mandiri RLS menyisipkannya. Hari ini justru **hanya itulah** yang dihitung —
  mencabutnya adalah kemunduran, bukan pembersihan.
- `DI_LUAR_AREA` **tidak dihitung**, dan itu **keputusan yang belum diambil**, bukan
  kelalaian. Orangnya **memang absen masuk**, hanya di luar area yang ditetapkan.

**Nol status baru diperkenalkan. Nol data historis diubah.** Penyaring tanggal dan
perusahaan sengaja tetap di kueri server — memindahkannya ke lapisan tampilan akan
melemahkannya.

---

## /purchasing

**AS-IS.** Penyimpanan supplier yang **berhasil** ditampilkan sebagai kotak merah berjudul
"Gagal", modalnya tidak ditutup, dan formulirnya dikosongkan.

**Akar masalahnya bukan judul.** State `supplierFormStatus` **sudah tahu jawabannya**
(`'idle' | 'saving' | 'success' | 'error'`); notifikasinya saja yang tidak membacanya —
syaratnya `supplierFormMessage ? … : null`, yaitu **ada-tidaknya pesan**. Dan pesan
berhasil mengisi variabel yang sama dengan pesan gagal.

**TO-BE.** Ketiga modal di berkas yang sama (supplier, harga, PO):

| Keadaan | Perilaku |
|---|---|
| Berhasil | modal **ditutup**, pesan dibersihkan, hasil lewat `AreaNotifikasi` bersama |
| Gagal | modal **tetap terbuka**, isian **tidak dikosongkan** — bisa diperbaiki |

Pesan **wajib dibersihkan** saat berhasil: bila ditinggalkan, ia muncul lagi sebagai kotak
galat saat modal dibuka berikutnya, untuk penyimpanan yang sudah lama selesai.

### Keunikan supplier — SENGAJA TIDAK DIPAKSAKAN

Diaudit, dan hasilnya **membuktikan aturan bisnisnya belum ada**:

| Yang diperiksa | Hasil |
|---|---|
| Kolom kode supplier | **tidak ada** |
| Pemeriksaan duplikat di `createSupplier` | **tidak ada** |
| Supplier di production | **NOL** |
| Duplikat nyata | **NOL** (karena nol data) |

Uniqueness hanya bisa jatuh ke `name` — **nilai tampilan yang bisa berubah**. Menambahkan
kekangan atas dasar tebakan mengulang kelas cacat yang sama dengan T-1. **Kekangan tidak
dibuat**, dan uji (g) menjaga supaya ia tidak diselundupkan tanpa keputusan.

---

## /company/setelan

**AS-IS.** Diaudit, halaman ini **sudah memenuhi hampir seluruh D-A**: kisi
`repeat(auto-fit, minmax(min(100%, 20rem), 1fr))` tanpa satu pun breakpoint lebar layar,
`<Tile>` per kelompok + `<h2>`, lebar dibatasi 60rem, jarak dari token, keadaan memuat,
notifikasi berhasil dan galat. **Lima dari sepuluh penjaga hijau sejak awal.**

**Yang kurang tepat satu hal**: elemen `<form>` itu sendiri. Pembungkusnya `<div>` dan
penyimpanannya lewat `onClick` lepas.

**TO-BE.** `<form onSubmit>` + tombol utama `type="submit"` + `preventDefault`.
Dan "Batalkan perubahan" dari `kind="ghost"` jadi `kind="secondary"` + `type="button"` —
ghost adalah penekanan **terendah**, sedangkan membuang suntingan pengguna adalah aksi
sekunder sungguhan.

### REGRESI YANG LAHIR DARI BATCH INI — ditemukan dan diperbaiki sebelum berhenti

Memasang `<form>` **menyalakan validasi bawaan peramban**, dan itu langsung membongkar
cacat yang selama ini tidak pernah berjalan.

Bawaan `pattern` pada `DatePickerInput` Carbon adalah **format Amerika**
(`\d{1,2}/\d{1,2}/\d{4}`), sedangkan picker ini disetel `dateFormat="Y-m-d"` sehingga
nilainya `2026-08-28`. Akibatnya `form.checkValidity()` bernilai **false**, dan peramban
**memblokir submit diam-diam**: nol permintaan terkirim, nol pesan, nol galat konsol.

**Yang membuatnya terlihat bukan membaca kode, melainkan mengukur**: probe pertama
melaporkan "Enter tidak mengirim". Probe kedua menunjukkan **klik tombol pun** nol
permintaan — jadi bukan Enter yang rusak. Probe ketiga membaca `checkValidity()` per
kontrol dan menunjuk `berlaku-sejak` beserta pesannya.

Diperbaiki dengan menyelaraskan `pattern` ke `dateFormat`-nya. `pattern` **memang prop
Carbon**, jadi ini memakai Carbon apa adanya, bukan menimpanya. Penjaga (g2) mengunci
keselarasan itu.

---

## SHARED PATTERNS

**Nol komponen bersama dibuat, dan itu keputusan.**

Aturan batch: komponen bersama hanya dibuat bila polanya muncul di **minimal dua tempat**.
Diukur:

| | Jumlah |
|---|---|
| Berkas halaman ber-`<form>` | 8 |
| Di antaranya layar publik (punya kerangka `LayarPublik` sendiri) | 4 |
| Di antaranya form **di dalam modal** | 2 |
| **Halaman formulir penuh sungguhan** | **2** (`SetelanPerhitunganPage`, `ProfilePage`) |
| Yang memakai **bentuk D-A** (Tile + h2 + kisi auto-fit) | **1** |

Bentuk D-A hidup di **satu** tempat. Membuat `FormShell`/`FormSection`/`FormGrid` sekarang
berarti mengabstraksi dari satu contoh — jalan tercepat menuju "God Form Component" yang
justru dilarang batch ini.

**Pemicu membuatnya**: halaman formulir penuh **kedua** yang benar-benar memakai bentuk
D-A. Saat itu polanya bisa dibandingkan, dan abstraksinya punya dua pengguna nyata.

---

## BOM

**Tidak disentuh.** Batas BOM tetap **modal bertahap** sesuai keputusan.

Diaudit terhadap standar baru, **dicatat tanpa diperbaiki** (bukan regresi dari batch ini):

| Butir standar | BOM hari ini |
|---|---|
| Modal bertahap (§9) | **patuh** |
| Baris berulang ikut lebar wadah (§10.2) | **patuh** — DS-22 |
| Nol `window.confirm` (§14) | **patuh** |
| Notifikasi bersama (§14) | **patuh** — `AreaNotifikasi` |
| Keadaan memuat | **patuh** — `Skeleton` |
| **Galat menempel field (§11.1)** | **MENYIMPANG** — `invalidText` nol pemakaian |
| **Ukuran kontrol seragam (§7.7)** | **MENYIMPANG** — satu `NumberInput` tanpa `size` di baris komponen, berdampingan kontrol `lg` |

---

## TESTS

| | Sebelum | Sesudah |
|---|---|---|
| Berkas uji | 71 | **74** |
| Uji | 447 | **476** |
| Gagal | 0 | **0** |

Tiga berkas uji baru, **seluruhnya dibuktikan MERAH lebih dulu**:

| Berkas | Uji | MERAH awal |
|---|---|---|
| `tests/hr_kehadiran_hari_ini.test.ts` | 12 | 11 gagal |
| `tests/purchasing_notifikasi_berhasil.test.ts` | 7 | 4 gagal |
| `tests/setelan_cetakan_formulir_halaman.test.ts` | 10 | 4 gagal |

Setiap penjaga dibuktikan **menggigit** dengan merusak kodenya sengaja lalu memulihkannya.

**Satu penjaga sempat MENUDUH SALAH dan langsung diperketat**: penjaga "satu sumber
kosakata" mencocokkan **nama variabel** dan menangkap `employmentStatusLabels`
(kontrak/PHL/freelance) — domain lain yang sah. Diperketat ke **kunci kosakata absensi**.
Penjaga yang salah tuduh melatih orang mengabaikan hasilnya.

---

## ACCESSIBILITY

`/company/setelan`, enam lebar: satu `<h1>` · **nol lompatan hierarki judul** · nol tombol
tanpa nama terbaca · **nol kontrol tanpa label** · nol galat konsol.

`/hr`: kolom Status kini menampilkan label Bahasa Indonesia, bukan slug mentah — pengguna
pembaca layar mendengar "Hadir", bukan "HADIR".

---

## RESPONSIVE

`/company/setelan` di **360 / 672 / 768 / 1280 / 1440 / 1920**:

| | Hasil |
|---|---|
| Gulir menyamping | **nol di keenam lebar** |
| Elemen melewati tepi kanan | **nol** |
| Elemen melewati tepi kiri | **nol** |
| Kisi | 1 kolom di 360/672 · 2 kolom mulai 768 |
| Lebar halaman | terkunci 960px mulai 1280 |

---

## CARBON COMPLIANCE

| Keputusan | Dasar |
|---|---|
| `pattern` diselaraskan ke `dateFormat` | `pattern` **prop resmi** `DatePickerInput` — memakai Carbon, bukan menimpanya |
| `kind="secondary"` untuk aksi sekunder | ghost = penekanan terendah |
| `AreaNotifikasi` untuk hasil | modal untuk **memutuskan**, notifikasi untuk **memberi tahu** |
| `<Tile>` + `<h2>` untuk kelompok | `<legend>` Carbon 12px `text-secondary`, bukan elemen heading |

Nol pola diambil dari shadcn, Material, Bootstrap, atau Tailwind UI.

---

## NEW FINDINGS

| # | Temuan | Status |
|---|---|---|
| **N-1** | `DatePickerInput` Carbon: `pattern` bawaan format Amerika bertabrakan dengan `dateFormat="Y-m-d"` → submit diblokir diam-diam. **Kelas, bukan kejadian** — berlaku di mana pun keduanya dipakai bersama | diperbaiki di `/company/setelan`; **belum disisir** ke halaman lain |
| **N-2** | `DI_LUAR_AREA`: orangnya absen masuk tetapi di luar area — dihitung hadir atau tidak? | **keputusan bisnis**, belum diambil |
| **N-3** | Keunikan supplier belum punya aturan bisnis; nol data untuk membuktikannya | **keputusan bisnis**, belum diambil |
| **N-4** | BOM menyimpang dari §11.1 (`invalidText` nol) dan §7.7 (ukuran kontrol) | dicatat, tidak dikerjakan |
| **N-5** | Kartu absensi `DI_LUAR_AREA`, `BELUM_HADIR`, `ISTIRAHAT`, `KOREKSI_PENDING` terdaftar di kekangan tetapi **tidak pernah ditulis kode mana pun** | dicatat |

---

## DEFERRED FINDINGS

Seluruh temuan Master Plan yang belum disentuh: kelas cacat lintas halaman (galat menempel
field · keadaan yang tidak dirender · elemen mentah non-Carbon · teks Inggris bocor),
20 halaman lain dalam lingkup revisi, dan 10 halaman yang responsifnya masih **UNKNOWN**.

---

## TASK REGISTER

**Nol perubahan pada `build_tasks`.** Nol task dibuat.

Ketiga pekerjaan batch ini **tidak punya task kanonik**, dan itu disengaja: perintah kerja
melarang mengubah registri tanpa izin eksplisit.

**PROPOSED, menunggu izin:**

| # | Usulan |
|---|---|
| PT-A | `/hr` kosakata status absensi (**selesai dikerjakan**, butuh tempat mencatatnya) |
| PT-B | `/purchasing` daur hidup notifikasi (**selesai dikerjakan**) |
| PT-C | `/company/setelan` cetakan halaman formulir penuh (**selesai dikerjakan**) |
| PT-D | N-1 — sapuan `pattern` vs `dateFormat` ke seluruh `DatePicker` |

> **PERINGATAN yang wajib dibaca sebelum membuat task**: `DS-21` sudah terbukti bertabrakan
> dengan pencadangan di `CANONICAL-ID-REGISTER-2026-08-27.md`, dan **sepuluh temuan lain**
> di register itu juga menunggu ID. Jangan memakai "kode berikutnya" tanpa membaca register
> lebih dulu — skrip kanonik hanya membaca `build_tasks`, sedangkan pencadangan hidup di
> markdown.

---

## COMMITS

| Commit | Isi |
|---|---|
| `71f8abe` | `fix(hr): correct attendance status aggregation` |
| `f363a93` | `fix(purchasing): correct success notification lifecycle` |
| `cfece33` | `feat(ux): establish full-page form reference pattern` |

Nol `amend`, nol `squash`, nol `rebase`.

## PUSH STATUS

**BELUM DI-PUSH.** `main` ahead 28 dari `origin/main`.

---

## NEXT RECOMMENDED BATCH

1. **Jawab N-2 dan N-3** — keduanya keputusan bisnis yang memblokir pekerjaan lanjutan.
2. **Sapu N-1** — `pattern` vs `dateFormat` di seluruh pemakaian `DatePicker`. Kelasnya
   sudah terbukti membisukan submit; halaman lain belum diperiksa.
3. **Kelas cacat lintas halaman**, dikerjakan sebagai kelas: galat menempel field
   (`invalidText` 5 dari 154 kontrol) lalu keadaan yang tidak dirender (14 halaman).
4. **Halaman formulir penuh kedua** — begitu ada, barulah komponen bersama dibuat.

**JANGAN** memulai rollout 22 halaman sekaligus.
