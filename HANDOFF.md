# HANDOFF — Kondisi Terkini Proyek

Dokumen kerja lintas-sesi (pola B.11, lihat `docs/rencana-kerja-playbook-ams.md`). Tiap sesi Claude Code WAJIB baca ini dulu sebelum mulai, dan memperbarui bagian relevan begitu sesi selesai. Klaim di sini harus tetap diverifikasi ulang, bukan otomatis dipercaya — HANDOFF ini rangkuman, bukan pengganti bukti.

---

## Sesi 2B — Setup Staging (16 Agu 2026) — SEBAGIAN SELESAI (utang untuk sesi berikutnya)

**Status kriteria:**
- [x] Aplikasi bisa diakses lewat URL Vercel staging: **https://mrp-staging-zeta.vercel.app**
- [x] Terhubung ke Supabase project staging (`mrp-rebuild-test-2A`/`nclkepwlsgmfbslgsajq`), BUKAN project dev — dibuktikan lewat tes negatif (lihat di bawah)
- [ ] **"signup" TIDAK terverifikasi asli** — endpoint publik `supabase.auth.signUp()` gagal konsisten di project staging ini. `login` dan `invite → accept` SUDAH terverifikasi lewat browser sungguhan, tapi memakai akun yang di-bootstrap lewat `admin.createUser()` (server-side), bukan lewat form "Daftar" yang sesungguhnya, karena form itu SELALU gagal.

### BUG BELUM TERPECAHKAN: `signUp()` gagal di project staging — WAJIB diperbaiki sebelum Sesi 2C

**Gejala:** `supabase.auth.signUp({email, password})` (dipanggil dari `registerCompanyAdmin.ts`, dipakai halaman `/register`) selalu mengembalikan:
```json
{"code":500,"error_code":"unexpected_failure","msg":"Hook requires authorization token","error_id":"<berbeda tiap percobaan>"}
```
Efek samping: baris `auth.users` TETAP tercipta walau response error — jadi ada user "yatim" (auth account ada, tidak ada baris `companies`/`users` aplikasi) tiap kali form signup dicoba. **Semua baris yatim dari sesi ini sudah dibersihkan** (0 baris tersisa di `auth.users` staging per akhir sesi, di luar 2 akun yang sengaja dipertahankan sebagai bukti — lihat di bawah).

**Yang SUDAH dicoba dan TIDAK menyelesaikan** (jangan diulang tanpa ide baru):
1. Toggle `hook_custom_access_token_enabled` true/false — error sama persis, termasuk saat hook DIMATIKAN. Jadi bukan soal hook aktif/nonaktif.
2. Toggle `mailer_autoconfirm` true/false — error sama persis di kedua kondisi.
3. `security_captcha_enabled` — sudah `false` di kedua project (dev & staging), bukan penyebab.
4. Anon key (legacy JWT) vs publishable key (`sb_publishable_...`) — error sama di keduanya.
5. Tunggu 3 menit (dugaan propagation delay project baru) — error tetap sama persis.
6. **Regenerate + re-sync hook secret** (persis instruksi diagnosa yang diminta pemilik produk) — secret baru di-set BERSAMAAN ke Edge Function secret (`supabase secrets set CUSTOM_ACCESS_TOKEN_HOOK_SECRETS`) dan ke Auth config (`PATCH /v1/projects/.../config/auth`), dikonfirmasi keduanya menerima nilai yang SAMA PERSIS — error tetap sama persis setelahnya.
7. Bandingkan konfigurasi Edge Function dev vs staging via Management API — **identik**: `verify_jwt: false` di kedua project, `ezbr_sha256` (hash kode yang di-deploy) SAMA PERSIS, nama-nama secret yang ter-set SAMA PERSIS.
8. Cek log `auth_logs` project staging langsung (query lewat `/v1/projects/.../analytics/endpoints/logs.all`) untuk 1 percobaan gagal — hasil:
   ```json
   {"action":"run_hook","error":"500: Hook requires authorization token","hook":"https://nclkepwlsgmfbslgsajq.supabase.co/functions/v1/custom-access-token","msg":"Hook errored out", ...}
   ```
   Ini konfirmasi: GoTrue BENAR-BENAR memanggil hook (bukan gagal sebelum sampai ke situ), dan APAPUN yang dikembalikan hook itu (atau lapisan di depannya) direkam sebagai pesan ini — TAPI pesan "Hook requires authorization token" TIDAK ADA di kode `supabase/functions/custom-access-token/index.ts` manapun (sudah dicek langsung — semua pesan error di kode itu berbeda kata-katanya). Artinya pesan ini datang dari GoTrue sendiri atau lapisan gateway Edge Functions, BUKAN dari kode fungsi kita.
9. Panggil URL Edge Function LANGSUNG (bukan lewat GoTrue) tanpa header apa pun — hasilnya kode KITA SENDIRI yang merespon (`{"error":"Invalid hook signature","detail":"Missing required headers"}`, 401) — BUKAN pesan "Hook requires authorization token". Ini membuktikan fungsi kita bisa dijangkau normal dan tidak diblokir gateway untuk panggilan LANGSUNG — masalahnya spesifik pada panggilan yang datang DARI GoTrue.
10. `admin.auth.admin.createUser()` — **BERHASIL SEMPURNA**, termasuk hook berjalan benar (dibuktikan lewat login sukses dengan `company_id`/`app_role` yang benar di JWT). `admin.auth.admin.inviteUserByEmail()` — **BERHASIL SEMPURNA** juga. Jadi pipeline Hook+JWT claims TERBUKTI berfungsi penuh — cuma jalur spesifik `signUp()` publik (anon key, self-service) yang gagal.
11. **Dikonfirmasi `signUp()` di project DEV masih normal** (dites langsung dengan email domain gmail.com acak yang tidak pernah dikirimi, langsung dihapus lagi) — jadi ini BUKAN regresi baru yang juga mengintai di dev, murni spesifik ke project staging yang baru dibuat.

**Kesimpulan sementara:** kemungkinan besar bug/inkonsistensi platform Supabase spesifik untuk project staging ini (baru dibuat 16 Agu 2026), pada jalur internal GoTrue "buat sesi baru saat signUp() -> panggil hook custom-access-token" — BUKAN kesalahan konfigurasi yang bisa diperbaiki dari sisi kita (sudah dicoba semua yang masuk akal, termasuk exact match dev). `error_id` sample untuk laporan ke Supabase support kalau diperlukan: `01a00ac2-8bc6-722f-a7f8-78ba22a3b74e`, `01a00bb9-8648-7440-b3b2-636cc19639c8`.

**Opsi lanjutan yang BELUM dicoba** (untuk sesi berikutnya): (a) hapus & buat ulang project staging dari nol (ditawarkan ke pemilik produk, belum dipilih), (b) hubungi Supabase support dengan `error_id` di atas, (c) coba ganti pendekatan hook dari HTTPS Edge Function ke Postgres Function hook (mekanisme berbeda, belum pernah dicoba sama sekali untuk project ini).

### Yang TERVERIFIKASI bekerja lewat browser sungguhan (screenshot ada, lihat scratchpad sesi ini kalau perlu direproduksi)
- App live di https://mrp-staging-zeta.vercel.app, terhubung ke Supabase staging (bukan dev) — dibuktikan dari isi `/api/me` & UI menampilkan data company staging.
- **Login**: berhasil, redirect ke `/dashboard`, sesi valid dengan `company_id`/`app_role` benar di JWT (dibuktikan halaman ter-load sesuai role `company_admin` — semua menu department terlihat).
- **Invite**: form "Undang anggota baru" di `/team` diisi & disubmit lewat UI sungguhan → baris `invitations` tercipta dengan token asli, DAN `admin.auth.admin.inviteUserByEmail()` (dipanggil `inviteTeamMember.ts`) otomatis membuat akun `auth.users` untuk calon anggota — TIDAK butuh signUp() terpisah untuk alur ini.
- **Accept**: login sebagai akun calon anggota (password di-set lewat admin API karena `inviteUserByEmail` tidak mengirim password awal) → navigasi ke `/invite/accept?token=<token asli dari DB>` → "Undangan berhasil diterima" → diverifikasi di database: `invitations.status = accepted`, baris `users` baru tercipta dengan `role=general_manager` (sesuai yang dipilih saat invite) dan `company_id` benar.
- **Negatif — isolasi environment**: kredensial user DEV asli (`ppic.a@debug.mrp`) dicoba login ke APLIKASI STAGING → ditolak bersih dengan "Invalid login credentials" (screenshot ada) — membuktikan staging benar-benar project terpisah, bukan kebetulan mengarah ke database yang sama.

### Konfigurasi yang dibuat sesi ini (semua di project staging, DEV tidak disentuh — diverifikasi berulang kali)
- Vercel project baru `mrp-staging` (org/team `ams-3670`, akun `alvansecures-9901`) — terhubung ke branch git `staging` (bukan `main`), env var `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` di-set untuk staging project, scoped ke Production DAN Preview+branch `staging` (perlu dua-duanya karena deploy pertama sebuah project baru di Vercel selalu ditandai "production" walau di branch non-main).
- Edge Function `custom-access-token` di-deploy ke project staging dengan `--no-verify-jwt` (WAJIB untuk Auth Hook berbasis HTTPS — tanpa ini, deploy defaultnya menolak semua panggilan termasuk dari GoTrue sendiri).
- Secret `CUSTOM_ACCESS_TOKEN_HOOK_SECRETS` di-generate BARU khusus staging (bukan pakai punya dev) — tersimpan di secrets Edge Function, TIDAK di git.
- Auth config staging: `hook_custom_access_token_enabled=true` + uri + secret (lihat bug di atas), `site_url=https://mrp-staging-zeta.vercel.app`, `uri_allow_list` mencakup domain staging, `mailer_autoconfirm=true` (SENGAJA beda dari dev yang `false` — staging butuh ini supaya user test tidak perlu menerima email sungguhan; dampaknya: staging TIDAK 100% "identik jalur produksi" untuk alur email — dicatat sebagai penyimpangan yang disadari, bukan kelupaan).
- Branch git `staging` dibuat & di-push ke `origin/staging`, terpisah dari `main`.

### Data yang sengaja DIBIARKAN di staging sebagai bukti hidup
- 1 `companies` row "Staging Verify Co" + 1 `users` row `company_admin` (dibuat via `admin.createUser`, bukan lewat form) + 1 `users` row `general_manager` hasil accept undangan + 1 baris `invitations` berstatus `accepted`. Semua baris test lain (dari percobaan signUp yang gagal berkali-kali) sudah dibersihkan — 0 baris yatim tersisa di `auth.users` staging di luar 2 yang disebut di atas.

### Belum dikerjakan (lanjutan, urutan prioritas)
1. **Selesaikan bug `signUp()` di atas dulu** — tanpa ini, kriteria "signup" Sesi 2B belum bisa dicentang penuh, dan modul-modul lain yang mengandalkan self-registration publik (kalau ada) juga berisiko sama di staging.
2. Setelah bug di atas selesai: re-run verifikasi signup ASLI lewat form (bukan admin.createUser), sertakan sebagai bukti pelengkap.
3. Sesi 2C — CI GitHub Actions, WAJIB pakai `pg_dump` asli untuk uji rebuild-migrasi (lihat catatan Sesi 2A di bawah).

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
