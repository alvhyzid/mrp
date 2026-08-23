-- QQ.2-QQ.3 (23 Agu 2026) -- konsekuensi perubahan tipe variabel Vercel, dan
-- task pemutaran (rotate) service role key setelah rangkaian ini selesai.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'PT ITM tidak ditemukan -- dilewati.';
    return;
  end if;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'SEC-10', 'Putar (Rotate) Service Role Key Supabase Setelah Rangkaian Perbaikan Selesai', 'SEC', 'Keamanan',
    'Selama perbaikan insiden PP (23 Agu 2026), service role key FABRIX-APP sempat berpindah-pindah antar lingkungan: dibaca dari .env.local mesin kerja, dikirim lewat Vercel API, dan sempat tersimpan dalam beberapa percobaan variabel (termasuk satu nilai tersamar yang tidak sah). TIDAK ADA BUKTI kebocoran -- ini murni kebersihan wajar setelah kunci banyak berpindah tangan.',
    'Service role key MELEWATI SELURUH RLS -- siapa pun yang memegangnya bisa membaca & mengubah data tenant mana pun tanpa terhalang satu pun gerbang peran. Karena itu kunci ini pantas diperlakukan paling hati-hati di seluruh sistem, termasuk diputar setelah periode yang banyak menyentuhnya.',
    'penting', array['Keamanan'], 'Pemilik Produk', 'menunggu', null, 'temuan_claude',
    E'PRASYARAT: kerjakan SETELAH INF-17 selesai (GitHub Secrets sudah diarahkan ke fabrix-ci-test) -- supaya tidak perlu memutar dua kali.\n\n' ||
      E'LANGKAH: (1) Supabase Dashboard -> FABRIX-APP -> Settings -> API -> buat Secret key BARU; (2) perbarui SEMUA tempat yang memakainya SEBELUM mencabut yang lama -- yang diketahui hari ini: `.env.local` di mesin kerja, variabel Production Vercel project mrp-staging (SUPABASE_SERVICE_ROLE_KEY); (3) uji login peramban sungguhan ke https://mrp-staging-zeta.vercel.app DAN jalankan test suite lokal -- keduanya harus lulus SEBELUM langkah berikutnya; (4) baru cabut/hapus Secret key yang lama.\n\n' ||
      E'CATATAN: jangan memutar bersamaan dengan perubahan lain -- kalau ada yang rusak, harus jelas penyebabnya kunci baru, bukan hal lain. Ingat pelajaran PP: "redeploy" Vercel mewarisi env deployment lama, jadi setelah mengganti nilai WAJIB deployment BARU dari git, bukan redeploy.',
    'Ditemukan lewat QQ.3 (23 Agu 2026) -- permintaan eksplisit pemilik produk sebagai kebersihan setelah insiden PP, bukan karena ada bukti bocor.'
  )
  on conflict (company_id, task_code) do nothing;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'SEC-11', 'Keputusan: Kembalikan SUPABASE_SERVICE_ROLE_KEY ke Tipe Tersamar (Sensitive) atau Biarkan', 'SEC', 'Keamanan',
    'Saat memperbaiki insiden PP, variabel SUPABASE_SERVICE_ROLE_KEY di Vercel diubah dari tipe `sensitive` (nilai TIDAK BISA dibaca ulang oleh siapa pun) ke `encrypted` (nilai BISA dibaca ulang oleh anggota tim) -- supaya nilainya bisa DIVERIFIKASI setelah dua kali salah pasang. Pertukaran ini perlu diputuskan secara sadar, bukan dibiarkan terjadi diam-diam.',
    'Dengan tipe `encrypted`, nilai kunci yang MELEWATI SELURUH RLS bisa dibaca dari dashboard/API oleh siapa pun yang punya akses tim. Hari ini tim Vercel hanya beranggota 1 orang (pemilik produk sendiri, peran Owner) sehingga dampak praktisnya kecil -- TAPI rencana RBD-04 akan mengundang admin@fabrix.id sebagai Owner KEDUA, dan sejak saat itu ada dua identitas yang bisa membacanya. Konsekuensi kedua: variabel `sensitive` sepanjang >=32 karakter otomatis disamarkan jadi [REDACTED] di log build Vercel; sebagai `encrypted`, perlindungan itu hilang (kunci ini 41 karakter).',
    'penting', array['Keamanan'], 'Pemilik Produk', 'menunggu', null, 'temuan_claude',
    E'PILIHAN (perlu keputusan pemilik produk):\n' ||
      E'  (A) KEMBALIKAN ke `sensitive` -- REKOMENDASI ARSITEK. Alasan: tujuan pengubahan (verifikasi nilai) SUDAH TERCAPAI dan nilainya kini terbukti benar, jadi kemampuan baca-balik tidak lagi dibutuhkan; mengembalikannya memulihkan penyamaran log build dan menutup pembacaan oleh Owner kedua nanti. Biayanya: kalau kelak perlu diverifikasi lagi, harus dihapus & dibuat ulang (tipe sensitive tidak bisa diubah di tempat -- dokumentasi Vercel: "remove and re-add it").\n' ||
      E'  (B) BIARKAN `encrypted` -- lebih mudah diverifikasi kalau ada insiden serupa, dengan harga: nilai bisa dibaca anggota tim & tidak lagi disamarkan di log build.\n\n' ||
      E'CATATAN PENTING soal urutan: kalau SEC-10 (putar kunci) dikerjakan, LEBIH EFISIEN menggabungkannya -- saat memasang kunci BARU hasil rotasi, langsung pasang sebagai tipe `sensitive` sekaligus. Dengan begitu tidak perlu hapus-dan-buat-ulang dua kali.',
    'Ditemukan lewat QQ.2 (23 Agu 2026) -- pemilik produk meminta pertukaran keamanan ini disadari & diputuskan, bukan dibiarkan terjadi diam-diam.'
  )
  on conflict (company_id, task_code) do nothing;
end $$;
