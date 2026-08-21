-- Migration: Faktor Sachet Roll Etawa Fit -> presisi penuh + koreksi yield
-- MLVT-BOX (tugas "Faktor Sachet Roll + rekonsiliasi penanggalan + BOM premix
-- MLVT + arkeologi pengukuran yield", dikerjakan setelah kerangka MLVT
-- 20260827120000). Laporan lengkap (Bagian A-D) ada di HANDOFF.md dan pesan chat.
--
-- CATATAN PENANGGALAN (Bagian A tugas ini, WAJIB dibaca sebelum menambah migrasi
-- baru lagi setelah ini): `date -u` mesin saat migrasi ini ditulis mengembalikan
-- 2026-08-21T02:24:02Z (21 Agu 2026). Migrasi TERAKHIR yang SUDAH DITERAPKAN
-- sebelum ini, 20260827120000, memakai timestamp filename 27 Agu 2026 -- 6 hari
-- LEBIH MAJU dari tanggal mesin sungguhan hari itu. Ini drift penanggalan nyata
-- (ditemukan, bukan diperbaiki dengan rename -- rename file yang sudah diterapkan
-- memutus riwayat `schema_migrations`, dilarang eksplisit). Timestamp file INI
-- (20260827130000) sengaja dipilih LEBIH BESAR dari 20260827120000 (bukan
-- 20260821... yang sesuai tanggal mesin sungguhan), supaya urutan migrasi tetap
-- benar -- sesuai instruksi eksplisit "kalau bertentangan [antara tanggal mesin
-- dan urutan file], pakai yang lebih besar". Migrasi BERIKUTNYA setelah ini harus
-- memakai timestamp > 20260827130000, terlepas dari tanggal mesin saat itu,
-- SAMPAI drift ini diluruskan lewat keputusan eksplisit pemilik produk (belum
-- diminta di tugas ini).

do $$
declare
  v_company_id integer;
  v_item_sachet_roll_id integer;
  v_item_box_id integer;
  v_col record;
  v_old_factor numeric;
  v_old_cost numeric;
  v_new_cost numeric;
  v_rows_updated integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- ═══ B1. ARKEOLOGI -- presisi kolom APA ADANYA dari information_schema, DULU,
  -- sebelum mengasumsikan apa pun (dicatat via RAISE NOTICE, muncul di log
  -- `supabase db push`). ═══
  select data_type, numeric_precision, numeric_scale into v_col
    from information_schema.columns
    where table_schema = 'public' and table_name = 'items' and column_name = 'standard_cost';
  raise notice 'ARKEOLOGI items.standard_cost: data_type=%, numeric_precision=%, numeric_scale=%', v_col.data_type, v_col.numeric_precision, v_col.numeric_scale;

  select data_type, numeric_precision, numeric_scale into v_col
    from information_schema.columns
    where table_schema = 'public' and table_name = 'items' and column_name = 'uom_conversion_factor';
  raise notice 'ARKEOLOGI items.uom_conversion_factor: data_type=%, numeric_precision=%, numeric_scale=%', v_col.data_type, v_col.numeric_precision, v_col.numeric_scale;

  -- lots.unit_cost disebut literal di instruksi tugas, TAPI BUKAN kolom yang
  -- diubah migrasi ini -- Sachet Roll Etawa Fit MLVT belum pernah diterima/dibeli
  -- (0 lot, dicek sebelum migrasi ini ditulis), jadi harganya masih di level
  -- perencanaan (items.standard_cost), belum ada instance lot nyata untuk dikoreksi.
  select data_type, numeric_precision, numeric_scale into v_col
    from information_schema.columns
    where table_schema = 'public' and table_name = 'lots' and column_name = 'unit_cost';
  raise notice 'ARKEOLOGI lots.unit_cost (referensi, BUKAN kolom yang diubah): data_type=%, numeric_precision=%, numeric_scale=%', v_col.data_type, v_col.numeric_precision, v_col.numeric_scale;

  select item_id, uom_conversion_factor, standard_cost into v_item_sachet_roll_id, v_old_factor, v_old_cost
  from items where company_id = v_company_id and item_code = 'SACHET-ROLL-ETAWAFIT/001ITM';

  if v_item_sachet_roll_id is null then
    raise notice 'Item SACHET-ROLL-ETAWAFIT/001ITM tidak ditemukan -- migrasi dilewati.';
    return;
  end if;

  raise notice 'SEBELUM migrasi -- SACHET-ROLL-ETAWAFIT/001ITM: uom_conversion_factor=%, standard_cost=%', v_old_factor, v_old_cost;

  -- ═══ B2+B3. Faktor TEPAT 3333 sachet/roll (BUKAN 3333,333333 seperti
  -- sebelumnya): 3333 x 15 cm = 499,95 m dari roll 500 m -- sisa 5 cm TIDAK CUKUP
  -- untuk 1 sachet utuh (butuh 15 cm), jadi sachet ke-3334 tidak pernah nyata ada.
  -- standard_cost = 1.566.000 / 3333 pada PRESISI PENUH yang didukung kolom
  -- (numeric(14,4) -- dibuktikan RAISE NOTICE arkeologi di atas), BUKAN dibulatkan
  -- ke 469,85 (2 desimal) seperti sebelumnya. round(...,4) di bawah HANYA
  -- membulatkan ke batas presisi KOLOM itu sendiri (kolom memang cuma sanggup
  -- 4 desimal) -- bukan pembulatan tampilan, dan BUKAN 469,85. Konsekuensi yang
  -- SUDAH disetujui pemilik produk: biaya kemasan/box MLVT bergeser dari
  -- Rp7.198,50 -> Rp7.198,4698... (tampil Rp7.198,47), selisih Rp0,03/box --
  -- BUKAN regresi, dan tests/mlvt_case_study_skeleton.test.ts diperbarui utk ini
  -- (lihat komit yang sama).
  v_new_cost := round(1566000::numeric / 3333::numeric, 4);
  raise notice 'standard_cost presisi penuh dihitung: 1566000/3333 = % (dibulatkan ke 4 desimal sesuai numeric(14,4), BUKAN ke 469,85)', v_new_cost;

  update items
  set uom_conversion_factor = 3333, standard_cost = v_new_cost
  where item_id = v_item_sachet_roll_id
    and (uom_conversion_factor is distinct from 3333 or standard_cost is distinct from v_new_cost);
  get diagnostics v_rows_updated = row_count;
  raise notice 'Baris items (SACHET-ROLL-ETAWAFIT/001ITM) diperbarui: % (idempoten -- run kedua migrasi ini akan mencatat 0)', v_rows_updated;

  -- ═══ C4 (dikerjakan meski C3/isi BOM premix DILEWATI -- 16 bahan baku belum
  -- ada di master item, lihat laporan chat/HANDOFF.md untuk daftar lengkap).
  -- Yield MLVT-BOX dikoreksi dari 95% (angka PINJAMAN dari Drinkme lama, sesuai
  -- instruksi eksplisit "reuse titik awal" sebelumnya -- TAPI belum pernah diukur
  -- untuk MLVT sungguhan) menjadi 100% + catatan eksplisit "belum diukur".
  -- Alasan: yield akan DIPELAJARI dari batch nyata lewat K8 (production_standards
  -- source DIPELAJARI nanti) -- menanam 95% lebih dulu membuat rencana konsumsi
  -- bahan ikut membesar 1/0,95x sebelum ada data, sehingga pengukuran pertama
  -- nanti diam-diam "mengukur" asumsi ini sendiri, bukan kenyataan lapangan. ═══
  select item_id into v_item_box_id from items where company_id = v_company_id and item_code = 'MLVT-BOX/001ITM';
  if v_item_box_id is not null then
    update production_standards
    set value = 100, source = 'ESTIMASI_MANUAL', sample_count = 0, pinned = false,
        pin_reason = 'BELUM DIUKUR -- menunggu batch nyata'
    where company_id = v_company_id and item_id = v_item_box_id and routing_step_id is null and metric_key = 'yield_percentage'
      and value is distinct from 100;
    get diagnostics v_rows_updated = row_count;
    raise notice 'Baris production_standards (yield_percentage MLVT-BOX) diperbarui: % (idempoten)', v_rows_updated;
  end if;
end $$;
