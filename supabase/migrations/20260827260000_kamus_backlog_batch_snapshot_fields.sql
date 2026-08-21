-- Migration: backlog Kamus utk kolom baru Sesi 6A (migrasi 20260827230000) --
-- kolom baru wajib masuk antrean Kamus sesuai aturan proyek. Draf AI awal
-- ditulis apa adanya (bukan panggilan LLM), status DRAF_AI menunggu konfirmasi
-- pemilik produk seperti term Kamus lain.
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
    (v_company_id, 'FIELD', 'production_batches', 'routing_snapshot_taken_at', 'production_batches.routing_snapshot_taken_at', 3, 'standar', 'ppic', 'DRAF_AI', 'Waktu routing/BOM batch ini DIBEKUKAN (Sesi 6A, 21 Agu 2026) -- diisi SAAT batch mulai, bukan saat dibuat/selesai. NULL berarti batch belum dimulai (tetap baca resep/routing terbaru) ATAU batch lama dari sebelum fitur ini ada.'),
    (v_company_id, 'FIELD', 'production_batches', 'snapshotted_routing_id', 'production_batches.snapshotted_routing_id', 3, 'standar', 'ppic', 'DRAF_AI', 'routing_id yang sedang berlaku saat batch ini dibekukan -- referensi, bukan sumber angka (angka standarnya ada di production_batch_routing_step_snapshots).'),
    (v_company_id, 'FIELD', 'production_batches', 'snapshotted_bom_id', 'production_batches.snapshotted_bom_id', 3, 'standar', 'ppic', 'DRAF_AI', 'bom_id yang sedang berlaku saat batch ini dibekukan -- referensi, bukan sumber angka (angka rasionya ada di production_batch_bom_line_snapshots).'),
    (v_company_id, 'FIELD', 'production_batches', 'snapshotted_bom_version', 'production_batches.snapshotted_bom_version', 3, 'standar', 'ppic', 'DRAF_AI', 'Salinan boms.version pada saat batch ini dibekukan -- murni catatan versi mana yang dipakai.'),
    (v_company_id, 'FIELD', 'production_batches', 'snapshotted_buffer_percentage', 'production_batches.snapshotted_buffer_percentage', 3, 'standar', 'ppic', 'DRAF_AI', 'Salinan boms.buffer_percentage pada saat batch ini dibekukan -- dipakai bersama production_batch_bom_line_snapshots utk hitung Kebutuhan Bahan batch ini, tidak ikut berubah walau buffer BOM diedit sesudahnya.'),
    (v_company_id, 'RELATION', 'production_batch_routing_step_snapshots', null, 'production_batch_routing_step_snapshots', 3, 'standar', 'ppic', 'DRAF_AI', 'Tahap routing beku PER BATCH (Sesi 6A) -- salinan routing_steps persis saat batch mulai, supaya durasi standar yang ditampilkan (Gantt/Kapasitas/detail blok) tidak ikut berubah kalau routing aslinya diedit belakangan.'),
    (v_company_id, 'RELATION', 'production_batch_bom_line_snapshots', null, 'production_batch_bom_line_snapshots', 3, 'standar', 'ppic', 'DRAF_AI', 'Baris BOM beku PER BATCH (Sesi 6A) -- salinan bom_lines persis saat batch mulai, supaya Kebutuhan Bahan yang ditampilkan tidak ikut berubah kalau BOM aslinya diedit belakangan.'),
    (v_company_id, 'RELATION', 'production_batch_standard_crew_snapshots', null, 'production_batch_standard_crew_snapshots', 3, 'standar', 'ppic', 'DRAF_AI', 'Standar kru beku PER BATCH (Sesi 6A) -- salinan routing_step_standard_crew persis saat batch mulai, disiapkan untuk kebutuhan ke depan (belum ada tampilan level-batch yang membacanya hari ini).')
  on conflict (company_id, term_key) do nothing;
end $$;
