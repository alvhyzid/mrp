-- Jawaban pemeriksaan kebersihan menyeluruh + tiga hal yang belum ditutup (25 Agu 2026).

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

-- MST-22 dilengkapi: ternyata BUKAN satu-satunya.
update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'DIPERIKSA MENYELURUH 25 Agu 2026 (3.2): pabrik BUKAN satu-satunya. Seluruh 18 endpoint ' ||
    E'rantai MLVT disisir metodenya, dan ADA DUA yang hanya bisa DIBACA:\n' ||
    E'  - production-plants : GET saja\n' ||
    E'  - work-centers      : GET saja\n\n' ||
    E'Keduanya master data yang menopang produksi: pabrik menentukan lokasi, work center menentukan ' ||
    E'mesin yang dipakai langkah routing. Keduanya lahir dari migrasi/skrip dan tidak punya jalur ' ||
    E'pembuatan lewat layar sama sekali.\n\n' ||
    E'YANG BUKAN MASALAH, sudah diperiksa supaya tidak salah dilaporkan: routing-steps juga GET saja, ' ||
    E'TAPI langkah routing memang dibuat menyatu lewat POST /api/routings (createRouting menerima ' ||
    E'daftar `steps` sekaligus). Jadi itu rancangan, bukan lubang.\n\n' ||
    E'TIDAK MENGHALANGI latihan MLVT sekarang: PT ITM sudah punya 3 pabrik dan 1 work center ' ||
    E'(WC-FILLING-SACHET) yang dipakai routing 10 tahap.'
where task_code = 'MST-22';

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'MST-23', 'Tidak Ada Layar untuk Membuat Work Center', 'MST', 'Master Data',
  'Endpoint work-centers hanya punya GET. Sama seperti pabrik (MST-22): tidak ada jalur membuat atau mengubah mesin/stasiun kerja lewat layar.',
  'Routing tidak bisa menunjuk mesin yang belum terdaftar. Selama hanya ada satu mesin filling sachet, tidak terasa; ia menggigit saat ada mesin kedua, atau saat tenant lain mendaftarkan lini produksinya sendiri.',
  'penting', array['master-data','layar-hilang'], 'Claude Code + Pemilik Produk', 'menunggu', 'temuan_claude',
  E'DITEMUKAN 25 Agu 2026 lewat penyisiran metode HTTP seluruh endpoint rantai MLVT, bukan lewat ' ||
  E'mentok saat memakai. Kelasnya sama persis dengan MST-22 -- dan itu justru alasan mencatatnya ' ||
  E'terpisah: memperbaiki satu tanpa yang lain akan meninggalkan separuh masalah dengan tampilan ' ||
  E'seolah sudah beres.\n\n' ||
  E'PT ITM saat ini punya 1 work center: WC-FILLING-SACHET (Mesin Filling Sachet).'
) on conflict (company_id, task_code) do nothing;

-- SLS-06 dijawab tuntas.
update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'DIJAWAB 25 Agu 2026 (3.3), dengan memeriksa src/lib/roles.ts dan daftar akun sungguhan.\n\n' ||
    E'(a) SIAPA YANG BERWENANG per departemen, dan akun PT ITM mana yang memilikinya:\n' ||
    E'      finance  -> HANYA finance_manager   -> finance.a@debug.mrp\n' ||
    E'      ppic     -> HANYA ppic_manager      -> ppic.a@debug.mrp\n' ||
    E'      manager  -> pimpinan perusahaan     -> company.a@debug.mrp\n\n' ||
    E'(b) BISAKAH SATU AKUN MEMEGANG BEBERAPA PERAN? TIDAK. Tabel users hanya punya SATU kolom ' ||
    E'`role` -- satu akun, satu peran. Jadi pemilik produk memang harus berpindah akun TIGA KALI ' ||
    E'di langkah itu. Tidak ada jalan pintas yang sah tanpa mengubah rancangan.\n\n' ||
    E'(c) APAKAH INI ATURAN BISNIS YANG PERNAH DIPUTUSKAN? YA -- dan ini yang membuatnya TIDAK perlu ' ||
    E'disodorkan sebagai pertanyaan. Tercatat di docs/rancangan-skema-database-mrp.md: "Wajib ' ||
    E'disetujui 3 department secara terpisah sebelum tombol Process aktif" dan "Approval wajib dari ' ||
    E'3 department sebelum PO client bisa diproses jadi SO". Dokumen itu salah satu dari dua rujukan ' ||
    E'yang menurut CLAUDE.md sudah didiskusikan panjang dengan pemilik produk.\n\n' ||
    E'JADI YANG DIBUTUHKAN BUKAN PERUBAHAN ATURAN, melainkan supaya pemilik produk TAHU LEBIH DULU ' ||
    E'bahwa langkah 6 menuntut tiga login berbeda -- bukan menemukannya saat sudah mengisi lima ' ||
    E'langkah sebelumnya.'
where task_code = 'SLS-06';

end $$;
