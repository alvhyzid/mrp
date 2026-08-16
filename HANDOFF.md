# HANDOFF — Kondisi Terkini Proyek

Dokumen kerja lintas-sesi (pola B.11, lihat `docs/rencana-kerja-playbook-ams.md`). Tiap sesi Claude Code WAJIB baca ini dulu sebelum mulai, dan memperbarui bagian relevan begitu sesi selesai. Klaim di sini harus tetap diverifikasi ulang, bukan otomatis dipercaya — HANDOFF ini rangkuman, bukan pengganti bukti.

---

## Sesi 2C — CI GitHub Actions (17 Agu 2026) — SEBAGIAN SELESAI (kode siap & terverifikasi lokal, menunggu run pertama di GitHub)

**Status kriteria:**
- [x] `supabase/config.toml` dibuat (repo ini SEBELUMNYA tidak punya sama sekali — migrasi selalu di-push langsung ke project remote, tidak pernah lewat `supabase db start` lokal)
- [x] Test baru `tests/cross_company_isolation.test.ts` (7 test) — mengisi gap Lapis 1 B.9 "isolasi antar company" yang TIDAK ADA di 3 file test manapun sebelumnya (`role_hierarchy_financial_access`/`employee_attendance_access` menguji antar-ROLE dalam 1 company, `super_admin` tidak menguji isolasi). Fixture 2 company terpisah (`IsolationTestCorp X`/`Y`, pola sama seperti `RoleTestCorp`), dibuat & dibersihkan total tiap run. **Dijalankan terhadap dev asli, LOLOS 7/7** sebelum di-commit — membuktikan RLS isolasi company memang bekerja, bukan cuma "test-nya ada".
- [x] Seluruh 4 file test (25 test total, termasuk 18 test lama) dijalankan bersamaan terhadap dev asli lewat `npm test` (script baru) — **LOLOS 25/25**, durasi ~12 detik (jauh di bawah target <5 menit).
- [x] `npm run typecheck` (`tsc --noEmit`, script baru) — bersih, ~5 detik.
- [x] Workflow `.github/workflows/ci.yml` ditulis, 2 job paralel:
  - `verify`: checkout → setup Node 24 → `npm ci` → `npm run typecheck` → `npm test` (butuh 6 GitHub Secrets, lihat bawah)
  - `rebuild-migrations`: `supabase/setup-cli@v1` → `supabase db start` (build stack Postgres lokal dari image resmi Supabase, TERAPKAN SELURUH `supabase/migrations/` dari nol — runner GitHub Actions punya Docker, TIDAK seperti sandbox lokal sesi ini) → `supabase db dump --local` (**pg_dump ASLI**, menggantikan substitusi `debug_schema_snapshot()`/introspeksi `pg_catalog` dari Sesi 2A sesuai instruksi eksplisit) → cek isi dump memuat tabel-tabel inti → upload dump sebagai artifact.
- [x] 6 GitHub Secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DEBUG_ROLE_TEST_PASSWORD`, `DEBUG_SUPER_ADMIN_PASSWORD`, `DEBUG_COMPANY_A_PASSWORD`) ditambahkan manual oleh user lewat GitHub web UI (`gh` CLI TIDAK TERSEDIA di environment sandbox ini — dicek `gh auth status`/`gh secret list`, keduanya "command not found"; solusi: user tambah manual, nama-nama persis sama dengan `.env.local` jadi tinggal copy nilai)
- [ ] Run pertama di GitHub Actions BELUM diverifikasi hijau — baru akan terjadi setelah commit+push sesi ini (repo `alvhyzid/mrp` PUBLIC, jadi status run bisa dipantau lewat `api.github.com/repos/alvhyzid/mrp/actions/runs` TANPA token, sebagai pengganti `gh` CLI yang tidak ada)
- [ ] Demonstrasi red→green (sengaja rusak 1 hal, push, tangkap run MERAH, perbaiki, push, tangkap run HIJAU lagi) — BELUM dilakukan
- [ ] Screenshot run hijau — BELUM diambil

**Catatan:** `gh` CLI tidak terinstal di sandbox ini dan tidak ada package manager (`brew` juga sebelumnya tidak ada, sama seperti kendala Docker di Sesi 2A) untuk memasangnya — dipecahkan dengan (a) meminta user menambah GitHub Secrets manual lewat web UI (aman, kredensial tidak pernah lewat chat), dan (b) memantau status Actions run lewat REST API publik tanpa autentikasi karena repo memang public.

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
