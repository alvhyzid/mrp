-- GDG-10 lanjutan (25 Agu 2026): kesiapan Work Order dihitung DARI DATA, bukan dari
-- adanya baris peringatan.
--
-- ============================================================================
-- KENAPA INI HARUS DULUAN
-- ============================================================================
-- Pemilik produk memutuskan peringatan `material_shortage` PER WORK ORDER dicabut, dan
-- peringatan gabungan per bahan menyebutkan perintah produksinya sendiri.
--
-- Tapi baris peringatan itu BUKAN cuma pemberitahuan: ia satu-satunya hal yang membuat
-- sebuah Work Order tampil "Terhambat". View work_orders_readiness menyatakan blocked bila
-- ADA peringatan terbuka yang menunjuk work_order_id itu. Mencabut peringatannya lebih dulu
-- akan membuat Work Order yang bahannya kurang tampil "Siap Mulai" -- dan tidak ada satu pun
-- yang gagal atau berwarna merah saat itu terjadi. Lubang yang TIDAK BERBUNYI.
--
-- Aturan proyek sudah menyebutnya: pengaman lama dicabut HANYA setelah penggantinya
-- terbukti bekerja. Migrasi ini penggantinya; pencabutannya menyusul di migrasi berikutnya,
-- setelah test membuktikan kesiapan tetap terbaca "blocked" tanpa peringatan itu.
--
-- ============================================================================
-- BEDA DISENGAJA: stok PER PLANT di sini, LINTAS PLANT di peringatan bahan
-- ============================================================================
-- Yang dinilai di sini satu Work Order tertentu, dan ia hanya bisa memakai bahan yang ada
-- di pabriknya sendiri. Peringatan pembelian menilai BAHANNYA, dan bahan di gudang sebelah
-- tetap bahan yang dimiliki perusahaan. Dua pertanyaan berbeda, dua jawaban berbeda -- bukan
-- ketidakkonsistenan.
--
-- CATATAN TEKNIS: kolom BARU wajib ditaruh di AKHIR daftar. CREATE OR REPLACE VIEW
-- mencocokkan kolom menurut POSISI, jadi menyisipkannya di tengah dibaca Postgres sebagai
-- "mengganti nama kolom" dan ditolak.
create or replace view work_orders_readiness as
select
  wo.work_order_id,
  wo.company_id,
  wo.status,
  (
    select count(distinct row(sa.alert_type, sa.related_item_id))
    from system_alerts sa
    where sa.related_work_order_id = wo.work_order_id and sa.status = 'open'
  ) as open_alert_count,
  case
    when wo.status <> all (array['planned', 'in_progress']) then wo.status
    when exists (
      select 1 from system_alerts sa
      where sa.related_work_order_id = wo.work_order_id and sa.status = 'open'
    ) then 'blocked'
    -- SUMBER KEDUA, dihitung langsung dari bahan: berlaku meski tidak ada satu pun baris
    -- peringatan yang menunjuk Work Order ini.
    when coalesce((
      select bool_or(
        bl.qty_per_unit_output * wo.planned_qty > coalesce((
          select sum(l.quantity_on_hand)
          from lots l
          where l.item_id = bl.component_item_id
            and l.production_plant_id = wo.production_plant_id
            and l.status = 'available'
        ), 0)
      )
      from bom_lines bl
      where bl.bom_id = wo.bom_id
    ), false) then 'blocked'
    when wo.status = 'planned' then 'ready'
    else wo.status
  end as readiness,
  coalesce((
    select bool_or(
      bl.qty_per_unit_output * wo.planned_qty > coalesce((
        select sum(l.quantity_on_hand)
        from lots l
        where l.item_id = bl.component_item_id
          and l.production_plant_id = wo.production_plant_id
          and l.status = 'available'
      ), 0)
    )
    from bom_lines bl
    where bl.bom_id = wo.bom_id
  ), false) as kekurangan_bahan
from work_orders wo;
