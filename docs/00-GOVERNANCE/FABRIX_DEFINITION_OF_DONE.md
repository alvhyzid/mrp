# FABRIX DEFINITION OF DONE

### Architecture
- owner and source of truth confirmed
- entity/state/contract impact reviewed
- ADR recorded where required

### UX
- user task defined
- Carbon-first solution selected
- loading/error/empty/permission states considered
- cross-module consistency checked

### Data
- schema/constraints/indexes reviewed
- migration and rollback/recovery strategy defined when applicable
- historical integrity preserved

### Security
- authentication/authorization tested
- tenant/company/scope isolation tested
- audit requirements met

### Quality
- critical business rules automated
- integration/E2E coverage appropriate
- no unexplained failed critical tests

### Evidence
- implementation evidence
- test evidence
- browser/E2E evidence when applicable
- migration reconciliation when applicable

### Release
- no unresolved release-blocking defect
- certification recorded

---

# SYARAT TAMBAHAN YANG SUDAH MENGIKAT DI PROYEK INI — 29 Agustus 2026

Berkas ini benar, tapi **belum lengkap**: beberapa syarat "selesai" sudah mengikat lewat
`CLAUDE.md` dan tidak tercantum di sini. Yang tidak tertulis di daftar selesai akan terlewat.

### Data
- **Datanya harus bisa lahir lewat layar.** Modul yang datanya hanya bisa lahir dari migrasi
  atau skrip **belum selesai** — tenant kedua tidak punya siapa pun yang menulis migrasi
  untuk mereka.
- **Migrasi hanya untuk struktur dan master semua tenant.** Bila sebuah baris memuat nama,
  alamat, atau angka milik satu perusahaan, ia salah tempat.

### UX
- **Diuji di enam lebar**: 360 · 672 · 768 · 1280 · 1440 · 1920 px, dengan bukti gambar —
  bukan disimpulkan dari kode.
- **Tiga arah tepi diperiksa**: gulir menyamping, elemen melewati tepi kanan, elemen
  melewati tepi **kiri**. Yang ketiga tidak menghasilkan gulir dan karena itu tidak berbunyi.
- **Alamat halaman katalog Carbon yang sepadan wajib dilaporkan**, supaya pemilik produk
  bisa membandingkan berdampingan — satu-satunya pemeriksaan yang terbukti menangkap kelas
  cacat "sesuai niatnya, tapi niatnya salah".

### Kualitas
- **Penjaga wajib dibuktikan menggigit** — rusakkan sengaja hal yang dijaganya, pastikan ia
  gagal, lalu kembalikan. Penjaga yang hijau tanpa pernah diuji begitu **tidak menjaga apa pun**.
- **Setiap uji penolakan menyebut lapisan mana yang menolak** (mis. `42501` dari Postgres vs
  aturan bisnis) — test bisa lulus karena alasan yang salah.
- **Selalu ada kasus berhasil yang berwenang** berdampingan dengan kasus ditolak, supaya
  penjaga yang menolak semua orang tidak menyamar jadi penjaga yang benar.

### Bukti
- **Menjalankan, bukan membaca.** Typecheck bersih dan kode yang terbaca benar tidak
  membuktikan apa pun. Di proyek ini sudah empat kali sesuatu "berhasil tanpa berlaku":
  lolos build, lolos typecheck, dan tidak pernah hidup.
- **Setiap angka yang dilaporkan menyertakan saringan yang menghasilkannya.**
