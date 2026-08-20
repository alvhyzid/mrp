-- "Alasan tercatat" (§3.1, non-negotiable) untuk hard delete berkas yatim -- reason
-- HARUS persisten (bukan cuma dikembalikan di response API), jadi document_access_log
-- diperluas: action 'delete' + kolom reason.

alter table document_access_log drop constraint if exists document_access_log_action_check;
alter table document_access_log add constraint document_access_log_action_check check (action in ('view', 'download', 'delete'));

alter table document_access_log add column if not exists reason text;

-- Baris log 'delete' ditulis SEBELUM baris documents-nya dihapus (kronologi
-- FK-safe), tapi log audit harus TETAP HIDUP setelah dokumennya benar-benar hilang
-- (itulah gunanya audit trail) -- document_id jadi nullable + ON DELETE SET NULL,
-- bukan RESTRICT (yang tadinya membuat delete documents gagal karena log-nya sendiri
-- masih menaut).
alter table document_access_log alter column document_id drop not null;
alter table document_access_log drop constraint if exists document_access_log_document_id_fkey;
alter table document_access_log add constraint document_access_log_document_id_fkey foreign key (document_id) references documents(document_id) on delete set null;

-- Judul disalin ke log SEBELUM dokumennya hilang -- supaya baris 'delete' masih
-- bermakna dibaca manusia meski document_id sudah null.
alter table document_access_log add column if not exists document_title_snapshot text;
