-- Migration: backlog Kamus utk 4 kolom baru (Sesi 0C, migrasi 20260827160000)
-- di sales_order_line_margin_snapshots & sales_order_line_feasibility_snapshots
-- -- kolom baru wajib masuk antrean Kamus sesuai aturan proyek. Draf AI awal
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
    (v_company_id, 'FIELD', 'sales_order_line_margin_snapshots', 'archived_at', 'sales_order_line_margin_snapshots.archived_at', 3, 'status', 'finance', 'DRAF_AI', 'Waktu baseline margin ini DIGANTIKAN oleh baseline baru (kunci ulang company_admin) -- NULL berarti baseline ini yang AKTIF/berlaku sekarang. Baris tidak pernah dihapus, hanya diarsipkan (Sesi 0C, 21 Agu 2026).'),
    (v_company_id, 'FIELD', 'sales_order_line_margin_snapshots', 'archived_reason', 'sales_order_line_margin_snapshots.archived_reason', 3, 'status', 'finance', 'DRAF_AI', 'Alasan yang diisi company_admin saat mengunci ULANG baseline margin, tersimpan di baris LAMA yang jadi diarsipkan.'),
    (v_company_id, 'FIELD', 'sales_order_line_margin_snapshots', 'locked_by', 'sales_order_line_margin_snapshots.locked_by', 3, 'status', 'finance', 'DRAF_AI', 'user_id yang mengklik "Kunci sebagai Acuan Pembanding" -- audit siapa mengunci baseline ini.'),
    (v_company_id, 'FIELD', 'sales_order_line_margin_snapshots', 'relock_reason', 'sales_order_line_margin_snapshots.relock_reason', 3, 'status', 'finance', 'DRAF_AI', 'Alasan yang sama dengan archived_reason baris lama, disalin ke baris BARU supaya terlihat langsung tanpa perlu cari baris yang diarsipkan.'),
    (v_company_id, 'FIELD', 'sales_order_line_feasibility_snapshots', 'archived_at', 'sales_order_line_feasibility_snapshots.archived_at', 3, 'status', 'ppic', 'DRAF_AI', 'Waktu rencana kelayakan ini DIGANTIKAN oleh rencana baru (kunci ulang company_admin) -- NULL berarti rencana ini yang AKTIF/berlaku sekarang.'),
    (v_company_id, 'FIELD', 'sales_order_line_feasibility_snapshots', 'archived_reason', 'sales_order_line_feasibility_snapshots.archived_reason', 3, 'status', 'ppic', 'DRAF_AI', 'Alasan yang diisi company_admin saat mengunci ULANG rencana kelayakan, tersimpan di baris LAMA yang jadi diarsipkan.'),
    (v_company_id, 'FIELD', 'sales_order_line_feasibility_snapshots', 'locked_by', 'sales_order_line_feasibility_snapshots.locked_by', 3, 'status', 'ppic', 'DRAF_AI', 'user_id yang mengklik "Kunci sebagai Acuan Pembanding" -- audit siapa mengunci rencana ini.'),
    (v_company_id, 'FIELD', 'sales_order_line_feasibility_snapshots', 'relock_reason', 'sales_order_line_feasibility_snapshots.relock_reason', 3, 'status', 'ppic', 'DRAF_AI', 'Alasan yang sama dengan archived_reason baris lama, disalin ke baris BARU supaya terlihat langsung tanpa perlu cari baris yang diarsipkan.')
  on conflict (company_id, term_key) do nothing;
end $$;
