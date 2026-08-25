# AR-0 — Inventaris Keadaan Sekarang, bagian NAVIGASI

**Dibuat 25 Agu 2026. Audit BACA-SAJA — nol perubahan kode aplikasi.**
Seluruh isi dokumen ini berasal dari **berkas repo dan dari peramban sungguhan**, bukan dari
dokumen arsitektur dan bukan dari ingatan.

## Cara status di sini boleh dipercaya

Setiap baris punya salah satu dari dua dasar, dan dasarnya disebut:

- **Terverifikasi peramban** — halamannya benar-benar dibuka dalam keadaan sudah masuk, dan
  isinya terbaca. Dipakai untuk 31 halaman.
- **Terverifikasi berkas** — route-nya ada di App Router. Membuktikan halamannya ADA;
  **tidak** membuktikan ia berfungsi.

Verifikasi peramban memakai **tenant fixture yang dibuat dan dihapus sendiri oleh sesi ini**
(`NavAuditTestCorp`), bukan data PT ITM. Pembersihannya dilaporkan di bagian akhir.

---

## 1. Registry route — 39 halaman yang benar-benar ada

Diambil dari `app/**/page.tsx`, bukan dari dokumen.

### 1a. Halaman publik (7) — tanpa login

| Route | Halaman | Status |
|---|---|---|
| `/` | Beranda | 🔵 Carbon, disetujui pemilik produk |
| `/login` | Masuk | 🔵 Carbon, disetujui |
| `/register` | Daftar | 🔵 Carbon, disetujui |
| `/forgot-password` | Lupa kata sandi | 🔵 Carbon, disetujui |
| `/reset-password` | Atur ulang kata sandi | 🔵 Carbon |
| `/invite/accept` | Terima undangan | 🔵 Carbon |
| `/pod/[token]` | Konfirmasi penerimaan barang | 🔵 Carbon — **URL tercetak di QR surat jalan, tidak boleh putus** |

### 1b. Halaman di dalam aplikasi (32)

Ketiga puluh satu di antaranya **dibuka sungguhan di peramban** dalam keadaan sudah masuk.
Satu (`/shipments/[id]/surat-jalan`) butuh nomor pengiriman nyata, jadi hanya terverifikasi
berkas.

| Route | Termuat? | Catatan dari isi yang terbaca |
|---|---|---|
| `/dashboard` | 🔵 ya | "Selamat datang" |
| `/items` | 🔵 ya | |
| `/boms` | 🔵 ya | keadaan kosong tampil |
| `/routing` | 🔵 ya | keadaan kosong tampil |
| `/work-orders` | 🔵 ya | |
| `/sales-orders` | 🔵 ya | keadaan kosong tampil |
| `/customers` | 🔵 ya | |
| `/customer-purchase-orders` | 🔵 ya | |
| `/purchasing` | 🔵 ya | |
| `/warehouse` | 🔵 ya | isi sangat pendek (314 huruf) — **perlu ditinjau** |
| `/shipments` | 🔵 ya | isi sangat pendek (314 huruf) — **perlu ditinjau** |
| `/production` | 🔵 ya | |
| `/ppic` | 🔵 ya | isi terkaya (1.973 huruf) |
| `/hr` | 🔵 ya | |
| `/attendance` | 🔵 ya | isi sangat pendek (314 huruf) — **perlu ditinjau** |
| `/operating-profit` | 🔵 ya | |
| `/kpi`, `/kpi/saya` | 🔵 ya | |
| `/documents` | 🔵 ya | |
| `/kamus` | 🔵 ya | |
| `/whats-new` | 🔵 ya | isi terpanjang (4.566 huruf) |
| `/build-tasks` | 🔵 ya | |
| `/ai-readiness` | 🔵 ya | **menulis 6 baris saat dibuka** — lihat §4 |
| `/ai-project` | 🔵 ya | |
| `/process-mining` | 🔵 ya | |
| `/company` | 🔵 ya | |
| `/company/setelan` | 🔴 **TIDAK** | **dialihkan ke /login padahal sudah masuk** — lihat §3 |
| `/team` | 🔵 ya | |
| `/profile` | 🔵 ya | |
| `/debug` | 🔵 ya | alat internal, tidak ada di menu |
| `/test-tenant` | 🔵 ya | alat internal, isi 21 huruf |
| `/shipments/[id]/surat-jalan` | ⚫ | butuh pengiriman nyata; hanya terverifikasi berkas |

---

## 2. Konfigurasi navigasi sekarang

Ada di `src/features/auth/components/AppShell.tsx` sebagai `NAV_SECTIONS` — **berkas
TypeScript bertipe, bukan tabel database**. Ini sudah sesuai aturan D.5 yang diminta; tidak
perlu dipindahkan.

- **11 kelompok, 29 item menu.**
- **Ikon sudah memakai ikon Carbon**, bukan emoji — aturan D.3 sudah terpenuhi hari ini.
- Penyaringan peran lewat fungsi `visible(role)`.

**Temuan penting: 20 dari 29 item memakai `visible: () => true`** — artinya tampil untuk
seluruh peran. Penyaringan peran yang sesungguhnya hanya berlaku di 9 item.

---

## 3. TEMUAN PALING SERIUS — layar pilot Carbon tidak bisa dibuka sama sekali

**`/company/setelan` mengalihkan ke halaman masuk meskipun pengguna sudah masuk.**

Sebabnya pasti, diperiksa di kode:

- `SetelanPerhitunganPage` memanggil `fetch('/api/company/settings')` **tanpa header
  Authorization**.
- `getCurrentUser` di `src/lib/supabaseServer.ts` **hanya** menerima Bearer token
  (`parseBearerToken` melempar galat bila header tidak ada). **Tidak ada jalur cookie.**
- Jadi API menjawab 401, dan halamannya sendiri yang memanggil `router.replace('/login')`.

Seluruh halaman lain mengambil `access_token` dari sesi Supabase lalu mengirimnya sebagai
Bearer. Halaman ini tidak.

**Kenapa ini tidak ketahuan lebih awal, dan itu bagian yang perlu dicatat**: seluruh
pemeriksaan layar ini dilakukan terhadap **CSS hasil build** dan **kode sumber** — tipografi,
jarak, sudut, token. Semuanya benar. Yang tidak pernah dilakukan adalah **membuka halamannya
dalam keadaan sudah masuk**. Pengukuran membuktikan gayanya benar; ia tidak bisa membuktikan
halamannya bisa dibuka.

Test MST-26 tetap hijau karena ia menguji **lapisan server** dan mengirim Bearer token sendiri
— batas itu memang sudah ditulis di kepala berkas testnya.

---

## 4. Halaman yang MENULIS saat hanya dibuka

Perusahaan fixture yang dibuat untuk audit ini **tidak bisa dihapus** pada percobaan pertama,
karena tertahan kekangan kunci asing dari tabel `ai_capability_status`.

**Enam baris tertulis ke sana hanya karena halaman `/ai-readiness` dibuka.** Nol tombol
ditekan.

Ini kelas cacat yang **sudah tercatat di CLAUDE.md** sejak Sesi 0/0B/0C — "aksi yang terlihat
read-only tapi menulis di baliknya" — dan dulu ditemukan pada `getMarginWatch` serta
`getPlanningFeasibility`. Keduanya sudah diperbaiki. **Ini contoh ketiga, di tempat yang
berbeda, dan belum diperbaiki.**

Konsekuensi nyata yang sudah terjadi: prosedur pembersihan fixture yang selama ini dipakai
**tidak cukup** — ia menghapus `users` lalu `companies`, dan tidak tahu tabel lain bisa terisi
sendiri.

---

## 5. Fitur yang ada tapi tidak punya rumah di navigasi (§32)

| Halaman | Rekomendasi |
|---|---|
| `/debug` | **Jangan masuk menu publik.** Alat internal. Layak muncul di mode internal pemilik produk |
| `/test-tenant` | Sama seperti `/debug` |
| `/shipments/[id]/surat-jalan` | **Benar tidak ada di menu** — ia halaman cetak yang dicapai dari baris pengiriman, bukan tujuan navigasi |

**Kebalikannya — item menu yang menunjuk halaman tidak ada: NOL.** Setiap dari 29 item menu
menunjuk halaman yang benar-benar ada. Ini kondisi awal yang sehat dan **wajib dipertahankan**
saat navigasi disusun ulang.

**119 endpoint API** ada di sistem, mencakup 50 kelompok kemampuan. Sebagian besar sudah punya
layar; yang perlu diperiksa saat menyusun menu adalah kelompok yang belum, misalnya
`stock-alerts`, `production-disruptions`, `document-signatures`, `goods-receipts`.

---

## 6. Peran: berapa yang benar-benar punya pengguna

Sistem mengenal **16 peran**. Di PT ITM:

| Peran | Akun | Bukan `@debug.mrp` |
|---|---:|---:|
| company_admin | 1 | **0** |
| hr_manager | 1 | **0** |
| ppic_manager | 1 | **0** |
| production_staff | 1 | **0** |
| admin_staff | 1 | **0** |
| finance_manager | 1 | **0** |
| warehouse_manager | 1 | **0** |
| **9 peran lainnya** | **0** | **0** |

**Tujuh akun, seluruhnya akun uji. Nol akun manusia sungguhan.**

Artinya menyusun navigasi untuk 16 peran berarti merancang untuk sesuatu yang belum ada.
Sejalan dengan fakta proyek yang baru ditetapkan pemilik produk (sistem diselesaikan dulu, baru
dipakai), **navigasi cukup satu mode**.

---

## 7. Pembersihan fixture

Dibuat: 1 perusahaan `NavAuditTestCorp` (id 7667), 1 akun `navaudit.admin@debug.mrp`.
Dihapus: akun auth, baris `users`, **6 baris `ai_capability_status`** (yang lahir sendiri),
dan barisan `companies`.

Bukti memakai **pola fixture, bukan jumlah total**, sesuai aturan proyek:

| Pemeriksaan | Hasil |
|---|---|
| company bernama `%NavAudit%` | **0** |
| company bernama `%TestCorp%` | **0** |
| user beremail `%navaudit%` | **0** |
| `ai_capability_status` untuk company 7667 | **0** |

Data PT ITM **hanya dibaca**; tidak ada satu pun tulisan ke sana.
