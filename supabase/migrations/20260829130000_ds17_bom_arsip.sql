-- DS-17: jejak arsip untuk BOM (27 Agu 2026).
--
-- KENAPA KOLOM BARU, dan kenapa `status` yang sudah ada TIDAK CUKUP:
-- `boms.status` sudah punya nilai 'archived', dan itu memang dipakai apa adanya — nol enum
-- baru ditambahkan di sini. Yang TIDAK bisa dijawab `status` adalah dua pertanyaan yang
-- justru ditanyakan saat audit: SIAPA yang mengarsipkan, dan KAPAN.
--
-- Tanpa keduanya, sebuah BOM yang tiba-tiba berstatus 'archived' tidak bisa dijelaskan
-- oleh siapa pun. Itu bentuk yang sama dengan cacat "status berubah tanpa jejak" yang
-- sudah tercatat di CLAUDE.md.
--
-- BENTUKNYA MENIRU `routings` PERSIS, bukan merancang skema audit baru:
--   routings.archived_at timestamptz NULL
--   routings.archived_by integer NULL REFERENCES users(user_id)
--
-- YANG SENGAJA TIDAK DITAMBAHKAN: restored_at / restored_by. Pemulihan mengembalikan
-- kedua kolom di atas ke NULL, dan `routings` pun tidak menyimpan jejak pemulihan.
-- Menambahkannya hanya untuk BOM akan melahirkan dua pola audit yang berbeda untuk hal
-- yang sama — persis kelas "dua jalur hidup" yang berulang kali menggigit proyek ini.
-- Bila kelak jejak pemulihan memang dibutuhkan, ia ditambahkan untuk KEDUANYA sekaligus.
--
-- AMAN UNTUK DATA YANG SUDAH ADA: kedua kolom nullable dan tidak diisi apa pun di sini.
-- Nol baris berubah nilainya; nol semantik data lama disentuh. `if not exists` membuatnya
-- aman diterapkan ulang.
alter table boms add column if not exists archived_at timestamptz;
alter table boms add column if not exists archived_by integer;

do $mig$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'boms_archived_by_fkey'
  ) then
    alter table boms
      add constraint boms_archived_by_fkey
      foreign key (archived_by) references users(user_id);
  end if;
end
$mig$;

-- Indeks parsial: daftar BOM menyaring "belum diarsipkan" pada setiap pemuatan halaman,
-- dan hanya baris berarsip yang perlu dilewati. Parsial, bukan penuh, supaya tidak
-- membayar ruang untuk mayoritas baris yang archived_at-nya NULL.
create index if not exists boms_archived_at_idx on boms (company_id) where archived_at is not null;
