-- INF-06 (23 Agu 2026) -- bersihkan sisa fixture test di project data nyata.
-- Diverifikasi dulu SEBELUM migrasi ini ditulis (bukan asumsi): keenam
-- company di bawah masing-masing punya 2-29 baris menggantung (dicek lewat
-- debug_company_residual_scan), tersebar di tabel yang wajar untuk fixture
-- test terinterupsi (production_plants/items/boms/work_orders/system_alerts/
-- production_batches/users/status_transition_log) -- TIDAK ADA yang punya
-- data menggantung dalam jumlah tidak wajar. Backup tiga lapis sudah ada
-- (bawaan Supabase sejak 15 Agu, GitHub Actions, manual terverifikasi pulih)
-- sebelum migrasi ini dijalankan.
--
-- Idempoten: debug_force_delete_company() sendiri no-op kalau company_id
-- sudah tidak ada (cek keberadaan lebih dulu). company_id=1 (PT ITM) TIDAK
-- PERNAH disentuh -- daftar di bawah eksplisit, bukan pola/wildcard.
do $$
declare
  v_id integer;
  v_ids integer[] := array[3197, 3666, 3801, 4157, 6300, 6835]; -- PlantConsolidationTestCorp, Sesi0BRoleTestCorp, BaselineLockSeparationTestCorp, RoutingBomSnapshotTestCorp, AiProjectDashboardTestCorp, BatchLifecycleTestCorp
begin
  foreach v_id in array v_ids
  loop
    if v_id = 1 then
      raise exception 'PELANGGARAN INVARIAN 9: migrasi ini tidak boleh menyentuh company_id=1';
    end if;
    if exists (select 1 from companies where company_id = v_id) then
      perform public.debug_force_delete_company(v_id);
      raise notice 'company_id % dihapus.', v_id;
    else
      raise notice 'company_id % sudah tidak ada -- dilewati (no-op, idempoten).', v_id;
    end if;
  end loop;
end $$;
