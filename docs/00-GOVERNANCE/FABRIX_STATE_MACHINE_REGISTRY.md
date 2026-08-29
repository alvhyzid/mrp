# FABRIX STATE MACHINE REGISTRY
## Canonical lifecycle governance

Every transactional entity must define:
- states
- allowed transitions
- actor/permission
- approval requirement
- side effects
- idempotency behavior
- audit event
- terminal states

### Baseline examples
Sales Order:
DRAFT → SUBMITTED → VALIDATING → PENDING_APPROVAL → CONFIRMED → IN_FULFILLMENT → PARTIALLY_FULFILLED → FULFILLED → CLOSED
Terminal: CANCELLED, REJECTED

Purchase Order:
DRAFT → APPROVED → SENT → CONFIRMED → PARTIALLY_RECEIVED → FULLY_RECEIVED → CLOSED
Terminal: CANCELLED

Production Order:
PLANNED → FIRM → RELEASED → SCHEDULED → READY → IN_EXECUTION → COMPLETED → CLOSED
Exceptions: ON_HOLD, BLOCKED, CANCELLED

Quality Inspection:
PENDING → IN_PROGRESS → PASS / FAIL / CONDITIONAL → CLOSED

Do not copy these blindly into code. Reconcile with current implementation and approved domain architecture.


---

# YANG BENAR-BENAR DITEGAKKAN — 29 Agustus 2026

> Bagian di atas adalah **contoh baseline** dan **melarang dirinya disalin mentah**.
> Bagian ini adalah **kenyataan**, dibaca dari tabel `status_transition_rules` di basis
> data produksi. Aturannya hidup sebagai **data**, ditegakkan trigger
> `enforce_status_transition`, dan setiap perpindahan dicatat ke `status_transition_log`.

## Enam entitas ber-mesin status

| Entitas | Transisi yang sah |
|---|---|
| **work_orders** (9) | `planned→in_progress` · `planned→cancelled` · `in_progress→paused` · `in_progress→completed` · `in_progress→cancelled` · `paused→in_progress` · `paused→cancelled` · `completed→in_progress` · `cancelled→in_progress` |
| **customer_purchase_orders** (5) | `new→on_hold` · `new→cancelled` · `new→processed` · `on_hold→new` · `on_hold→cancelled` |
| **sales_orders** (4) | `confirmed→in_production` · `confirmed→cancelled` · `in_production→completed` · `in_production→cancelled` |
| **production_batches** (4) | `planned→in_progress` · `planned→cancelled` · `in_progress→completed` · `in_progress→cancelled` |
| **shipments** (3) | `draft→shipped` · `draft→cancelled` · `shipped→delivered` |
| **customer_po_approvals** (2) | `pending→approved` · `pending→rejected` |

## Yang tidak terlihat dari tabel, dan penting

**`status_transition_log` berisi NOL baris.** Belum pernah ada satu perpindahan status pun
di seluruh sistem ini — konsisten dengan tenant nyata yang belum memakai inti manufaktur.
Jadi mesin statusnya **ditegakkan tetapi belum pernah dilalui**.

**Terminal yang tersirat, bukan tertulis:** `cancelled` pada PO klien dan Sales Order tidak
punya transisi keluar → **pembatalan final**. `processed` pada PO klien juga tidak punya
transisi keluar → PO yang sudah jadi Sales Order tidak bisa ditahan atau dibatalkan lagi.

**`work_orders` mengizinkan `completed→in_progress` dan `cancelled→in_progress`** — buka
kembali. Itu sengaja, dan jejaknya wajib (`work_order_reopen_log`).

## Konflik yang BELUM diputuskan — AD-03

Baseline di atas mencantumkan **11 nama** untuk Sales Order; basis data memuat **4**.
Diperiksa, dan jaraknya **bukan** tujuh state yang hilang:

| Nama di baseline | Kenyataan |
|---|---|
| `DRAFT` · `SUBMITTED` · `VALIDATING` · `PENDING_APPROVAL` · `REJECTED` | **sudah ada, di entitas SEBELUMNYA** — PO klien + `customer_po_approvals` |
| `IN_FULFILLMENT` · `PARTIALLY_FULFILLED` · `FULFILLED` | menurut **AD-01** milik Manufacturing/Logistics — **diturunkan**, bukan disimpan |
| `CONFIRMED` · `CANCELLED` · `CLOSED` | ada (`confirmed`, `cancelled`, `completed`) |

**AD-03 masih TERBUKA.** Sampai diputuskan, **dilarang menambah status Sales Order** —
dan pekerjaan yang membutuhkan tahap baru (mis. permintaan pembatalan) memakai **entitas
tersendiri**, bukan status baru. Contoh yang sudah berjalan: `cancellation_requests`.

## Aturan yang berlaku sekarang

1. Perpindahan status **hanya** lewat fungsi basis data yang memasang konteks keputusan —
   `update` biasa tetap berpindah tetapi **tanpa pelaku dan tanpa alasan**.
2. Status baru **hanya** ditambahkan bersama pemicu dan akibatnya. Enum tanpa pemicu adalah
   cacat; kelas ini sudah terjadi **enam kali** di proyek ini.
3. Aturan transisi hidup sebagai **data** di `status_transition_rules`, bukan sebagai
   `if` di kode aplikasi.


---

## Pembaruan 29 Agustus 2026 (malam) — Sales Order bisa ditutup

**Satu jalur ditambahkan: `confirmed → completed`. Nol status baru.**

Sebelumnya `sales_orders` punya empat aturan transisi, dan `confirmed → completed` **bukan**
salah satunya — sementara `in_production` **tidak pernah ditulis kode mana pun**. Akibatnya
setiap Sales Order berada di `confirmed` selamanya dan penutupan **mustahil**, bahkan bila
tombolnya dibuat.

**Pemicunya sekarang ada** (aturan proyek: status hanya ditambahkan bersama pemicu dan
akibatnya): `selesaikan_sales_order()`, yang mensyaratkan konfirmasi PPIC lebih dulu dan hanya
bisa dipanggil kepemimpinan.

**AD-03 tidak tersentuh** — kosakata statusnya tetap empat, dan pertanyaan penamaan tetap
terbuka.


---

## Pembaruan 30 Agustus 2026 — AD-03 dilaksanakan: `in_production` DICABUT

**Sales Order kini punya TIGA status tersimpan**: `confirmed` · `completed` · `cancelled`.

| Transisi | Pemicu | Wewenang |
|---|---|---|
| `confirmed → completed` | `selesaikan_sales_order()` | kepemimpinan, sesudah konfirmasi PPIC |
| `confirmed → cancelled` | `putuskan_pembatalan()` | kepemimpinan, atas permintaan |

**Yang dicabut dan alasannya**: `in_production` **tidak pernah ditulis kode mana pun**, dan
kebenaran produksi milik Manufacturing — Sales menurunkannya saat dibaca (AD-01/DEC-S11).
Dua aturan transisi yang menyebutnya ikut dihapus. **Nol status pengganti dibuat.**

**Pengaman**: migrasinya gagal keras bila masih ada baris memakainya. Terukur sebelum
dijalankan: **nol baris** di ketiga project.

**Yang TIDAK berubah**: PO Klien (`new` · `on_hold` · `cancelled` · `processed`) dan
persetujuan (`pending` · `approved` · `rejected`).
