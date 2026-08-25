-- E.2 (25 Agu 2026) — penjaga kode task yang GAGAL KERAS, bukan diam-diam melewati.

-- ============================================================================
-- KENAPA FUNGSI INI ADA
-- ============================================================================
-- Bentrok kode task sudah terjadi EMPAT DARI EMPAT kali kode ditebak:
--   AUD-29, MST-24, MRG-12 -> `on conflict do nothing` MENELAN insert-nya diam-diam.
--   SEC-16                 -> penjaga `if not exists ... then insert` MENCEGAH penimpaan,
--                             tapi task-nya TIDAK LAHIR, dan migrasinya tetap "berhasil".
--
-- Yang menangkap kejadian keempat bukan penjaganya, melainkan pemeriksaan "baris ini
-- benar-benar ada?" sesudahnya. Itu berarti penjaganya MEMINDAHKAN kegagalan ke tempat yang
-- lebih sulit dilihat, bukan menghilangkannya.
--
-- Pengaman yang mencegah kerusakan tapi TIDAK BERBUNYI hanya menunda penemuannya.
-- Fungsi ini berbunyi.
create or replace function pastikan_kode_task_kosong(p_kode text)
returns void
language plpgsql
as $$
declare
  v_nama text;
  v_status text;
  v_modul text;
  v_kosong text;
begin
  select name, status into v_nama, v_status from build_tasks where task_code = p_kode;

  if v_nama is null then
    return; -- kodenya bebas
  end if;

  v_modul := split_part(p_kode, '-', 1);

  -- Menyebutkan kode kosong berikutnya di dalam pesan galatnya sendiri, supaya orang yang
  -- membacanya langsung tahu harus memakai apa -- bukan disuruh mencari sendiri.
  select v_modul || '-' || lpad(n::text, 2, '0') into v_kosong
  from generate_series(1, 999) n
  where not exists (
    select 1 from build_tasks
    where task_code = v_modul || '-' || lpad(n::text, 2, '0')
  )
  order by n
  limit 1;

  raise exception using
    errcode = 'unique_violation',
    message = format('KODE TASK BENTROK: %s sudah dipakai oleh "%s" (status: %s).', p_kode, v_nama, v_status),
    hint = format('Pakai %s. Cara cepat: node scripts/kode-task-berikutnya.js %s', v_kosong, v_modul);
end;
$$;

comment on function pastikan_kode_task_kosong(text) is
  'Menggagalkan migrasi bila kode task sudah dipakai, DAN menyebutkan kode kosong berikutnya. '
  'Dipakai sebelum setiap insert ke build_tasks. Menggantikan pola "if not exists then insert" '
  'yang mencegah penimpaan tapi membiarkan task-nya tidak lahir tanpa suara.';
