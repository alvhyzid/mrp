-- DS-05 (25 Agu 2026) — empat koreksi setelah pemeriksaan pemilik produk.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

update build_tasks set
  notes = coalesce(notes || E'\n\n','') ||
    E'=== EMPAT KOREKSI, 25 Agu 2026 (temuan pemilik produk) ===\n\n' ||
    E'1. JUDUL GANDA. Benar, dan itu KELALAIAN SAYA, bukan gaya Carbon. Anatomi DataTable\n' ||
    E'   Carbon memang memuat "Title and description" -- saya menambahkan judul halaman\n' ||
    E'   sendiri DI ATASNYA tanpa mencabut yang bawaan, jadi "Daftar item" muncul dua kali\n' ||
    E'   berjarak beberapa sentimeter. Judul tabelnya dicabut; yang tersisa judul halaman,\n' ||
    E'   dengan jumlah item sebagai keterangannya.\n\n' ||
    E'2. BREADCRUMB menggantikan baris "MASTER DATA" yang dulu hanya hiasan.\n' ||
    E'   CATATAN JUJUR yang perlu diketahui pemilik produk: Carbon menyarankan breadcrumb\n' ||
    E'   untuk hierarki LEBIH DARI DUA TINGKAT, sedangkan milik kita dua (workspace ->\n' ||
    E'   halaman). Dipakai tetap karena ia memberi POSISI dan JALAN KEMBALI -- dua hal yang\n' ||
    E'   tidak diberikan baris hiasan sebelumnya. Ini pilihan sadar, bukan ketidaktahuan.\n' ||
    E'   "Product & Engineering" SENGAJA tidak bisa diklik: ia kelompok di menu kiri, bukan\n' ||
    E'   halaman. CACAT YANG DITEMUKAN SAAT MEMERIKSANYA: Carbon menempelkan kelas cds--link\n' ||
    E'   ke SETIAP butir remah roti, termasuk yang tanpa alamat -- diukur, warnanya\n' ||
    E'   rgb(15,98,254), biru tautan yang sama persis dengan "Dashboard" di sebelahnya.\n' ||
    E'   Terlihat bisa diklik padahal tidak. Warnanya dikembalikan ke teks sekunder.\n\n' ||
    E'3. TOMBOL "Tambah item" sekarang berikon +.\n\n' ||
    E'4. PENCARIAN MELIPAT. Benar -- `persistent` yang saya pasang justru MEMATIKAN perilaku\n' ||
    E'   bawaan Carbon. Dicabut. Diukur sesudahnya: lebar 48px (ikon saja) -> diklik -> 701px,\n' ||
    E'   dan kelas cds--toolbar-search-container-active menyala.\n\n' ||
    E'   TOOLBAR JUGA DIISI FUNGSI, bukan cuma pencarian: saringan TIPE (banyak-pilihan) dan\n' ||
    E'   STATUS (satu-pilihan), keduanya berlaku SEKETIKA tanpa tombol "terapkan". Pilihan itu\n' ||
    E'   mengikuti pola penyaringan Carbon: saringan bertombol berguna saat menghitung ulang\n' ||
    E'   mahal, dan di sini tidak.\n' ||
    E'   Diuji dengan KLIK TETIKUS SUNGGUHAN (klik programatik tidak memicu Carbon):\n' ||
    E'   saring Status=Nonaktif -> 4 baris jadi 1, keterangan berubah jadi "1 item dari 4\n' ||
    E'   yang tercatat".\n\n' ||
    E'   CACAT YANG DITEMUKAN: `titleText=""` pada saringan tetap merender elemen label, dan\n' ||
    E'   kotaknya terdorong 16px LEBIH RENDAH daripada pencarian dan tombol di sebelahnya --\n' ||
    E'   terlihat melenceng dari toolbar. Diganti titleText + hideLabel: label tetap dibacakan\n' ||
    E'   pembaca layar, hanya disembunyikan secara visual. Sesudahnya keempat kontrol toolbar\n' ||
    E'   sejajar di 224-272px.\n\n' ||
    E'=== TARGET SENTUH: DUA PERCOBAAN GAGAL SEBELUM YANG KETIGA BEKERJA ===\n' ||
    E'Tombol buka-detail 32px, di bawah ambang 44px. Menyetel tabel ke ukuran `lg` menaikkan\n' ||
    E'BARISNYA jadi 48px dan tombolnya TETAP 32px -- Carbon mengukur keduanya terpisah.\n' ||
    E'  percobaan 1: min-block-size 2.75rem -> tombol 44px TAPI baris membengkak jadi 61px.\n' ||
    E'  percobaan 2: block-size 100%        -> baris kembali 48px TAPI tombol cuma 31px.\n' ||
    E'  percobaan 3 (dipakai): tinggi tombol dipatok 44px + padding vertikal sel dinolkan\n' ||
    E'                         -> tombol 44px, baris tetap 48px.\n' ||
    E'Ketiganya hanya bisa dibedakan dengan MENGUKUR; dari membaca CSS ketiganya masuk akal.\n\n' ||
    E'=== YANG MASIH DI BAWAH 44px, DILAPORKAN BUKAN DITIMPA ===\n' ||
    E'  ikon bantuan & Asal-Usul : 16px\n' ||
    E'  panah pembagi halaman    : 40px\n' ||
    E'Keduanya UKURAN BAWAAN CARBON untuk kontrol bantuan sebaris dan navigasi halaman.\n' ||
    E'Menimpanya berarti improvisasi terhadap hal yang sudah dijawab Carbon; dicatat sebagai\n' ||
    E'DS-07 supaya diputuskan sadar, bukan diselipkan.\n\n' ||
    E'=== BUKTI ULANG ===\n' ||
    E'  Judul bertuliskan "Daftar item": 1 (sebelumnya 2). Judul tabel Carbon: tidak ada.\n' ||
    E'  Remah roti: Dashboard (biru, bisa diklik) / Product & Engineering (abu, tidak) /\n' ||
    E'  Items (hitam, halaman sekarang).\n' ||
    E'  5 lebar (360/768/1280/1440/1920): nol gulir menyamping, nol baris menindih,\n' ||
    E'  di 360px baris jadi kartu (display block), di >=768px tetap tabel.\n' ||
    E'  Konsol peramban BERSIH di seluruh pemeriksaan. Build produksi berhasil, 17 test lulus.'
where task_code = 'DS-05';

  if not exists (select 1 from build_tasks where task_code = 'DS-07') then
    insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
      effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
    values (v_company_id, 'DS-07',
      'Kontrol Carbon yang Lebih Kecil dari Ambang Sentuh 44px',
      'DS', 'Design System',
      'Ikon bantuan/Asal-Usul 16px dan panah pembagi halaman 40px — keduanya ukuran bawaan Carbon.',
      'Aturan proyek menetapkan target sentuh minimal 44px untuk seluruh elemen interaktif.',
      'penting', 'menunggu', 'temuan_claude', 'Claude Code + Pemilik Produk',
      E'Butuh KEPUTUSAN, bukan perbaikan diam-diam. Tiga pilihan:\n' ||
      E'  A. Biarkan -- ikuti Carbon apa adanya, ambang 44px diperlonggar untuk kontrol\n' ||
      E'     bantuan sebaris dan navigasi halaman.\n' ||
      E'  B. Naikkan area tekannya saja (ikon tetap sebesar sekarang), seperti yang sudah\n' ||
      E'     dilakukan pada kotak centang POD dan tombol buka-detail Master Item.\n' ||
      E'  C. Naikkan hanya di layar sentuh, lewat media query pointer: coarse.\n' ||
      E'Bila B atau C dipilih, ia berlaku untuk SELURUH layar sekaligus -- jadi lebih baik\n' ||
      E'diputuskan sekali di sini daripada diulang per halaman.',
      E'Ditemukan 25 Agu 2026 saat mengukur Master Item. Dilaporkan TANPA diperbaiki karena\n' ||
      E'menimpanya berarti improvisasi terhadap hal yang sudah dijawab Carbon (aturan E.3).\n' ||
      E'Dua deviasi sejenis sudah ada dan keduanya dicatat: kotak centang POD (37 -> 44px) dan\n' ||
      E'tombol buka-detail Master Item (32 -> 44px). Keduanya diputuskan kasus per kasus;\n' ||
      E'task ini untuk memutuskannya sebagai ATURAN, supaya berhenti diputuskan berulang.');
  end if;
end $$;
