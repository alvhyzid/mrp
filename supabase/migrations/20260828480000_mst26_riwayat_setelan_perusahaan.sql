-- MST-26 (25 Agu 2026) — SETELAN PERUSAHAAN: jejak wajib + tanggal berlaku.
--
-- ================= MASALAH YANG DITUTUP =================
--
-- `company_settings` berisi 17 setelan yang dibaca SELURUH perhitungan biaya SDM, HPP,
-- dan margin — tarif BPJS, jam kerja standar, hari kerja per bulan, metode biaya. Tapi
-- TIDAK ADA satu pun kode di aplikasi yang menulisnya: nilainya lahir dari sebuah skrip
-- sekali-pakai. Perusahaan baru yang mendaftar lewat layar berdiri TANPA satu pun setelan,
-- dan angkanya bukan salah — ia tidak ada.
--
-- ================= KENAPA BUTUH TANGGAL BERLAKU =================
--
-- Tarif BPJS naik. Jam kerja standar berubah. Bila nilainya sekadar ditimpa, biaya batch
-- BULAN LALU ikut berubah begitu tarif bulan depan dimasukkan — dan angka yang sudah
-- dilaporkan ke pemilik produk berubah sendiri tanpa ada yang menyentuhnya.
--
-- Ini sejalan dengan aturan yang sudah berlaku di CLAUDE.md: biaya batch berjalan TIDAK
-- DITIMPA perhitungan ulang, dan penggolongan biaya karyawan bertanggal berlaku.
--
-- ================= YANG DIBANGUN, DAN BATASNYA =================
--
-- 1. `company_settings` tetap menyimpan nilai YANG BERLAKU SEKARANG. Enam pembaca yang
--    sudah ada TIDAK diubah sama sekali — mereka terus bekerja apa adanya.
-- 2. `company_settings_history` menyimpan SETIAP perubahan: siapa, kapan, dari apa ke apa,
--    alasannya, dan sejak kapan berlaku. Append-only.
--
-- BATAS YANG WAJIB DISEBUT, jangan dibaca melebihi kekuatannya: keenam pembaca masih
-- memakai nilai SEKARANG, bukan nilai yang berlaku pada tanggal transaksi. Jadi tabel ini
-- MENYIMPAN bahan untuk menjawab "berapa tarifnya bulan Juli", tapi belum ada perhitungan
-- yang MENANYAKANNYA. Membuat keenam pembaca sadar-tanggal adalah pekerjaan tersendiri
-- yang dicatat sebagai task, bukan diselundupkan ke sini.

create table if not exists company_settings_history (
  company_settings_history_id bigserial primary key,
  company_id integer not null references companies(company_id),
  setting_key text not null,
  old_value text,
  new_value text,
  -- Sejak kapan nilai baru ini berlaku. Untuk setelan yang memengaruhi perhitungan
  -- historis, ini yang menentukan -- BUKAN changed_at.
  effective_from date not null default current_date,
  changed_by integer references users(user_id),
  changed_by_name text,
  changed_by_role text,
  reason text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_company_settings_history_lookup
  on company_settings_history (company_id, setting_key, effective_from desc);

alter table company_settings_history enable row level security;

-- Boleh DIBACA seluruh anggota perusahaan: jejak yang hanya bisa dilihat orang yang
-- membuatnya bukan jejak, melainkan catatan pribadi.
drop policy if exists company_settings_history_select_for_company on company_settings_history;
create policy company_settings_history_select_for_company on company_settings_history
  for select using (company_id = jwt_company_id());

-- TIDAK ADA policy INSERT/UPDATE/DELETE untuk `authenticated` — SENGAJA.
-- Jejak ditulis server lewat admin client bersamaan dengan perubahan setelannya, dalam
-- satu jalur. Memberi pengguna hak menulis langsung ke tabel jejak berarti jejaknya bisa
-- dikarang, dan jejak yang bisa dikarang tidak menjawab apa pun saat ada perselisihan.

comment on table company_settings_history is
  'Jejak append-only perubahan setelan perusahaan (MST-26): siapa, kapan, dari apa ke apa, '
  'alasan, dan sejak kapan berlaku. Hanya bisa dibaca; penulisan lewat server. '
  'CATATAN: pembaca setelan masih memakai nilai SEKARANG — tabel ini menyimpan bahan untuk '
  'perhitungan sadar-tanggal, tapi perhitungannya sendiri belum menanyakannya.';
