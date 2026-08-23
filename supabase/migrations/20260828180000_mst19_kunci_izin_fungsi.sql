-- MST-19 (lanjutan) — MENUTUP LUBANG IZIN pada fungsi total_qty_pernah_masuk.
--
-- DITANGKAP OLEH tests/function_grant_security_audit.test.ts, bukan oleh mata saya.
--
-- KENAPA INI SERIUS, bukan sekadar kerapian: fungsi itu dibuat SECURITY DEFINER dan
-- menerima `p_company_id` sebagai PARAMETER. Dengan izin EXECUTE bawaan Postgres yang
-- terbuka untuk PUBLIC, siapa pun yang berhasil login ke aplikasi bisa memanggilnya
-- sambil mengisi company_id perusahaan LAIN — dan mendapat jawabannya, karena
-- SECURITY DEFINER membuat fungsi berjalan dengan hak pembuatnya, melewati RLS.
-- Itu kebocoran antar-tenant, persis hal yang seluruh lapisan RLS proyek ini jaga.
--
-- PERBAIKANNYA DUA LAPIS, sengaja tidak cuma satu:
-- 1. SECURITY DEFINER DIHAPUS. Fungsi ini hanya dipanggil dari sisi server memakai
--    service role, yang memang sudah melewati RLS — jadi hak istimewa itu tidak pernah
--    dibutuhkan sejak awal. Memberi hak istimewa yang tidak dipakai adalah risiko gratis.
-- 2. IZIN EKSEKUSI DICABUT dari public/anon/authenticated, lalu diberikan HANYA ke
--    service_role. Lapis kedua ini tetap dipasang walau lapis pertama sudah cukup:
--    kalau suatu hari ada yang mengembalikan SECURITY DEFINER tanpa berpikir panjang,
--    izin yang sudah tercabut masih menahan.

drop function if exists total_qty_pernah_masuk(integer, integer);

create function total_qty_pernah_masuk(p_company_id integer, p_item_id integer)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(sm.qty), 0)
  from stock_movements sm
  join lots l on l.lot_id = sm.lot_id
  where sm.company_id = p_company_id
    and l.item_id = p_item_id
    and (
      sm.movement_type in ('receipt', 'production_output')
      or (sm.movement_type = 'adjustment' and sm.qty > 0)
    );
$$;

revoke execute on function total_qty_pernah_masuk(integer, integer) from public;
revoke execute on function total_qty_pernah_masuk(integer, integer) from anon;
revoke execute on function total_qty_pernah_masuk(integer, integer) from authenticated;
grant execute on function total_qty_pernah_masuk(integer, integer) to service_role;

comment on function total_qty_pernah_masuk(integer, integer) is
  'Jumlah yang PERNAH MASUK untuk sebuah item (MST-19): receipt + production_output + adjustment positif. '
  'Barang keluar TIDAK dikurangkan — bila dikurangkan, angka ini ikut menyusut saat barang dipakai dan '
  'ambang stok minimum jadi bergerak bersama stok yang diukurnya. '
  'HANYA service_role yang boleh mengeksekusi: fungsi ini menerima company_id sebagai parameter, jadi '
  'izin yang lebih luas berarti satu tenant bisa menanyakan angka tenant lain.';
