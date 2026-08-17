# HANDOFF — Kondisi Terkini Proyek

Dokumen kerja lintas-sesi (pola B.11, lihat `docs/rencana-kerja-playbook-ams.md`). Tiap sesi Claude Code WAJIB baca ini dulu sebelum mulai, dan memperbarui bagian relevan begitu sesi selesai. Klaim di sini harus tetap diverifikasi ulang, bukan otomatis dipercaya — HANDOFF ini rangkuman, bukan pengganti bukti.

---

## Sesi 3A (lanjutan sore) — Pembatasan qty_shipped vs qty_ordered (17 Agu 2026) — SELESAI

**MEMBALIK keputusan Sesi 3A pagi**: sebelumnya kirim melebihi sisa `qty_ordered` SO line SENGAJA diizinkan (konsisten dengan `goods_receipt_lines`). Instruksi eksplisit membalik ini KHUSUS untuk shipments — sekarang DITOLAK DI DATABASE, bukan cuma validasi form. `goods_receipt_lines` sendiri TIDAK disentuh, tetap seperti semula.

**Migration:** `20260817150000_shipment_lines_qty_limit_enforcement.sql`. Trigger baru `enforce_shipment_line_qty_limit` (BEFORE INSERT/UPDATE OF qty_shipped, sales_order_line_id ON shipment_lines) — jumlah baris ini merangkapkan seluruh baris `shipment_lines` NON-CANCELLED (draft + shipped, bukan cuma yang sudah shipped) untuk `sales_order_line_id` yang sama tidak boleh melebihi `qty_ordered`. Pesan error: "Jumlah melebihi sisa pesanan — sisa X, diminta Y." SECURITY DEFINER — perlu, karena `sales_order_lines` RLS-nya enabled TAPI NOL policy (default-deny total untuk role biasa, ditemukan saat menulis migrasi ini, bukan cuma asumsi).

**Keputusan desain yang TIDAK diminta eksplisit tapi konsekuensi logis:** baris shipment milik shipment `cancelled` dikecualikan dari total kumulatif — supaya percobaan pengiriman yang dibatalkan tidak permanen mengunci kuota qty (kalau tidak dikecualikan, staf tidak akan pernah bisa coba kirim ulang setelah 1 kali membatalkan shipment).

**Verifikasi:** `tests/shipments_physical_stage.test.ts` diperbarui (test lama "over-ship DIIZINKAN" diubah jadi "DITOLAK", ditambah 1 test baru "TEPAT SAMA dengan sisa -> DIIZINKAN" untuk batas atas). 7 test file ini lolos, 32 test seluruh suite lolos, ~46 detik. Dibuktikan konkret: insert baris qty=15 saat sisa=10 → DITOLAK sebelum baris sempat tercipta sama sekali (`shipment_lines` tetap 0 baris untuk shipment itu), `sales_order_lines.qty_shipped` TETAP 0 (bukan sebagian ter-update).

**Belum dikerjakan:** Sesi 3B (UI) — termasuk instruksi baru "tampilkan sisa qty jelas SEBELUM submit" yang belum ada tempatnya karena UI shipments belum dibangun sama sekali.

---

## Sesi 3A — Fondasi Data Shipments (17 Agu 2026) — SELESAI

**Konteks:** didahului Laporan Arkeologi Shipments (query katalog Postgres langsung) yang menemukan: skema `shipments`/`shipment_lines` sudah ada sejak 12 Agu tapi NOL kode/trigger/data menyentuhnya; `stock_movements.movement_type` sudah mengantisipasi nilai `'shipment'`; pola trigger established (`process_goods_receipt_line()`, `trigger_recompute_stock_projection()`) yang jadi acuan wajib untuk implementasi ini.

**Migration:** `20260817140000_shipments_physical_stage.sql` — diterapkan ke dev (`kfvtrwuuqcjfkkuqizxt`) lewat `supabase db push --linked`.
- `shipment_lines.lot_id` diubah NOT NULL (traceability wajib)
- `shipments`: tambah `shipment_number` (unique per company, prefix `SJ-`), `vehicle_number`, `driver_name`, `delivery_address` (NOT NULL), `recipient_name`, `recipient_phone`
- `sales_order_lines.qty_shipped` (numeric(14,4) default 0, kumulatif — increment otomatis oleh trigger)
- `shipments` didaftarkan ke `enforce_status_transition()` (fungsi generik yang sama dipakai 5 tabel lain, DIPERLUAS dengan 1 cabang baru — bukan bikin fungsi terpisah): `draft→shipped`, `draft→cancelled`, `shipped→delivered`
- Trigger baru `process_shipment_shipped()` (AFTER UPDATE OF status ON shipments, WHEN draft→shipped) — mengurangi `lots.quantity_on_hand`, insert `stock_movements` (`movement_type='shipment'`), update `sales_order_lines.qty_shipped`, panggil `recompute_stock_projection_for_item()`, untuk SEMUA `shipment_lines` milik shipment itu (loop) — sengaja AFTER UPDATE di HEADER, bukan AFTER INSERT di tabel detail seperti 2 pola acuan, karena requirement eksplisit "stok jangan berkurang sebelum status jadi shipped"
- Fungsi baru `suggest_fefo_lots(item_id, production_plant_id)` — saran lot FEFO, SECURITY INVOKER (bukan DEFINER) supaya RLS `lots` tetap berlaku otomatis lewat privilese pemanggil

**Verifikasi nyata (script + test permanen, keduanya dijalankan terhadap dev asli):**
- `tests/shipments_physical_stage.test.ts` (test BARU, 6 test, masuk CI) — LOLOS 6/6. Suite penuh (5 file, 31 test) tetap LOLOS 31/31 setelah penambahan ini, ~42 detik.
- Alur penuh: buat shipment (draft) → tambah 2 baris (lot beda expiry) → **stok TIDAK berubah selagi draft** (dibuktikan before/after tepat di titik itu) → ubah status ke `shipped` → **stok berkurang TEPAT saat itu** (near-expiry 100→70, far-expiry 100→90) → `stock_movements` 2 baris (`movement_type=shipment`) tercatat → `sales_order_lines.qty_shipped` 0→40 → `status_transition_log` mencatat transisi.
- Negatif 1: insert `shipment_line` dengan `lot_id=NULL` → DITOLAK (`23502`, constraint NOT NULL).
- Negatif 2: transisi `draft→delivered` langsung (skip `shipped`) → DITOLAK (`enforce_status_transition`, `23514`).
- Negatif 3 (bonus, di luar yang diminta tapi relevan): kirim qty melebihi stok FISIK lot → DITOLAK, stok lot tidak berubah (tidak sampai negatif).
- Skenario 4 (bukan negatif — perilaku yang diminta untuk dilaporkan): kirim qty melebihi SISA `qty_ordered` SO line → **DIIZINKAN** (konsisten dengan `goods_receipt_lines.qty_received` yang juga tidak dibatasi terhadap `qty_ordered`, tidak ada preseden pembatasan seperti itu di manapun di codebase ini).
- `suggest_fefo_lots()` diverifikasi mengembalikan lot expiry terdekat lebih dulu.
- Semua data fixture (`ShipmentTestCorp`) dibersihkan total setelah verifikasi — dev DB dikonfirmasi kembali ke 0 baris `shipments`/`shipment_lines`.

**Dokumentasi diperbarui:** `rancangan-skema-database-mrp.md`, `daftar-database-sederhana.md`, `prioritas-fitur-mrpeasy-enterprise.md` (margin/profit per pengiriman & telusur PO diubah dari ❌/🟡-lama ke 🟡 dengan detail baru — BELUM ✅ karena UI Sesi 3B dan kalkulasi margin itu sendiri belum digarap).

**CI (dari Sesi 2C) sempat merah sekali gara-gara perubahan ini, sudah diperbaiki:** push pertama Sesi 3A membuat `role_hierarchy_financial_access.test.ts` (file test LAMA, tidak disentuh isinya) gagal "Hook timed out in 10000ms" di CI — akibat `fileParallelism:false` (fix Sesi 2C) ditambah file test ke-5 yang lebih berat, total waktu tunggu per-file melebihi limit default 10 detik Vitest di bawah latensi network CI. Diperbaiki dengan menaikkan `hookTimeout` ke 30 detik di `vitest.config.ts` (config bersama, BUKAN mengubah file test manapun) — commit terpisah, run berikutnya hijau bersih (kedua job: https://github.com/alvhyzid/mrp/actions/runs/31989356358).

**Belum dikerjakan (lanjutan eksplisit sesuai rencana):**
- Sesi 3B — UI Shipments (halaman, form, FEFO ter-tampil, transisi status lewat browser)
- Sesi 3C — PDF Surat Jalan
- Fungsi kalkulasi margin per pengiriman itu sendiri (skema/data sudah siap, fungsinya belum ditulis)

---

## Sesi 2C — CI GitHub Actions (16-17 Agu 2026) — SELESAI

**Status kriteria — semua tercapai:**
- [x] `supabase/config.toml` dibuat (repo ini SEBELUMNYA tidak punya sama sekali — migrasi selalu di-push langsung ke project remote, tidak pernah lewat `supabase db start` lokal)
- [x] Test baru `tests/cross_company_isolation.test.ts` (7 test) — mengisi gap Lapis 1 B.9 "isolasi antar company" yang TIDAK ADA di 3 file test manapun sebelumnya (`role_hierarchy_financial_access`/`employee_attendance_access` menguji antar-ROLE dalam 1 company, `super_admin` tidak menguji isolasi). Fixture 2 company terpisah (`IsolationTestCorp X`/`Y`, pola sama seperti `RoleTestCorp`), dibuat & dibersihkan total tiap run. Dijalankan terhadap dev asli LOLOS 7/7 sebelum di-commit — membuktikan RLS isolasi company memang bekerja, bukan cuma "test-nya ada". 3 file test lama TIDAK diubah.
- [x] `npm run typecheck` (`tsc --noEmit`, script baru) dan `npm test` (`vitest run` semua 4 file, script baru) — jalan otomatis tiap push lewat `.github/workflows/ci.yml`, 2 job paralel (`verify`, `rebuild-migrations`).
- [x] `rebuild-migrations` pakai **pg_dump ASLI** (`supabase/setup-cli@v1` → `supabase db start` di Docker runner GitHub → `supabase db dump --local`) — BUKAN lagi substitusi introspeksi `pg_catalog` dari Sesi 2A, sesuai instruksi eksplisit sesi itu.
- [x] 6 GitHub Secrets ditambahkan manual oleh user lewat GitHub web UI.
- [x] **Run hijau bersih tercapai**: https://github.com/alvhyzid/mrp/actions/runs/31966655990 — job `verify` selesai 1m33s, job `rebuild-migrations` selesai 1m51s (jauh di bawah target <5 menit).
- [x] **Demonstrasi red→green SUNGGUHAN dilakukan** (2 kali, lihat kronologi di bawah — bukan cuma 1 demo buatan, tapi 2 bug NYATA ditemukan+diperbaiki oleh CI itu sendiri di 2 run pertama, DITAMBAH 1 demo red→green sengaja sebagai bukti eksplisit sesuai permintaan).

### Kronologi (bukti CI benar-benar bekerja, bukan cuma "hijau kebetulan")

**Run 1 — https://github.com/alvhyzid/mrp/actions/runs/31965768475 — MERAH, 2 bug NYATA ditemukan:**
- `rebuild-migrations` gagal di langkah "Verifikasi dump berisi tabel inti": SEMUA 9 tabel yang dicek tidak ditemukan. Akar masalah (dibuktikan lewat `supabase db dump --local --dry-run` lokal, bukan tebakan): `supabase db dump` SELALU menyisipkan sed substitution `s/^CREATE TABLE "/CREATE TABLE IF NOT EXISTS "/` — pola grep versi pertama tidak mengizinkan "IF NOT EXISTS " di tengah, jadi tidak pernah cocok. Diperbaiki di commit `f5c89ea`.
- `verify` gagal di `npm test`: `Failed to create fixture company: JWT issued at future` di `beforeAll` salah satu file test.

**Run 2 — https://github.com/alvhyzid/mrp/actions/runs/31966431158 — SEBAGIAN MERAH, bug ke-2 dikonfirmasi:**
- `rebuild-migrations` **hijau** (perbaikan commit `f5c89ea` terbukti benar).
- `verify` MASIH merah, error SAMA PERSIS ("JWT issued at future") tapi kali ini di file test LAIN (`role_hierarchy_financial_access.test.ts`, bukan `cross_company_isolation.test.ts` lagi). Pola ini (file yang gagal berganti-ganti, SELALU tepat di request admin PALING AWAL sebuah file, tidak pernah gagal saat 1 file dijalankan sendirian) adalah signature lonjakan koneksi baru simultan ke Supabase — Vitest default menjalankan semua file test paralel, jadi ke-4 `beforeAll` menembak `adminClient.from('companies').insert()` ke project dev yang sama nyaris bersamaan. **Bukan bug di RLS/kode aplikasi** — diverifikasi dengan membaca log run, bukan diasumsikan. Diperbaiki dengan `fileParallelism: false` di `vitest.config.ts` (commit `67c96ce`), total durasi test tetap naik wajar (36 detik lokal, jauh di bawah target).

**Run 3 — https://github.com/alvhyzid/mrp/actions/runs/31966655990 — HIJAU BERSIH.** Kedua job sukses, dikonfirmasi lewat GitHub API (job `verify` 19:07:52→19:09:25, job `rebuild-migrations` 19:07:53→19:09:44).

**Run 4 — https://github.com/alvhyzid/mrp/actions/runs/31966811868 — MERAH SENGAJA (demo eksplisit).** Assertion `expect(1).toBe(2)` disisipkan sementara di `cross_company_isolation.test.ts` (commit `39c269e`), push, run merah tertangkap — dikonfirmasi lewat log run: tepat 1 test gagal (`AssertionError: expected 1 to be 2`), 25 test lain tetap lolos, job `rebuild-migrations` tidak terpengaruh. Assertion langsung dihapus di commit berikutnya, push lagi → **hijau lagi**, menutup demonstrasi.

**Kendala teknis & solusi (dicatat untuk sesi berikutnya):**
- `gh` CLI TIDAK TERSEDIA di sandbox ini (`gh auth status`/`gh secret list` → "command not found"), tidak ada package manager untuk memasangnya. Solusi: (a) user tambah GitHub Secrets manual lewat web UI — kredensial tidak pernah lewat chat; (b) untuk memantau run & baca log, user membuatkan **Fine-grained PAT scope `Actions: Read-only`** khusus repo ini (bukan admin/write) — cukup untuk `GET .../actions/runs` dan `GET .../actions/jobs/{id}/logs` (endpoint log WAJIB token beradmin/akses baca Actions, gagal 403 "Must have admin rights" tanpa token meski repo public — hanya endpoint run-list/run-detail yang bisa diakses publik tanpa token).
- Rate limit API publik tanpa token cuma 60/jam — cepat habis kalau polling manual berulang; pakai header `Authorization: Bearer <token>` menaikkan ke 5000/jam.
- Shell gotcha: variabel bernama `status` di zsh itu READ-ONLY (built-in), assignment ke `status=` di dalam skrip polling langsung `exit 1` "read-only variable: status" — jangan pernah pakai nama itu untuk variabel sendiri.

---

## Sesi 2B — Setup Staging (16 Agu 2026) — SELESAI (termasuk perbaikan bug nyata di kode bersama)

**Status kriteria — semua 3 tercapai:**
- [x] Aplikasi bisa diakses lewat URL Vercel staging: **https://mrp-staging-zeta.vercel.app**
- [x] Terhubung ke Supabase project staging (`mrp-rebuild-test-2A`/`nclkepwlsgmfbslgsajq`), BUKAN project dev — dibuktikan lewat tes negatif
- [x] Alur signup → login → invite → accept **jalan normal lewat form/UI sungguhan** (signup sempat gagal, akar masalahnya ditemukan & DIPERBAIKI — lihat di bawah)

### BUG NYATA DITEMUKAN & DIPERBAIKI: `custom-access-token` hook gagal untuk user yang BELUM punya baris `public.users`

**Kronologi:** percobaan pertama menyimpulkan "kemungkinan bug platform Supabase spesifik project staging" setelah 11 langkah eliminasi (semua tercatat di riwayat git). **Kesimpulan itu SALAH** — diralat sesi ini setelah pemilik produk meminta 1 diagnosa spesifik lagi (baca log INTERNAL fungsi, bukan pesan generik yang diterima klien; cek penanganan kasus "user belum punya company_id"; cek apakah bug yang sama ada di dev tapi belum pernah terpicu) berdasar referensi github.com/orgs/supabase/discussions/38579 (pesan "Hook requires authorization token" itu GENERIK untuk error internal APA PUN di dalam hook, bukan spesifik soal token).

**Akar masalah sebenarnya** (`supabase/functions/custom-access-token/index.ts`): fungsi query `public.users` by `auth_uid`, dan kalau TIDAK ADA baris ditemukan, mengembalikan `401 {"error": "company_id not found for auth_uid."}`. Untuk user yang BARU SAJA `signUp()`, baris `public.users` memang belum ada — dibuat BELAKANGAN oleh `registerCompanyAdmin.ts` SETELAH `signUp()` return. Kalau GoTrue langsung minta token/sesi di titik itu (terjadi kalau `mailer_autoconfirm=true`, ATAU kalau login normal untuk auth-user yang tidak punya baris `users` sama sekali), hook mengembalikan 401 tadi — yang oleh GoTrue dibungkus jadi pesan generik "Hook requires authorization token" yang sama sekali tidak menyebut akar masalah sebenarnya.

**Dikonfirmasi lewat `function_edge_logs` project staging** (bukan `auth_logs` yang cuma pesan generik) — log request MASUK ke fungsi dari GoTrue (`user_agent: Go-http-client/2.0`) dengan response **status_code 401** — persis cabang kode "company_id not found" di atas, bukan gagal token/secret sama sekali.

**Dikonfirmasi bug yang SAMA ADA DI DEV** — dites langsung (BUKAN lewat ubah config dev, murni panggilan API test): bikin 1 auth user via `admin.createUser()` TANPA baris `public.users` pendamping, coba `signInWithPassword` — **gagal dengan pesan generik yang SAMA PERSIS** di dev. Kesimpulan sesi sebelumnya ("dev masih normal") SALAH — dev cuma kebetulan tidak pernah memicu jalur ini karena (a) `mailer_autoconfirm=false` di dev membuat `signUp()` normal TIDAK langsung minta sesi (nunggu konfirmasi email dulu — baris `users` keburu dibuat oleh `registerCompanyAdmin.ts` di request yang sama sebelum user itu benar-benar login pertama kali), dan (b) semua akun test dev sejauh ini dibuat lewat seed script yang SELALU langsung membuat baris `users` pendamping, tidak pernah lewat form signup murni.

**Perbaikan** (di `supabase/functions/custom-access-token/index.ts`, dipakai bersama dev+staging — 1 kode sumber): kalau tidak ada baris `public.users` ditemukan, sekarang **mengembalikan claims apa adanya** (200 OK, tanpa `company_id`/`app_role`) alih-alih menolak dengan 401 — user tetap dapat sesi (belum ada klaim department/role sampai baris `users`-nya dibuat & mereka login ulang, yang memang sudah jadi alur normal `registerCompanyAdmin.ts`). Kasus lain (baris `users` ADA tapi `company_id`-nya `null`, mis. `super_admin`) TIDAK berubah perilakunya.

**Di-deploy ulang ke KEDUA project** (`supabase functions deploy custom-access-token --no-verify-jwt`, ke `nclkepwlsgmfbslgsajq` dan `kfvtrwuuqcjfkkuqizxt`) dan diverifikasi:
- Staging: `signUp()` asli lewat form `/register` → sukses → redirect `/login` → login sukses → dashboard ter-render lengkap dengan nama company yang baru didaftarkan (screenshot ada).
- Dev: `signUp()` langsung (skrip test, email domain gmail.com acak, langsung dihapus setelah) → sukses tanpa error. Kasus reproduksi (login user tanpa baris `users`) → sekarang sukses dapat sesi. Regresi dicek: user existing dengan company_id (`ppic.a@debug.mrp`) → JWT `company_id`/`app_role` tetap benar seperti sebelumnya.
- `npx vitest run` (18 test) + `npm run build` tetap lulus setelah perubahan.

**Pelajaran untuk sesi berikutnya:** jangan berhenti di kesimpulan "kemungkinan bug platform pihak ketiga" tanpa membaca log INTERNAL sistem yang benar-benar relevan (di sini: `function_edge_logs`, bukan cuma `auth_logs`) dan tanpa menguji ulang asumsi "sudah dicek di dev" dengan skenario yang BENAR-BENAR sama (bukan skenario yang kebetulan menghindari jalur kode bermasalah).

### Yang TERVERIFIKASI bekerja lewat browser sungguhan (screenshot ada di scratchpad sesi ini kalau perlu direproduksi)
- App live di https://mrp-staging-zeta.vercel.app, terhubung ke Supabase staging (bukan dev).
- **Signup ASLI** lewat form `/register` → sukses (setelah perbaikan bug di atas).
- **Login**: berhasil, redirect ke `/dashboard`, JWT `company_id`/`app_role` benar.
- **Invite**: form "Undang anggota baru" di `/team` diisi & disubmit lewat UI sungguhan → baris `invitations` tercipta dengan token asli.
- **Accept**: navigasi ke `/invite/accept?token=<token asli dari DB>` → "Undangan berhasil diterima" → diverifikasi di database: `invitations.status=accepted`, baris `users` baru dengan role & company_id benar.
- **Negatif — isolasi environment**: kredensial user DEV asli (`ppic.a@debug.mrp`) ditolak bersih "Invalid login credentials" saat dicoba di APLIKASI STAGING — membuktikan staging benar-benar project terpisah.

### Konfigurasi yang dibuat sesi ini (DEV hanya disentuh untuk deploy PERBAIKAN BUG di atas, tidak ada config lain yang diubah — diverifikasi berulang kali)
- Vercel project baru `mrp-staging` (org/team `ams-3670`, akun `alvansecures-9901`) — terhubung ke branch git `staging` (bukan `main`), env var `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` di-set untuk staging project, scoped ke Production DAN Preview+branch `staging`.
- Edge Function `custom-access-token` di-deploy ke staging dengan `--no-verify-jwt` (WAJIB untuk Auth Hook berbasis HTTPS).
- Secret `CUSTOM_ACCESS_TOKEN_HOOK_SECRETS` baru khusus staging (bukan pakai punya dev) — tersimpan di secrets Edge Function, TIDAK di git.
- Auth config staging: `hook_custom_access_token_enabled=true` + uri + secret, `site_url=https://mrp-staging-zeta.vercel.app`, `uri_allow_list` mencakup domain staging, `mailer_autoconfirm=true` (SENGAJA beda dari dev yang `false` — staging butuh ini supaya user test tidak perlu menerima email sungguhan; dicatat sebagai penyimpangan yang disadari).
- Branch git `staging` dibuat & di-push ke `origin/staging`.

### Data test yang tersisa di staging (evidence, bukan sisa yatim)
- 1 `companies` + 1 `users` company_admin (bootstrap awal sebelum bug ditemukan) + 1 `users` general_manager hasil accept undangan + 1 `invitations` berstatus accepted. Semua baris signUp yang gagal (sebelum perbaikan) dan test signup yang berhasil (setelah perbaikan) sudah dibersihkan.

### Belum dikerjakan (lanjutan)
- Sesi 2C — CI GitHub Actions, WAJIB pakai `pg_dump` asli untuk uji rebuild-migrasi (lihat catatan Sesi 2A di bawah).

---

## Sesi 2A — Uji Rebuild-from-Migrations (16 Agu 2026) — SELESAI

**Hasil akhir: diff schema KOSONG** antara database dev dan project hasil rebuild murni dari file migrasi — dibuktikan lewat snapshot skema komprehensif (43 tabel, 422 kolom, 204 constraint, 112 index, 14 trigger, 87 RLS policy, 7 view, 34 function, 43 sequence, 8 storage policy, 2 storage bucket, 7 event trigger — total 983 objek), MD5 identik di kedua sisi.

### Temuan: 3 tabel + 2 function + 1 event trigger "liar" (dibuat manual, tidak ada migrasinya)
Ditemukan lewat percobaan rebuild nyata (bukan cuma baca kode) — migrasi paling awal di repo langsung gagal karena tabel `companies` belum ada:
- Tabel `companies`, `users`, `subscription_plans` — fondasi SaaS dari Fase 3 awal proyek, dibuat manual lewat Supabase Dashboard sebelum disiplin migrasi-lewat-file diterapkan.
- Fungsi `is_super_admin_user()`, `rls_auto_enable()` + event trigger `ensure_rls` (RLS auto-enable untuk tabel baru) — juga tidak pernah tercatat.

**Sudah ditambal**: migrasi susulan `supabase/migrations/20260811100000_baseline_companies_users_subscription_plans.sql`, ditempatkan dengan timestamp SEBELUM migrasi pertama yang ada (supaya urutan dependency benar untuk rebuild dari nol). Di database dev, migrasi ini ditandai "applied" TANPA dieksekusi (`supabase migration repair ... --status applied`) karena tabel-tabelnya sudah dalam bentuk FINAL (bukan bentuk awal) — menjalankan ulang DDL-nya di dev berisiko me-regresi `companies_insert_admin` ke versi longgar sebelum diperketat migrasi lain. Sudah diverifikasi dev TIDAK berubah setelah repair.

### Keterbatasan yang WAJIB ditutup di Sesi 2C
Environment kerja sesi ini **tidak punya Docker maupun `pg_dump`** (dicoba: `supabase db dump` butuh Docker; dicek Homebrew/pg_dump lokal — tidak ada; tidak install apa pun tanpa izin). Atas persetujuan eksplisit pemilik produk, verifikasi diff dilakukan pakai fungsi introspeksi SQL kustom (`public.debug_schema_snapshot()`, migrasi `20260817130000` s.d. `20260817131000`) yang membaca `information_schema`/`pg_catalog` langsung — cakupannya dibuat SAMA KETAT dengan `pg_dump --schema-only` (kolom+tipe+nullable+default, semua jenis constraint dengan definisi persis, index, trigger DAN event trigger, RLS policy per role/command/ekspresi lengkap, definisi view, signature+body function, sequence, storage policy+bucket).

**INI SOLUSI SEMENTARA.** Saat Sesi 2C (setup CI GitHub Actions) dikerjakan, uji rebuild-migrasi yang jadi bagian PERMANEN di CI **WAJIB pakai `pg_dump` sesungguhnya** (GitHub Actions runner biasanya punya akses Postgres/Docker yang environment kerja lokal ini tidak punya) — bukan melanjutkan pakai `debug_schema_snapshot()`. Fungsi itu boleh tetap ada di skema (tidak mengganggu), tapi jangan dijadikan alat verifikasi permanen di CI.

### Project Supabase baru untuk uji ini
- Nama: `mrp-rebuild-test-2A`, ref `nclkepwlsgmfbslgsajq`, region `ap-southeast-2`, org `alvhyzid`.
- **JANGAN dihapus** — sesuai `docs/rencana-kerja-playbook-ams.md` Sesi 2B, project ini yang akan dipakai untuk staging (bukan bikin project ketiga), karena skemanya sudah terbukti bersih hasil rebuild dari migrasi.
- Kredensial (URL/anon key/service role key) belum ditambahkan ke `.env` mana pun — akan disiapkan saat Sesi 2B (setup staging + Vercel).
- Password database project ini: disimpan sementara di scratchpad sesi (tidak persisten lintas sesi) — Sesi 2B kemungkinan perlu reset password lewat Dashboard Supabase kalau sudah tidak diketahui lagi.

### File yang ditambahkan sesi ini
- `supabase/migrations/20260811100000_baseline_companies_users_subscription_plans.sql` — baseline susulan (lihat di atas).
- `supabase/migrations/20260817130000_debug_schema_snapshot_function.sql` + `20260817130500_...` + `20260817131000_...` — fungsi introspeksi (sementara, lihat keterbatasan di atas).

### Belum dikerjakan (lanjutan)
- ~~Sesi 2B — Setup Staging~~ → lihat bagian Sesi 2B di ATAS (dikerjakan setelah ini, SEBAGIAN selesai).
- Sesi 2C — CI GitHub Actions, WAJIB pakai pg_dump asli untuk uji rebuild-migrasi.

---

## Cara pakai dokumen ini
Tiap sesi baru: tambah bagian baru di ATAS (paling terbaru di atas) dengan format sama — apa yang dikerjakan, apa yang ditemukan, apa yang belum, bukti konkret (bukan ringkasan "sudah beres"). Jangan hapus riwayat sesi sebelumnya.
