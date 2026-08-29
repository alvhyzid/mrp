# SALES_CRM_SECURITY_RECONCILIATION

**Tanggal:** 29 Agustus 2026 · **Menjawab:** §8–§12, §38 perintah eksekusi
**Kode kerja:** SEC-21 · **Klasifikasi:** **P0 — TEMUAN NYATA, DIBUKTIKAN, DITUTUP**

---

## 1. Temuan: pemanggil TANPA LOGIN membuat Sales Order sungguhan

Bukan analisis, bukan dugaan. Dijalankan terhadap tenant uji di staging, memakai **kunci
anon saja**:

```
anon.rpc('process_customer_purchase_order', { p_customer_purchase_order_id, p_production_plant_id })
  → { data: 901, error: null }
  → SATU Sales Order benar-benar tercipta di perusahaan yang bukan miliknya
```

Perusahaannya dibuat khusus untuk percobaan ini, dan dibersihkan setelahnya.

**Ini fungsi yang batch sebelumnya baru saja saya jadikan JALUR KANONIK pembuatan Sales
Order.** Lubangnya sudah ada sebelum itu — fungsinya memang selalu terbuka — tetapi
sebelumnya ia jalur mati. WS-S03 menghidupkannya, dan dengan begitu menaikkan
kegentingannya dari laten menjadi nyata.

---

## 2. Dua sebab, dan keduanya harus ditutup

### 2.1 Hak eksekusi bawaan

Postgres memberi `EXECUTE` kepada `PUBLIC` **secara bawaan** pada setiap fungsi baru.
Sensus seluruh skema: **11 fungsi `SECURITY DEFINER` dapat dipanggil `anon`**.

### 2.2 Gerbang yang GAGAL TERBUKA — dan ini tidak terlihat dari membaca kode

Gerbangnya ditulis begini, dan terbaca benar:

```sql
if v_company_id <> public.jwt_company_id() then raise exception '...'; end if;
if not public.jwt_can_view_financial_data() then raise exception '...'; end if;
```

Tanpa JWT, kedua fungsi itu bernilai `NULL`, dan dalam SQL:

```
v_company_id <> NULL   →  NULL      (bukan true)
not NULL               →  NULL      (bukan true)
```

`if NULL then … end if` **tidak pernah dieksekusi**. Jadi gerbang kepemilikan perusahaan
**dan** gerbang wewenang **dilewati** — bukan menolak. Keduanya **gagal terbuka**, persis
kebalikan dari yang seharusnya.

> **Kenapa ini layak diingat lebih dari sekadar satu perbaikan:** kode ini sudah dibaca
> ulang berkali-kali, lulus typecheck, dan lulus seluruh test buatan sendiri. Yang
> menangkapnya adalah **menjalankan** percobaan sungguhan sebagai penyerang.

---

## 3. Perbaikan

### 3.1 Satu gerbang, bukan menulis ulang enam fungsi

```sql
create or replace function public.wajib_identitas_tenant() ...
  if auth.uid() is null            then raise exception '…' using errcode='28000'; end if;
  if public.jwt_company_id() is null then raise exception '…' using errcode='28000'; end if;
```

**DUA hal diperiksa, bukan satu.** `auth.uid()` saja tidak cukup: pengguna yang sudah login
tetapi klaim `company_id`-nya kosong akan lolos pemeriksaan identitas, lalu membuka lubang
NULL yang sama di gerbang berikutnya.

Badan keenam fungsi diambil **apa adanya** dari basis data, lalu diberi **satu pernyataan**
di awal. Logika bisnisnya tidak disentuh. Perbandingan `<>` terhadap `jwt_company_id()`
sekaligus diubah jadi `is distinct from` sebagai lapis kedua.

### 3.2 Hak eksekusi dicabut — hanya setelah diperiksa terhadap SELURUH kebijakan RLS

| Fungsi | Kebijakan RLS yang memakainya | Tindakan |
|---|---|---|
| `process_customer_purchase_order` | **0** | `anon` dicabut |
| `get_sales_order_margin` | **0** | `anon` dicabut |
| `get_monthly_operating_profit` | **0** | `anon` dicabut |
| `get_work_order_labor_cost_total` | **0** | `anon` dicabut |
| `get_production_batch_labor_cost_total` | **0** | `anon` dicabut |
| `get_production_batch_labor_cost_detail` | **0** | `anon` dicabut |
| `is_super_admin_user` | **6** | **TIDAK disentuh** |
| `user_has_no_company` | **1** | **TIDAK disentuh** |
| `employee_belongs_to_current_user` | **2** | **TIDAK disentuh** |
| `employee_matches_managed_department` | **1** | **TIDAK disentuh** |
| `confirm_delivery` | 0 | **TIDAK disentuh** — jalur POD publik yang memang tanpa login |

**Empat yang dipakai RLS sengaja tidak disentuh**: mencabut haknya akan **memadamkan
kebijakan yang sedang berjalan** — risiko lebih besar daripada yang sedang ditutup.
Keempatnya berbentuk berbeda (menerima `auth_uid` sebagai **parameter**) dan sudah tercatat
menunggu perancangan ulang. **Dicatat sebagai SEC-22, bukan dikerjakan diam-diam.**

Hasil sesudah: **11 → 5** fungsi `SECURITY DEFINER` terbuka `anon`, dan kelimanya punya
alasan tertulis.

> **KOREKSI ANGKA, 29 Agu 2026 — laporan giliran sebelumnya kurang tepat.** Kalimat
> "11 → 5 fungsi terbuka anon" benar **hanya untuk fungsi `SECURITY DEFINER`**. Disensus
> ulang tanpa penyaring itu: dari **53** fungsi non-trigger, **14** dapat dipanggil `anon` —
> lima `SECURITY DEFINER` di atas, ditambah sembilan yang **BUKAN** `SECURITY DEFINER`
> (`jwt_*`, `bom_component_creates_cycle`, `work_order_is_blocked`).
>
> Kesembilan itu berjalan **sebagai pemanggilnya**, sehingga RLS tabel yang dirujuknya tetap
> berlaku — itulah alasan tertulis yang sudah ada di allowlist, dan alasan itu tetap sah.
> Yang keliru bukan keputusannya, melainkan **angka yang saya laporkan tanpa menyebut
> penyaringnya**.

---

## 4. Bukti bahwa lubangnya benar-benar tertutup

Percobaan **yang sama persis**, diulang sesudah perbaikan:

```
anon buat Sales Order   → 42501 permission denied for function process_customer_purchase_order
Sales Order tercipta    → 0
anon get_sales_order_margin        → 42501
anon get_monthly_operating_profit  → 42501
anon get_work_order_labor_cost_total → 42501
```

Dan jalur yang sah **tetap bekerja**: 30 pemeriksaan pada `jalur_kanonik_sales_order`,
`aksi_po_klien_jejak_keputusan`, dan `function_grant_security_audit` lulus.

---

## 5. Matriks keamanan sembilan skenario (§10)

`tests/matriks_keamanan_sales.test.ts` — **8 pemeriksaan**, seluruhnya lulus.

| # | Skenario | Gerbang yang DIMAKSUD | Bukti |
|---|---|---|---|
| 1 + 7 | tanpa identitas / identitas NULL | hak eksekusi | `42501` **dan** nol Sales Order tercipta |
| 8 | login TANPA konteks perusahaan | `wajib_identitas_tenant` | `28000` + pesan menyebut "konteks perusahaan" |
| 2 | login, perusahaan LAIN | kepemilikan | pesan "tidak ditemukan di perusahaan Anda" + nol SO |
| 4 | peran salah | wewenang | pesan menyebut `company_admin atau general_manager` |
| 3 | departemen salah | wewenang departemen | Finance ditolak membatalkan |
| 9 | izin/kategori tidak dikenal | katalog alasan | pesan "tidak dikenali" |
| 5 + 6 | perusahaan benar + peran benar | — | **BERHASIL**, SO tercipta di perusahaan yang benar |
| 10 | kebocoran data keuangan | hak eksekusi | kelima fungsi `42501` |

**Skenario 1 dan 7 sengaja ditulis sebagai SATU test**, karena di sistem ini "anonim" dan
"identitas NULL" adalah keadaan yang sama. Menuliskannya sebagai dua akan memberi kesan
cakupan yang lebih luas daripada kenyataannya.

**Skenario 5+6 ada supaya matriks ini tidak bisa lulus dengan cara terburuk:** menolak
semua orang. Pengaman yang menolak semuanya bukan pengaman, melainkan kerusakan yang
kebetulan terlihat aman.

### §11 — tiap penolakan diperiksa ALASANNYA

Setiap test memeriksa **kode/pesan** penolakan, bukan sekadar "ada galat". Ini bukan
kehati-hatian teoretis: pada batch ini, versi pertama sebuah test keamanan **tetap hijau**
saat lubangnya sengaja dikembalikan — karena yang menolak ternyata lapisan lain.

**Dua mutasi diuji, keduanya menggigit tepat sasaran:**

| Mutasi | Yang gagal |
|---|---|
| `wajib_identitas_tenant()` dijadikan tidak melakukan apa-apa | skenario **8** |
| hak `anon` dikembalikan ke dua fungsi | skenario **1+7** dan **10** |

---

## 6. Pencadangan (§12) — diuji, bukan diasumsikan

`decision_reason_categories` sempat **tidak ikut tercadangkan**; ditangkap
`tests/backup_table_list_lengkap.test.ts`, dan sudah ditambahkan.

Tidak berhenti di situ. **Ekspor sungguhan dijalankan untuk seluruh 92 tabel di daftar**:
nol yang gagal, dan tabel baru itu mengekspor 26 baris.

**BATAS YANG DISEBUT TERANG-TERANGAN:** yang terbukti adalah **ekspor**, bukan
**pemulihan**. Skrip yang ada mengekspor JSON; **tidak ada jalur restore otomatis**, jadi
"dapat dipulihkan" **belum** terbukti dan tidak boleh diklaim. Dicatat sebagai temuan
tersendiri.

---

## 7. Cacat di penolong test bersama, ditemukan dan diperbaiki di kelasnya

Matriks ini sempat **tidak bisa berjalan sama sekali**: `ensureAuthUser` melempar galat yang
menyatakan "kondisi yang tidak boleh terjadi".

Sebabnya terukur: **Supabase Auth menyimpan email dalam huruf kecil**, sedangkan `createUser`
mencocokkan email **tanpa membedakan besar-kecil huruf**. Fixture ber-email `sec21.bosA@…`
menghasilkan keadaan yang tampak mustahil — `createUser` berkata "sudah terdaftar", lalu
pencarian **case-sensitive** tidak menemukannya. Diperiksa di `auth.users`: yang tersimpan
`sec21.bosa@debug.mrp`.

**Diperbaiki di penolongnya**, bukan di berkas test saya — 23 berkas sebelumnya kebetulan
memakai huruf kecil semua, jadi cacat ini menunggu tanpa gejala sampai berkas pertama yang
memakai huruf besar lahir.

---

## 7b. SEC-21 TERNYATA BELUM TUNTAS — ditemukan verifikasi independen (SEC-23)

Giliran berikutnya diminta **memverifikasi ulang secara independen**, tidak menganggap
pekerjaan selesai hanya karena handoff menyatakannya. Verifikasi itu **membantah laporan
saya sendiri**.

**Percobaan:** sesi yang klaimnya **membawa `company_id`** tetapi **tidak membawa
`app_role`**:

```
set_config('request.jwt.claims', '{"sub":"…","company_id":"<id>"}', true)
select process_customer_purchase_order(<po>, <plant>)
  → TIDAK DITOLAK, satu Sales Order tercipta
```

**Sebabnya kelas yang sama, di gerbang yang berbeda.** `wajib_identitas_tenant()` memeriksa
**identitas** dan **perusahaan** — bukan **peran**. Sementara
`jwt_is_company_leadership()` → `NULL in (…)` = `NULL` → `not NULL` = `NULL` → `if NULL`
tidak dieksekusi → **gerbang peran dilewati**.

**Pelajaran yang lebih berharga daripada perbaikannya:** menambal satu gerbang **tidak
menutup kelasnya**. Lubang kedua ini lahir dari pola yang sama persis dengan lubang pertama,
dan ia tetap ada **setelah lubang pertama dilaporkan tertutup**.

**Perbaikan (SEC-23):** setiap `if not public.jwt_xxx()` menjadi
`if not coalesce(public.jwt_xxx(), false)` — peran yang tidak diketahui diperlakukan
**tidak berwenang**, bukan "belum tentu tidak berwenang". Disensus ke seluruh 53 fungsi:
hanya **tiga** yang memakai pola itu, dan ketiganya diperbaiki.

**Bukti sesudah:**

| Skenario | Sales Order tercipta |
|---|---|
| `company_id` ada, `app_role` **tidak ada** | **0** — ditolak |
| `company_id` ada, `app_role` **salah** | **0** — ditolak |
| `company_id` ada, `app_role` **benar** | **1** — berhasil |

**Pengawas kelasnya dibangun, bukan hanya kasusnya:** tampilan `pg_proc_risiko_null`
menyisir **seluruh** fungsi dan harus selalu kosong; dijaga butir (11) di
`tests/matriks_keamanan_sales.test.ts`. Mutasi diuji: mengembalikan pola lama ke satu
fungsi → penjaga langsung berbunyi.

## 8. Gerbang keamanan (§38) — status jujur

| Syarat | Status |
|---|---|
| wewenang diverifikasi eksplisit | **YA** — skenario 2, 3, 4 |
| perilaku anonim diverifikasi | **YA** — skenario 1+7, 10 |
| perilaku NULL/UNKNOWN diverifikasi | **YA** — skenario 8, 9 |
| isolasi tenant diverifikasi | **YA** — skenario 2, dengan nol SO tercipta |
| hak eksekusi fungsi diverifikasi | **YA** — sensus 11 → 5, kelimanya beralasan |
| test membuktikan gerbang yang DIMAKSUD | **YA** — kode penolakan diperiksa; 2 mutasi menggigit |
| bukti terkumpul | **YA** |

**SEC-21 memenuhi gerbang keamanan §38.** Yang **tidak** memenuhinya dan karena itu tidak
diklaim: pemulihan pencadangan (§6 di atas) dan empat fungsi RLS yang sengaja tidak
disentuh (SEC-22).
