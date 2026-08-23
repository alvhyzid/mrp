-- NN.1-NN.2 (23 Agu 2026) -- hipotesis cold start/timeout DIUJI dan PATAH.
-- Hipotesis pengganti dicatat, beserta cara memastikannya dalam 1 langkah.
do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name='PT ITM' limit 1;
  if v_company_id is null then raise notice 'PT ITM tidak ditemukan -- dilewati.'; return; end if;

  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nHIPOTESIS COLD START/TIMEOUT: DIUJI, PATAH (23 Agu 2026, NN.1-NN.2).\n\n' ||
      E'(a) Suite dijalankan ulang dengan `--hookTimeout=10000` (sepertiga dari 30 detik yang dipakai CI): **tetap 45/45 file lulus, 268 test, NOL "Hook timed out"**. Kalau hook memang mepet batas, menurunkan batas 3x seharusnya memunculkan kegagalan -- tidak muncul sama sekali.\n\n' ||
      E'(b) Cold start Edge Function DIUKUR: login pertama 1.829 ms, rata-rata login berikutnya 536 ms (selisih 1,3 detik, 3,4x). Nyata, tapi jauh dari batas 30 detik.\n\n' ||
      E'(c) BUKTI YANG MEMATAHKAN: step "Test suite" di CI hanya berjalan **300 detik**, sementara suite yang sama di lokal butuh **704 detik**. Kalau penyebabnya timeout, CI akan LEBIH LAMA -- bukan LEBIH CEPAT. CI **gagal cepat**, bukan menggantung. Argumen latensi lintas benua (runner GitHub di AS, project di Sydney; dari sini ping cuma 34 ms) tetap benar sebagai fakta, TAPI arah buktinya berlawanan dengan gejala.\n\n' ||
      E'HIPOTESIS PENGGANTI, PALING COCOK DENGAN SELURUH GEJALA: nilai secret `SUPABASE_SERVICE_ROLE_KEY` di GitHub kemungkinan TERSALIN DALAM KEADAAN TERSAMAR (mengandung karakter penyamar), persis jebakan yang sama yang mematikan login production beberapa jam sebelumnya. Cocok dengan SEMUANYA: (1) gagal cepat -- hampir semua `beforeAll` membuat user/fixture lewat service role, jadi langsung tumbang di langkah pertama; (2) NOL jejak fixture di ketiga project -- tidak ada satu pun baris sempat tertulis; (3) FABRIX-APP tidak tersentuh; (4) typecheck lulus (tidak menyentuh database); (5) lokal lulus penuh -- kunci di `.env.local` utuh. Catatan: hanya 2 dari 45 file yang memakai akun pra-seed, jadi ketidakcocokan password BUKAN penjelasan yang memadai.\n\n' ||
      E'CARA MEMASTIKAN DALAM 1 LANGKAH (untuk pemilik produk): buka Supabase Dashboard -> fabrix-ci-test -> Settings -> API Keys -> **Secret key** -> pakai TOMBOL SALIN (ikon copy), JANGAN blok-dan-salin dari teks yang tampil (yang tampil disamarkan). Tempel ulang ke GitHub Secret `SUPABASE_SERVICE_ROLE_KEY`. Lalu jalankan ulang CI (tab Actions -> run terakhir -> Re-run all jobs). Bila hijau, selesai.\n\n' ||
      E'ALTERNATIF bila itu pun gagal: salin 20 baris galat pertama dari log CI -- itu satu-satunya jalur yang tersisa (unduh log lewat API MENSYARATKAN hak admin repo, 403 berulang dan konsisten).'
  where task_code='INF-19' and company_id=v_company_id;
end $$;
