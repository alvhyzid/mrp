-- Migration: backlog Kamus utk 4 kolom baru (Sesi 5, migrasi 20260827210000)
-- di sales_order_line_feasibility_snapshots -- kolom baru wajib masuk antrean
-- Kamus sesuai aturan proyek. Draf AI awal ditulis apa adanya (bukan panggilan
-- LLM), status DRAF_AI menunggu konfirmasi pemilik produk seperti term Kamus
-- lain.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- backlog Kamus dilewati (no-op).';
    return;
  end if;

  insert into kamus_terms (company_id, scope, entity, field, term_key, priority, domain, suggested_role, status, ai_draft)
  values
    (v_company_id, 'FIELD', 'sales_order_line_feasibility_snapshots', 'unit_per_batch_source', 'sales_order_line_feasibility_snapshots.unit_per_batch_source', 3, 'standar', 'ppic', 'DRAF_AI', 'Salinan production_standards.source (ESTIMASI_MANUAL/DIPELAJARI) untuk unit_per_batch, PERSIS pada saat rencana ini dikunci -- supaya diketahui apakah angka ini tebakan kasar atau hasil belajar dari batch nyata.'),
    (v_company_id, 'FIELD', 'sales_order_line_feasibility_snapshots', 'unit_per_batch_sample_count', 'sales_order_line_feasibility_snapshots.unit_per_batch_sample_count', 3, 'standar', 'ppic', 'DRAF_AI', 'Salinan production_standards.sample_count untuk unit_per_batch pada saat dikunci -- jumlah batch nyata yang mendasari kalau source=DIPELAJARI, NULL/tidak relevan kalau ESTIMASI_MANUAL.'),
    (v_company_id, 'FIELD', 'sales_order_line_feasibility_snapshots', 'batches_per_day_source', 'sales_order_line_feasibility_snapshots.batches_per_day_source', 3, 'standar', 'ppic', 'DRAF_AI', 'Salinan production_standards.source untuk batches_per_day, PERSIS pada saat rencana ini dikunci.'),
    (v_company_id, 'FIELD', 'sales_order_line_feasibility_snapshots', 'batches_per_day_sample_count', 'sales_order_line_feasibility_snapshots.batches_per_day_sample_count', 3, 'standar', 'ppic', 'DRAF_AI', 'Salinan production_standards.sample_count untuk batches_per_day pada saat dikunci.')
  on conflict (company_id, term_key) do nothing;
end $$;
