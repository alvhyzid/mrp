-- OO.1-OO.5 (23 Agu 2026) -- keputusan pemilik produk: SAMBUNGKAN SEKARANG
-- (pilihan ii). Penyambungan production ke data nyata SELESAI & terverifikasi.
-- Ditambah: tiket dukungan Vercel (OO.3) dan pertanyaan kebijakan kata sandi
-- (OO.5) sebagai task terpisah.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- OO.1 -- INF-11 DITUTUP: alamat akses akhirnya ada
  update build_tasks
  set status = 'selesai',
      completed_at = now(),
      detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nDITUTUP 23 Agu 2026 -- KEPUTUSAN PEMILIK PRODUK: pilihan (ii) SAMBUNGKAN SEKARANG. Alasan tercatat: branch tracking terbukti tidak bisa diperbaiki dari sisi kita (seluruh jalur ditolak, lihat arkeologi di atas) dan bergantung pada tiket dukungan Vercel yang waktunya tidak bisa diperkirakan; menahan akses pemilik produk sampai itu selesai berarti menahan koreksi UX dan seluruh layar sesudahnya, demi memitigasi masalah KUALITAS RILIS yang penggunanya saat ini hanya pemilik produk sendiri.\n\n' ||
        E'DIKERJAKAN: 3 variabel lingkungan Production di Vercel project mrp-staging (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) dialihkan dari project staging kosong (nclkepwlsgmfbslgsajq) ke FABRIX-APP (kfvtrwuuqcjfkkuqizxt). Nilai kunci diambil langsung lewat Supabase CLI yang sudah terautentikasi di mesin ini dan dikirim ke Vercel API lewat token CLI yang juga sudah tersimpan -- TIDAK PERNAH melewati percakapan, sesuai aturan tetap proyek. Variabel target `preview` SENGAJA TIDAK disentuh (tetap menunjuk project kosong). Lalu production di-redeploy supaya nilai baru ikut ter-build (NEXT_PUBLIC_* ditanam saat build, bukan dibaca saat jalan).\n\n' ||
        E'BUKTI (4.3, seluruhnya dijalankan sungguhan): (a) bundle JavaScript situs production diunduh & diperiksa -- URL Supabase yang tertanam kini `https://kfvtrwuuqcjfkkuqizxt.supabase.co`, sebelumnya `nclkepwlsgmfbslgsajq`; (b) ISOLASI TENANT DIBUKTIKAN memakai kunci production yang sama: login sebagai tenant uji (company.b@debug.mrp) -> hanya melihat `Company B`, dan `employees_secure` mengembalikan 0 baris padahal PT ITM punya 30 -- data nyata TIDAK bocor ke tenant lain; (c) KONTRAK EKSTERNAL AMAN: `/pod/<token>` diakses TANPA login Vercel mengembalikan HTTP 200 dari APLIKASI (0 penanda Vercel SSO di HTML) -- pelanggan tetap bisa membuka bukti terima dari QR surat jalan yang sudah beredar; (d) jumlah baris company_id=1 IDENTIK sebelum & sesudah (employees 30, users 7, items 8, boms 6, sales_orders 1, build_tasks 194) -- penyambungan ini murni mengubah ke mana situs menunjuk, tidak menyentuh satu baris data pun.\n\n' ||
        E'ALAMAT UNTUK PEMILIK PRODUK: https://mrp-staging-zeta.vercel.app -- bisa dibuka dari HP maupun komputer mana pun, tidak perlu server dev menyala lagi. Masuk lewat tombol "Masuk" dengan akun PT ITM yang sudah ada. Menu Pelanggan: sisi kiri -> bagian "MRP" -> "Pelanggan". Menu Supplier: sisi kiri -> bagian "Purchasing" -> "PO Supplier" (pengelolaan Supplier ada DI DALAM halaman itu, bukan menu tersendiri -- kemungkinan besar inilah sebabnya dulu sulit ditemukan).\n\n' ||
        E'SISA YANG BELUM BERES (jangan dikira ikut selesai): Production Branch Vercel MASIH `main`, jadi setiap push ke main langsung terbit ke situs berisi data nyata. Aturan kerja sementara sudah dicatat di CLAUDE.md ("ATURAN SEMENTARA -- main = RILIS LANGSUNG"), dengan pemicu pencabutan: begitu branch tracking berhasil diubah ke staging (lihat INF-18, tiket dukungan Vercel). Branch `staging` SUDAH di-merge dari `main` (23 Agu 2026, commit 45d8fbb) supaya begitu setelan itu berhasil nanti, production TIDAK membeku di kode lama.'
  where task_code = 'INF-11' and company_id = v_company_id;

  -- OO.3 -- tiket dukungan Vercel
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-18', 'Tiket Dukungan Vercel: Production Branch Gagal Disimpan', 'INF', 'Infrastruktur & Environment',
    'Pengubahan Production Branch project mrp-staging dari `main` ke `staging` GAGAL DISIMPAN berkali-kali sejak beberapa hari lalu, dan tetap gagal setelah paket Pro aktif -- membantah dugaan "gagal karena paket". Setelan Vercel lain (nama tim, slug) berhasil disimpan; hanya setelan ini yang konsisten menolak.',
    'Selama ini belum beres, setiap push ke `main` langsung terbit ke situs production yang kini berisi data nyata PT ITM -- kode yang belum diuji langsung dipakai. Aturan kerja sementara di CLAUDE.md menambal ini lewat disiplin manusia, bukan lewat mekanisme -- dan disiplin manusia adalah yang paling sering gagal (pelajaran berulang proyek ini).',
    'mendesak', array['Integrasi'], 'Pemilik Produk', 'menunggu', null, 'pemilik_produk',
    E'LAPORKAN KE DUKUNGAN VERCEL dengan Request ID: sin1:sin1:sin1:sfo1::5gtlc-1787464249778-25b139a9ae5b\n\n' ||
      E'SERTAKAN RINGKASAN INI supaya dukungan tidak menyuruh mengulang yang sudah dicoba (hasil arkeologi 23 Agu 2026):\n' ||
      E'  - TIDAK ADA vercel.json di repo sama sekali -- bukan kasus setelan dashboard kalah dari berkas konfigurasi.\n' ||
      E'  - Branch `staging` ADA di remote GitHub (commit dc1f7b8 saat diperiksa, kini 45d8fbb), TIDAK protected, terlihat publik.\n' ||
      E'  - Percobaan lewat API publik: PATCH /v9/projects/mrp-staging dengan body {"link":{"productionBranch":"staging"}} ditolak `bad_request: Invalid request: should NOT have additional property "link"` -- productionBranch tidak diekspos di endpoint update project.\n' ||
      E'  - Vercel CLI v59.5.0 (terautentikasi) TIDAK punya subperintah untuk mengubah production branch.\n' ||
      E'  - Sambungan Git diverifikasi UTUH setelah seluruh percobaan (type=github, org=alvhyzid, repo=mrp) -- tidak ada yang rusak.\n' ||
      E'  - Paket sudah Pro (bukan batasan paket). Setelan Vercel lain di tim yang sama berhasil disimpan pada periode yang sama.\n\n' ||
      E'PERTANYAAN untuk dukungan: kenapa Production Branch tidak bisa disimpan lewat dashboard, dan apakah ada jalur resmi lain (API/CLI) untuk mengubahnya?\n\n' ||
      E'BEGITU BERHASIL: (1) verifikasi production ter-deploy dari `staging` (bukan `main`); (2) cabut bagian "ATURAN SEMENTARA -- main = RILIS LANGSUNG" dari CLAUDE.md; (3) sejak itu, merge ke `staging` yang jadi tindakan rilis, bukan push ke `main`.',
    'Ditemukan lewat Bagian 2 (23 Agu 2026) -- seluruh jalur yang bisa dicoba dari sisi kita sudah dicoba dan ditolak; ini bukan sesuatu yang bisa diselesaikan Claude Code.'
  )
  on conflict (company_id, task_code) do nothing;

  -- OO.5 -- kebijakan kata sandi, MENUNGGU KEPUTUSAN (jangan diputuskan sendiri)
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes,
    approval_review_steps, approval_location, approval_example_case, approval_if_approved, approval_if_rejected
  ) values (
    v_company_id, 'SEC-09', 'Kebijakan Panjang Kata Sandi Minimum (Sekarang 6 Karakter)', 'SEC', 'Keamanan',
    'Panjang kata sandi minimum saat ini 6 karakter. Untuk sistem berisi data gaji 31 orang, ini lemah -- kata sandi 6 karakter bisa ditebak mesin dalam hitungan detik.',
    'Kata sandi lemah adalah jalur masuk paling umum ke sistem apa pun, dan TIDAK tertahan oleh RLS maupun gerbang peran -- penyerang masuk sebagai pengguna yang sah, jadi seluruh lapisan pengaman lain menganggapnya berhak.',
    'penting', array['Keamanan'], 'Pemilik Produk', 'menunggu_persetujuan', null, 'temuan_claude',
    E'REKOMENDASI ARSITEK (bukan keputusan -- ini kebijakan hak akses, wajib diputuskan pemilik produk sesuai CLAUDE.md): naikkan minimum ke 12 karakter, DAN nyalakan SEC-08 (perlindungan kata sandi yang pernah bocor) BERSAMAAN -- keduanya saling melengkapi: panjang menahan tebakan mesin, HaveIBeenPwned menahan kata sandi panjang tapi sudah bocor di tempat lain.\n\n' ||
      E'KONSEKUENSI YANG WAJIB DISAMPAIKAN KE TIM SEBELUM DINYALAKAN (jangan mengejutkan): pengguna yang SUDAH ADA dengan kata sandi lebih pendek TIDAK otomatis terkunci -- mereka tetap bisa masuk seperti biasa. Yang berubah: begitu mereka mengganti kata sandi (atau diminta menggantinya), kata sandi baru WAJIB memenuhi aturan baru. Karena itu perubahan ini sebaiknya diberitahukan ke tim lebih dulu, bukan dinyalakan diam-diam.\n\n' ||
      E'CATATAN TEKNIS: nilai 6 saat ini terbaca di supabase/config.toml (`minimum_password_length = 6`). PERLU DIPASTIKAN DULU apakah nilai itu benar-benar berlaku di project remote atau hanya mengatur lingkungan lokal (config.toml utamanya lokal kecuali `supabase config push` dijalankan) -- periksa nilai efektifnya di Supabase Dashboard -> Authentication sebelum mengubah apa pun.',
    'Ditemukan lewat pemeriksaan SEC-08 (23 Agu 2026) sebagai temuan sampingan; dinaikkan jadi task tersendiri atas permintaan pemilik produk (OO.5).',
    -- 5 field E.3 (wajib untuk status menunggu_persetujuan, ditegakkan CHECK constraint di database)
    E'1. Periksa nilai EFEKTIF panjang kata sandi minimum di Supabase Dashboard -> Authentication (jangan percaya config.toml begitu saja -- itu bisa jadi hanya lingkungan lokal). 2. Putuskan angkanya: tetap 6, naik ke 12 (rekomendasi arsitek), atau angka lain. 3. Putuskan apakah SEC-08 (perlindungan kata sandi bocor) dinyalakan bersamaan. 4. Beri tahu tim SEBELUM diberlakukan.',
    'Supabase Dashboard -> project FABRIX-APP -> menu kiri Authentication -> bagian Password / Sign In. Bukan di dalam aplikasi MRP.',
    E'Seorang staf memakai kata sandi "itm123" (6 karakter). Hari ini DITERIMA sistem. Dengan minimum 12 karakter, saat staf itu berikutnya mengganti kata sandi, "itm123" akan DITOLAK dan ia harus memilih yang lebih panjang, mis. "GudangKaranglo2026". Ia TIDAK terkunci dari akunnya selama belum mengganti.',
    'Panjang minimum dinaikkan ke angka yang dipilih pemilik produk (dan SEC-08 dinyalakan bila diputuskan bersamaan). Tim diberi tahu lebih dulu. Pengguna lama tetap bisa masuk; aturan baru berlaku saat mereka mengganti kata sandi.',
    'Panjang minimum tetap 6 karakter. Risiko diterima secara sadar dan dicatat di sini sebagai keputusan pemilik produk, bukan kelalaian -- supaya kalau kelak jadi temuan audit, jejak keputusannya ada.'
  )
  on conflict (company_id, task_code) do nothing;

end $$;
