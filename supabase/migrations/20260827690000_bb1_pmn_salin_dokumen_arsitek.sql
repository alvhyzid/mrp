-- BB.1 -- catat task untuk pelajaran "4 dokumen tidak ditemukan di repo"
-- (AA.1): file itu memang tidak pernah ada di repo -- diunggah pemilik
-- produk langsung ke sesi arsitek, kesalahan arsitek menyuruh mencarinya
-- di repo. Ditutup LANGSUNG karena keempat dokumen sudah disalin ke docs/
-- oleh pemilik produk pada giliran yang sama (rencana-routing-nonlinear.md,
-- checklist-fase-spec-vs-fabrix.md, antrean-koreksi-fitur-ada.md,
-- instruksi-rebrand-fabrix.md -- dikonfirmasi ada lewat `ls docs/`).
--
-- CATATAN PENYIMPANGAN KODE TASK: diminta sebagai "PMN-xx", TAPI modul PMN
-- sudah dipakai untuk "Process Mining" (PMN-01) -- task ini SAMA SEKALI
-- tidak berhubungan dengan process mining, memakainya akan salah kelompok
-- di halaman Daftar Tugas. Dicatat sebagai AUD-10 (Audit Kualitas) sebagai
-- gantinya -- keputusan teknis penomoran/pengelompokan, isi & maksud task
-- tetap persis seperti diminta.
-- II.1 (22 Agu 2026) -- ditambal pola aman (lihat 20260827605000/HANDOFF.md).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- seed build_tasks (migrasi ini) dilewati (no-op).';
    return;
  end if;

insert into public.build_tasks
  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, origin, detail_pekerjaan, notes, completed_at)
values (
  v_company_id, 'AUD-10', 'Salin Dokumen Rencana dari Sesi Arsitek ke Repo', 'AUD', 'Audit Kualitas',
  'Empat dokumen rencana (rencana-routing-nonlinear.md, checklist-fase-spec-vs-fabrix.md, antrean-koreksi-fitur-ada.md, instruksi-rebrand-fabrix.md) hanya ada di riwayat percakapan sesi arsitek, tidak pernah ada di repo ini.',
  'Selama dokumen itu hanya ada di sesi arsitek, isinya tidak bisa dibaca sesi Claude Code mana pun, dan temuan/rencana di dalamnya tidak bisa disapu jadi task -- ditemukan lewat AA.1 (sinkronisasi audit-lubang-ui.md, 22 Agu 2026) saat mencari 4 nama dokumen ini di repo dan hasilnya nihil.',
  'penting', array['Dokumentasi'], 'Pemilik Produk', 'selesai', 'temuan_claude',
  'Salin isi lengkap keempat dokumen dari sesi arsitek ke docs/ di repo ini, format markdown biasa.',
  'DITUTUP di giliran yang sama -- keempat dokumen sudah disalin pemilik produk ke docs/ sebelum task ini sempat dikerjakan siapa pun. Isi ringkas tiap dokumen (untuk pemilik produk memverifikasi ini dokumen yang benar): rencana-routing-nonlinear.md (arsitektur routing bercabang/paralel), checklist-fase-spec-vs-fabrix.md (perbandingan spesifikasi awal vs implementasi FABRIX), antrean-koreksi-fitur-ada.md (daftar koreksi kecil fitur yang sudah ada), instruksi-rebrand-fabrix.md (langkah rebrand ke nama FABRIX).',
  now()
);

end $$;
