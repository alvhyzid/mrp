# SALES_CRM_DECISION_AUDIT_ARCHITECTURE

**Tanggal:** 29 Agustus 2026
**Menjawab:** §14 (prinsip FABRIX-wide), §15 (model audit keputusan), §16 (dilarang audit ganda)
**Metode:** sensus katalog Postgres proyek NYATA (`kfvtrwuuqcjfkkuqizxt`, **SELECT saja**) + sensus kode

> **KESIMPULAN LEBIH DULU, supaya tidak ada yang membangun tabel baru sebelum membaca
> sampai bawah: FABRIX SUDAH PUNYA MEKANISME AUDIT KEPUTUSAN KANONIK. Namanya
> `status_transition_log`. Ia sudah tersambung otomatis ke enam tabel lewat trigger.
> Yang dibutuhkan BD-07 bukan entitas baru — melainkan LIMA KOLOM tambahan di tabel itu,
> dan penulis yang benar-benar mengisinya.**

---

## 1. Apa yang SUDAH ada — sensus, bukan ingatan

Empat belas tabel di skema ini menyimpan riwayat atau jejak. Diurutkan menurut perannya:

### 1.1 Dua lapis yang berlaku LINTAS domain

| Tabel | Baris (data nyata) | Menjawab | Ditulis oleh |
|---|---|---|---|
| **`data_change_audit_log`** | **598** | *"Baris APA yang berubah, dari nilai apa ke nilai apa"* | trigger `log_data_change()` pada 9 tabel |
| **`status_transition_log`** | **0** | *"KEPUTUSAN apa yang memindahkan keadaan"* | trigger `enforce_status_transition()` pada 6 tabel |

Keduanya **saling melengkapi, bukan menduplikasi**: yang pertama merekam perubahan data,
yang kedua merekam perpindahan keadaan. Menambahkan yang ketiga akan melahirkan pertanyaan
yang tidak punya jawaban tunggal — *"riwayat keputusan itu dibaca dari mana?"*

### 1.2 Riwayat khusus per domain

`build_task_approval_history` · `build_task_urgency_history` · `company_settings_history` ·
`customer_po_approvals` · `document_access_log` · `employee_cost_category_history` ·
`goods_receipt_overage_log` · `kamus_term_history` · `kpi_registry_history` ·
`work_order_reopen_log` · `attendance_events`

---

## 2. Lubang yang TERUKUR di lapis generik

**`data_change_audit_log` tidak bisa menjawab "SIAPA".** Ini bukan dugaan:

```
changed_by_role  'authenticator'       -> 561 baris   (peran DATABASE, bukan peran FABRIX)
changed_by_role  'postgres'            ->  31 baris
changed_by_role  'cli_login_postgres'  ->   6 baris
punya changed_by_auth_uid              ->   4 dari 598 baris
```

Sebabnya ada di `log_data_change()`: ia menulis `session_user` — yaitu peran **Postgres**,
bukan peran aplikasi — dan `auth.uid()`, yang **kosong** setiap kali penulisan dilakukan
lewat service role. Karena hampir seluruh jalur aplikasi FABRIX memakai service role,
**99,3% jejaknya tidak punya pelaku**.

> Ini persis yang membuat BD-07 tidak bisa dipenuhi dengan "kan sudah ada audit log".
> Audit log-nya memang ada, dan ia memang tidak tahu siapa.

---

## 3. `status_transition_log` diadu dengan syarat BD-07

BD-07 menuntut setiap keputusan berdampak bisa menjawab: **SIAPA · APA · KAPAN · KENAPA ·
DARI KEADAAN APA · KE KEADAAN APA.**

| Syarat BD-07 | Sudah ada? | Kolom |
|---|---|---|
| tindakan/keputusan | **ya** | `table_name` + perpindahannya sendiri |
| keadaan sebelum | **ya** | `from_status` |
| keadaan sesudah | **ya** | `to_status` |
| ID pelaku | **ya** | `changed_by` |
| **nama pelaku (snapshot)** | **TIDAK** | — |
| **peran pelaku (snapshot)** | **TIDAK** | — |
| **departemen pelaku (snapshot)** | **TIDAK** | — |
| waktu | **ya** | `changed_at` |
| **kategori alasan** | **TIDAK** | — |
| catatan tambahan | **sebagian** | `reason` (satu kolom teks bebas) |
| entitas terkait | **ya** | `table_name` + `record_id` |
| **rujukan persetujuan/tinjauan** | **TIDAK** | — |

**Lima kolom kurang.** Bukan satu tabel kurang.

**Dan satu cacat yang lebih halus:** kolom `reason` **sudah ada** dan **selalu bernilai
`null`** — `enforce_status_transition()` menuliskannya sebagai literal `null`. Jadi tempat
untuk alasan sudah disediakan, lalu tidak pernah diisi. Itu bentuk "kolom yang tidak pernah
diisi" yang sudah punya presedennya sendiri di proyek ini (PRD-12).

---

## 4. Cetakan snapshot pelaku SUDAH ADA di rumah sendiri

§3 perintah menuntut snapshot pelaku supaya riwayat lama tetap menunjukkan kapasitas
seseorang **saat keputusan dibuat**, bukan jabatannya hari ini.

Pola itu **sudah dipakai** di FABRIX — `company_settings_history`:

```
changed_by · changed_by_name · changed_by_role · reason · changed_at
```

**Jadi tidak ada yang perlu ditemukan.** Yang perlu dilakukan adalah **meluaskan cetakan yang
sudah terbukti**, ditambah `department` yang belum ada di cetakan itu.

---

## 5. Keputusan arsitektur yang diusulkan

> **PERLUAS `status_transition_log`. JANGAN membuat entitas keputusan baru.**

Mengikuti tabel keputusan CLAUDE.md ("Dilarang Membangun Sistem Identitas/Peran/Persetujuan
PARALEL"): keadaan yang ada **memenuhi sebagian** → jawabannya **PERLUAS yang ada**.

Kolom yang ditambahkan:

| Kolom | Alasan |
|---|---|
| `actor_name_snapshot` | riwayat tidak boleh berubah saat nama berubah |
| `actor_role_snapshot` | kapasitas saat keputusan dibuat |
| `actor_department_snapshot` | §3; menjawab "departemen mana yang menahan" |
| `reason_category` | §2: kategori yang bisa disaring, bukan teks bebas |
| `approval_reference_id` | §4: menyambungkan keputusan ke persetujuannya |

`reason` yang sudah ada dipakai sebagai **catatan tambahan**, sesuai §2 (kategori + catatan).

### 5.1 KENDALA YANG MENENTUKAN KAPAN KOLOM INI BOLEH LAHIR

**Kolom-kolom itu TIDAK BOLEH ditambahkan sendirian.**

Aturan CLAUDE.md: *"Status, alert, tombol, atau penanda baru HANYA ditambahkan bersama
PEMICU dan AKIBATNYA. Menambahkan nilai yang tidak pernah dipicu kode mana pun adalah
CACAT, bukan persiapan."* Kolom audit yang selalu `null` adalah bentuk yang sama persis —
dan `status_transition_log.reason` **sudah membuktikannya**: ia ada sejak awal, dan **nol
baris pernah mengisinya**.

**Karena itu kelima kolom itu lahir BERSAMA penulis pertamanya**, yaitu WS-S04 (tahan /
lepas / batalkan PO klien) — bukan sebelumnya.

### 5.2 Bagaimana alasan & pelaku SAMPAI ke trigger

Kendala teknis yang nyata: trigger tidak menerima parameter, dan PostgREST tidak
mengizinkan dua pernyataan dalam satu transaksi dari klien. Jadi alasan dan pelaku
**tidak bisa** dititipkan dari kode aplikasi ke trigger lewat jalur biasa.

Yang berlaku: **setiap keputusan berdampak dilakukan lewat FUNGSI BASIS DATA**, dan fungsi
itulah yang mengisi kelima kolom sebelum melakukan perpindahan statusnya. Pola ini sudah
terbukti di proyek ini — `process_customer_purchase_order()` dan
`create_shipment_with_signature()` bekerja persis begitu, dan WS-S03 baru saja memperkuatnya
jadi satu-satunya jalur.

**Konsekuensi yang harus disadari, bukan ditemukan belakangan:** ini berarti tombol
Tahan/Lepas/Batalkan **wajib** lewat RPC, bukan lewat `update` dari kode aplikasi.

---

## 6. ADR PROPOSAL — prinsip FABRIX-wide (§14)

> **Diusulkan, TIDAK diterapkan.** §14 melarang mengubah Finance, PPIC, Manufacturing,
> Quality, Procurement, dan Logistics secara langsung dalam batch ini.

### ADR-XX — Setiap keputusan bisnis berdampak wajib bisa dipertanggungjawabkan

**Pernyataan.** Setiap keputusan bisnis yang mengubah jalannya sebuah proses wajib dapat
menjawab **siapa · keputusan apa · kapan · alasan · dari keadaan apa · ke keadaan apa**,
dan jawabannya tersimpan **di satu tempat kanonik**, bukan tersebar per domain.

**Di mana pola ini SUDAH ADA** (sensus 29 Agu 2026):
`status_transition_log` (6 tabel, ber-trigger) · `customer_po_approvals` (persetujuan
tiga departemen) · `company_settings_history` (snapshot pelaku terlengkap) ·
`work_order_reopen_log` (alasan wajib) · `employee_cost_category_history` (bertanggal berlaku).

**Di mana pola ini BELUM ADA:**
- Kolom `reason` di `status_transition_log` **tidak pernah diisi** — berlaku untuk **seluruh
  enam tabel**, termasuk Work Order, Batch Produksi, dan Pengiriman.
- Snapshot pelaku hanya ada di `company_settings_history`; enam tabel ber-trigger tidak punya.
- `data_change_audit_log` generik tidak tahu peran aplikasi maupun pelakunya (§2 di atas).

**Dampak lintas domain bila ADR ini disetujui:** Manufacturing (Work Order dibuka kembali,
batch dibatalkan), Logistics (pengiriman dibatalkan), Finance (kunci ulang baseline),
Procurement (PO dibatalkan) seluruhnya akan mewarisi kolom yang sama — **tanpa satu pun
tabel baru**, karena keenamnya sudah memakai trigger yang sama.

**Yang WAJIB dilakukan sebelum ADR ini diterapkan ke domain lain:** tiap domain diperiksa
satu per satu untuk memastikan keputusannya memang melewati perpindahan status. Keputusan
yang **tidak** mengubah status — misalnya penetapan golongan biaya karyawan — tidak tertangkap
trigger ini dan butuh jalurnya sendiri. **Menganggap ADR ini otomatis mencakup semuanya
adalah cara paling mudah membuatnya terlihat berlaku padahal tidak.**

---

## 7. Yang TIDAK boleh dibuat

Sesuai §16, dan dicatat supaya sesi berikutnya tidak mengulanginya:

- **JANGAN** membuat `sales_decision_log`, `sales_approval_log`, atau `sales_activity_log`.
- **JANGAN** membuat layanan audit global baru.
- **JANGAN** menambahkan kolom audit tanpa penulis yang benar-benar mengisinya di giliran
  yang sama.
