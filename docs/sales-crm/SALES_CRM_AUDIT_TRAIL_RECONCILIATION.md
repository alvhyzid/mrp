# SALES_CRM_AUDIT_TRAIL_RECONCILIATION

**Tanggal:** 29 Agustus 2026 · **Menjawab:** BD-07, §9–§16 perintah eksekusi
**Rancangannya** di `SALES_CRM_DECISION_AUDIT_ARCHITECTURE.md`; berkas ini mencatat **apa
yang benar-benar dibangun dan apa yang terbukti**.

---

## 1. Keputusan arsitektur yang diambil

> **DIPERLUAS, bukan dibuat ulang.** `status_transition_log` — jejak keputusan kanonik yang
> sudah tersambung trigger ke enam tabel — ditambah **lima kolom**. **Nol tabel audit baru.**

| Kolom baru | Menjawab |
|---|---|
| `actor_name_snapshot` | SIAPA, dan tetap benar walau orangnya berganti nama |
| `actor_role_snapshot` | dalam KAPASITAS apa |
| `actor_department_snapshot` | departemen mana — dipakai menegakkan BD-06 |
| `reason_category` | KENAPA, dalam bentuk yang bisa disaring |
| `approval_reference_id` | rujukan ke persetujuan yang mendasarinya |

`reason` yang sudah ada dipakai sebagai **catatan tambahan** (§12: kategori + catatan).

**Katalog kategori alasan** lahir sebagai `decision_reason_categories` — bentuknya
**menyalin `status_transition_rules`**: master berlaku untuk seluruh tenant, **tanpa
`company_id`**. Ia dibaca lewat API, bukan ditulis di kode layar, karena daftar yang hidup
di kode UI tidak bisa dipakai menyaring riwayat di sisi server dan akan bercabang begitu
ada layar kedua yang menampilkannya. **26 kategori** terpasang di ketiga proyek.

---

## 2. Bagaimana konteks keputusan sampai ke jejaknya

Kendala yang nyata dan menentukan bentuk seluruh pekerjaan ini: **trigger tidak menerima
parameter**, dan **PostgREST tidak mengizinkan dua pernyataan dalam satu transaksi dari
klien**. Jadi alasan dan pelaku tidak bisa dititipkan dari kode aplikasi ke trigger lewat
jalur biasa.

Yang berlaku sekarang:

```
RPC (tahan_po_klien / lepas_po_klien / batalkan_po_klien)
  → pasang_konteks_keputusan()  : memvalidasi kategori, lalu set_config(..., true)
  → UPDATE customer_purchase_orders SET status = ...
      → trigger enforce_status_transition() membaca current_setting(..., true)
      → INSERT status_transition_log lengkap dengan pelaku + alasan
```

**KONSEKUENSI YANG WAJIB DISADARI SESI BERIKUTNYA:** memindahkan status PO klien lewat
`update` biasa dari kode aplikasi **tetap berhasil dan tetap tercatat** — hanya **tanpa
pelaku dan tanpa alasan**. Jejaknya terlihat ada, isinya kosong. Karena itu aksi berdampak
**wajib** lewat RPC, dan penjaganya ada di
`tests/aksi_po_klien_jejak_keputusan.test.ts` butir (n).

---

## 3. Baris warisan: TIDAK dikarang (§16)

Baris jejak yang lahir dari jalur tanpa konteks tetap tercatat dengan pelaku `null`.
Layar menandainya **"Pelaku tidak tercatat — keputusan ini terjadi sebelum jejak pelaku
dicatat sistem"**, bukan menebak siapa.

Klasifikasinya dihitung server (`kelengkapan: 'lengkap' | 'tidak_diketahui'`), bukan
disimpulkan layar. **Terbukti** di butir (l): perpindahan status lewat jalur tanpa konteks
menghasilkan baris yang ditandai `tidak_diketahui` dengan `pelaku_nama` null.

---

## 4. Lubang yang TIDAK ditutup pekerjaan ini, dan itu disebutkan

**`data_change_audit_log` masih tidak tahu siapa.** Terukur: 598 baris, `changed_by_role`
berisi peran **database** (`authenticator` 561, `postgres` 31, `cli_login_postgres` 6), dan
**4 dari 598** punya `auth_uid`. Pekerjaan ini menambahkan lapis keputusan yang tahu pelaku;
ia **tidak memperbaiki** lapis perubahan-data generik. Memperbaikinya menyentuh sembilan
tabel lintas domain dan **wajib lewat ADR** (§20), bukan diselipkan dari Sales.

**Lima tabel ber-trigger lain belum punya pengisi**: `sales_orders`, `work_orders`,
`production_batches`, `shipments`, `customer_po_approvals` kini **punya** kolom pelaku dan
alasan, tetapi **belum ada RPC yang mengisinya**. Kolomnya tidak akan berbohong — ia akan
`null`, dan layar menandainya `tidak_diketahui`. Tetapi ini **harus dikerjakan bersama
fitur masing-masing**, bukan ditinggal terbuka tanpa catatan.

---

## 5. Temuan yang dilaporkan, bukan ditambal diam-diam

**BD-06 menyebut Sales sebagai departemen yang boleh menahan. Tidak ada peran `sales` di
sistem ini** — 16 peran di `src/lib/roles.ts`, tak satu pun sales. Departemen `sales`
**sengaja tidak diimplementasikan**; mengarang perannya akan melahirkan model peran kedua,
yang dilarang CLAUDE.md. **Ini keputusan yang perlu diambil, bukan celah yang perlu ditutup
diam-diam.**

**Pelepasan tahanan dijaga ketat ke departemen penahan**, sesuai BD-06. Konsekuensi yang
disadari: bila satu-satunya pemegang peran departemen itu tidak tersedia, PO-nya tertahan.
Aksi **OVERRIDE** untuk keadaan itu **belum dibangun** — ia butuh wewenang dan alasannya
sendiri, dan menambahkannya diam-diam berarti mengarang aturan bisnis.

**Alur "Sales mengajukan permintaan pembatalan" belum ada.** Yang dibangun adalah wewenang
**akhir**-nya (Manager/GM), sesuai BD-06. Yang belum ada adalah jalur pengajuannya — dan itu
butuh entitas permintaan tersendiri.

---

## 6. Bukti

`tests/aksi_po_klien_jejak_keputusan.test.ts` — **14 pemeriksaan, seluruhnya lulus.**
**Lima mutasi diuji; kelimanya menggigit:**

| Mutasi | Akibat |
|---|---|
| trigger berhenti membaca konteks keputusan | 2 test gagal |
| pemeriksaan departemen penahan dicabut | 2 test gagal |
| kewajiban catatan tambahan dicabut | 2 test gagal |
| kategori terikat departemen boleh dipakai siapa saja | 1 test gagal |
| wewenang pembatalan dicabut | 1 test gagal |

---

## 7. DUA LUBANG KEAMANAN yang ditemukan PENJAGA, bukan oleh pembacaan kode

Ditambahkan setelah suite regresi lengkap dijalankan. Keduanya ada di kode yang sudah saya
tulis, sudah saya baca ulang, dan sudah lulus 14 pemeriksaan buatan saya sendiri.

### 7.1 Grant bawaan Postgres ke `PUBLIC`

`tests/function_grant_security_audit.test.ts` menemukan keempat fungsi baru punya:

```
["PUBLIC=EXECUTE","anon=EXECUTE","authenticated=EXECUTE","postgres=EXECUTE","service_role=EXECUTE"]
```

**Sebabnya bukan kelalaian menulis grant — melainkan kelalaian MENCABUT.** Postgres memberi
`EXECUTE` kepada `PUBLIC` **secara bawaan** pada setiap fungsi baru, jadi
`grant execute … to authenticated` **menambah** dan sama sekali **tidak membatasi**.
Akibatnya ketiga aksi PO klien dan penolong internalnya bisa dipanggil `anon` — **tanpa login
sama sekali**.

Diperbaiki di migrasi `20260906130000`: `revoke` dari `public` dan `anon` untuk keempatnya,
dan `pasang_konteks_keputusan()` dicabut dari **semuanya** — ia penolong internal, dan
ketiga aksi tetap bisa memanggilnya karena mereka `security definer`.

### 7.2 Gerbang yang TIDAK BERBUNYI untuk pemanggil tanpa klaim

Ini yang lebih berbahaya dari keduanya, dan **tidak terlihat sama sekali dari membaca kode**.

Untuk pemanggil tanpa klaim JWT, `jwt_company_id()` dan `jwt_is_company_leadership()`
mengembalikan `NULL`. Dalam SQL:

```
v_po.company_id <> NULL   →  NULL   (bukan true)
false or NULL             →  NULL   (bukan true)
not NULL                  →  NULL   (bukan true)
```

dan **`if NULL then … end if` tidak pernah dieksekusi**. Artinya gerbang kepemilikan
perusahaan **dan** gerbang wewenang **DILEWATI** — bukan menolak.

Yang menghentikan permintaan seperti itu hari itu hanyalah `pasang_konteks_keputusan()` yang
gagal menemukan barisnya di `users`. **Itu pertahanan yang kebetulan ada, bukan gerbang yang
dirancang** — dan pertahanan kebetulan akan hilang begitu ada yang merapikan urutan
pemanggilan.

Diperbaiki dengan `is distinct from` (memperlakukan NULL sebagai **berbeda**, bukan sebagai
tidak-diketahui) dan `coalesce(…, false)`.

**Kenapa keduanya diperbaiki, bukan salah satu:** mencabut grant saja akan menutup gejalanya
sambil meninggalkan sebabnya — dan sebab itu akan menggigit lagi pada fungsi berikutnya yang
lupa dicabut grant-nya.

### 7.3 Penjaga pertama saya lulus karena alasan yang SALAH

Test `(e2a)` versi pertama hanya memeriksa **ada galat**. Diuji lewat mutasi — mengembalikan
grant ke `PUBLIC` — dan **test itu TETAP HIJAU**, karena pemanggilnya tetap ditolak, hanya
oleh pemeriksaan di dalam fungsinya, bukan oleh grant.

Diperketat menjadi memeriksa **kode penolakannya**: `42501` = *permission denied*, yaitu
penolakan di tingkat **grant**. Mutasi yang sama sekarang menggigit.

**BATAS YANG DISEBUT TERANG-TERANGAN:** perbaikan semantik NULL (7.2) adalah pertahanan
berlapis yang **tidak terjangkau test saat ini** — karena grant kini menolak `anon` sebelum
badan fungsinya sempat berjalan. Ia benar, dan ia belum punya penjaga sendiri.
