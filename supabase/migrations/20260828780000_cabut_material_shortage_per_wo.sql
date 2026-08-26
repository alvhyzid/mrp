-- GDG-10 penutup (25 Agu 2026): peringatan `material_shortage` PER WORK ORDER dicabut.
--
-- Keputusan pemilik produk: satu bahan = satu peringatan, dan peringatan itu menyebut
-- sendiri perintah produksi mana yang tertahan. Dua peringatan untuk satu bahan memaksa
-- orang menerjemahkan dua jawaban jadi satu keputusan.
--
-- BOLEH DICABUT SEKARANG karena penggantinya SUDAH TERBUKTI, bukan sekadar sudah ditulis:
-- migrasi 20260828770000 membuat work_orders_readiness menghitung kekurangan bahan langsung
-- dari BOM dan lot, dan tests/kesiapan_wo_dari_data.test.ts membuktikan Work Order yang
-- bahannya kurang tetap terbaca "blocked" DENGAN NOL baris peringatan di tabel.
--
-- Fungsinya TIDAK dihapus, hanya berhenti membuat peringatan. Ia tetap dipanggil trigger
-- yang sudah ada, dan tetap menutup peringatan lama yang masih menggantung -- menghapus
-- fungsinya berarti menyentuh trigger di beberapa tempat sekaligus tanpa manfaat tambahan.
create or replace function public.recompute_work_order_material_readiness(p_work_order_id integer)
returns void
language plpgsql
as $fn$
declare
  v_wo work_orders%rowtype;
  v_line record;
begin
  select * into v_wo from work_orders where work_order_id = p_work_order_id;
  if v_wo.work_order_id is null then
    return;
  end if;

  -- Kekurangan bahan TIDAK LAGI melahirkan peringatan di sini. Kesiapan Work Order kini
  -- dihitung dari data di view work_orders_readiness, dan pemberitahuan ke manusia datang
  -- dari peringatan gabungan per bahan (refreshLowStockAlerts + alasanPeringatanBahan).
  --
  -- Yang tersisa: MENUTUP peringatan lama yang masih terbuka, supaya tidak ada yang
  -- menggantung selamanya setelah pembuatnya berhenti bekerja.
  for v_line in
    select bl.component_item_id
    from bom_lines bl
    where bl.bom_id = v_wo.bom_id
  loop
    perform public.resolve_department_alerts('material_shortage', p_work_order_id, v_line.component_item_id);
  end loop;
end;
$fn$;

-- Peringatan per Work Order yang MASIH TERBUKA ditutup sekali, di sini. Tanpa ini,
-- peringatan lama akan menggantung selamanya: pembuatnya sudah berhenti, dan penutupnya
-- hanya berjalan untuk Work Order yang kebetulan tersentuh trigger lagi.
update system_alerts
set status = 'resolved'
where alert_type = 'material_shortage'
  and status = 'open'
  and related_work_order_id is not null;
