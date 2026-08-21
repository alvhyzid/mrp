-- Halaman Daftar Tugas Pembangunan -- 22 Agu 2026:
-- A.1: turunkan urgensi RBD-01/RBD-02a (Penting -> Bisa Menunggu), rebrand
--      tampilan dikerjakan di jendela sepi, bukan bersaing dgn PMB-07/sapu REVOKE.
-- A.2/B/C: isi lengkap INF-01 (Audit Infrastruktur, SUPER URGENT) dan INF-02
--      (Perapian Environment, Mendesak) menggantikan stub "PERLU KONFIRMASI".
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- A.1 -- RBD-01
  insert into build_task_urgency_history (build_task_id, old_urgency, new_urgency, requested_by)
  select build_task_id, 'penting', 'bisa_menunggu',
    'Pemilik Produk (22 Agu 2026) -- rebrand tampilan dikerjakan sekali di jendela sepi, bukan bersaing dengan PMB-07 dan sapu REVOKE'
  from build_tasks where company_id = v_company_id and task_code = 'RBD-01';
  update build_tasks set urgency = 'bisa_menunggu' where company_id = v_company_id and task_code = 'RBD-01';

  -- A.1 -- RBD-02a
  insert into build_task_urgency_history (build_task_id, old_urgency, new_urgency, requested_by)
  select build_task_id, 'penting', 'bisa_menunggu',
    'Pemilik Produk (22 Agu 2026) -- menyentuh banyak file teks sekaligus, akan bertabrakan dengan pekerjaan lain yang sedang berjalan'
  from build_tasks where company_id = v_company_id and task_code = 'RBD-02a';
  update build_tasks set urgency = 'bisa_menunggu' where company_id = v_company_id and task_code = 'RBD-02a';

  -- A.2/B -- INF-01, isi lengkap, SUPER URGENT (ditetapkan pemilik produk)
  insert into build_task_urgency_history (build_task_id, old_urgency, new_urgency, requested_by)
  select build_task_id, 'penting', 'super_urgent',
    'Pemilik Produk (22 Agu 2026) -- detail lengkap audit infrastruktur diberikan, harus dijalankan segera sebelum transfer kepemilikan/penyambungan domain apa pun'
  from build_tasks where company_id = v_company_id and task_code = 'INF-01';

  update build_tasks set
    urgency = 'super_urgent',
    super_urgent_since = now(),
    tags = ARRAY['Integrasi','Keamanan','Dokumentasi']::text[],
    pic = 'Claude Code',
    status = 'menunggu',
    description = 'Memotret kondisi SEBENARNYA seluruh "rumah" sistem (GitHub, Vercel, Supabase) sebelum ada yang dipindahkan atau disambungkan ke domain FABRIX. Read-only, tidak menyentuh apa pun.',
    effect_description = 'Tanpa potret ini, transfer kepemilikan (RBD-04) dan penyambungan domain dikerjakan dengan menebak. Ada 1 dugaan yang harus dibuktikan/dibantah lebih dulu: seluruh data nyata PT ITM (63 karyawan+gaji+basis BPJS, SO MLVT, 3 pabrik, master data) diduga hidup di project yang selama ini disebut "dev" -- project yang menerima migrasi tiap sesi dan diperlakukan sebagai tempat coba-coba. Bila benar, itu Production tanpa perlindungan Production, dan seluruh urutan rencana rebrand berubah.',
    detail_pekerjaan = $inf01$LINGKUP KERJA (I.1-I.9):
I.1 -- Sebutkan SEMUA project Supabase beserta perannya SEBENARNYA (bukan menurut namanya): mana berisi data nyata PT ITM, mana kosong/uji. Bukti: jumlah baris employees, lots, sales_orders, companies per project.
I.2 -- Semua project Vercel: repo & branch terhubung, domain aktif, framework, build config, cron, serverless/edge function, integrasi. Environment variable disebut NAMA saja, JANGAN nilainya.
I.3 -- Jawab tegas: adakah satu pun konfigurasi di mana staging bisa menunjuk database berisi data nyata PT ITM? Buktikan dengan MEMBANDINGKAN nilai antar environment -- bandingkan, jangan tampilkan.
I.4 -- Status backup otomatis pada project berisi data nyata: aktif atau tidak, retensi berapa lama, kapan terakhir berhasil. Ini yang paling menentukan seberapa gawat kondisi sekarang.
I.5 -- Multi-tenant: laporkan kondisi RLS ber-company_id apa adanya. Ini sudah jadi invarian proyek sejak awal -- TIDAK PERLU dirancang ulang, cukup dilaporkan status dan celahnya bila ada.
I.6 -- Daftar "kontrak eksternal": alamat yang sudah tercetak/tertanam di luar sistem dan wajib tetap hidup setelah pindah domain -- URL POD di QR surat jalan yang SUDAH dicetak, magic link auth, alamat pengirim email. Sertakan contoh token POD nyata dari surat jalan yang pernah dibuat.
I.7 -- Git: branch yang ada, alur kerja sekarang, strategi migrasi & seed.
I.8 -- Keluaran: docs/audit-infrastruktur-fabrix.md dengan 6 bagian -- Kondisi Sekarang / Masalah Ditemukan / Tingkat Risiko (KRITIS/TINGGI/SEDANG/RENDAH) / Arsitektur Target / Rencana Migrasi (apa berubah, kenapa, apa tetap, apa tidak disentuh, cara mundur) / Gerbang Persetujuan.
I.9 -- Cetak RINGKASANNYA DI CHAT dalam Bahasa Indonesia -- arsitek tidak bisa membuka file di repo. Minimal: daftar project & perannya, 5 masalah paling berisiko beserta tingkatnya, dan status backup.

BATAS MUTLAK: NOL perubahan. Tidak menyentuh DNS, domain, project, env var, secret, RLS, auth, maupun database. Tidak menampilkan nilai secret apa pun. Tidak membuat/menghapus/memindahkan project apa pun. git diff HANYA boleh menyentuh docs/.

BUKTI WAJIB: (a) git diff tidak menyentuh satu pun file di src/; (b) tidak ada nilai secret muncul di laporan maupun file docs -- hanya nama; (c) jumlah baris tabel kunci per project, sebagai bukti mana yang berisi data nyata.

STOP CONDITION (berhenti, laporkan, JANGAN perbaiki sendiri):
- Bila staging TERBUKTI bisa menunjuk data nyata PT ITM -> berhenti, laporkan sebagai temuan KRITIS.
- Bila backup otomatis pada project berisi data nyata TIDAK aktif -> berhenti dan laporkan segera. Itu mengubah urutan seluruh rencana -- pengamanan backup didahulukan di atas segalanya.$inf01$,
    notes = 'Detail lengkap dimasukkan 22 Agu 2026 oleh pemilik produk. Tanda "PERLU KONFIRMASI" DIHAPUS.'
  where company_id = v_company_id and task_code = 'INF-01';

  -- A.2/C -- INF-02, isi lengkap, Mendesak
  insert into build_task_urgency_history (build_task_id, old_urgency, new_urgency, requested_by)
  select build_task_id, 'penting', 'mendesak',
    'Pemilik Produk (22 Agu 2026) -- detail lengkap perapian environment diberikan'
  from build_tasks where company_id = v_company_id and task_code = 'INF-02';

  update build_tasks set
    urgency = 'mendesak',
    tags = ARRAY['Database','Integrasi','Keamanan']::text[],
    pic = 'Claude Code + Pemilik Produk',
    status = 'menunggu',
    description = 'Saat ini hanya ada dua lingkungan: "dev" dan "staging". Yang seharusnya ada tiga: tempat coba-coba (dev), tempat uji sebelum rilis (staging), dan tempat sungguhan yang menyimpan data nyata (production). Task ini merapikan itu.',
    effect_description = 'Selama data nyata hidup di lingkungan bernama "dev", tidak ada garis yang menahan siapa pun -- termasuk Claude Code -- dari menjalankan percobaan di atas payroll 63 orang. Garis itu yang dibuat di sini.',
    detail_pekerjaan = $inf02$PRASYARAT: INF-01 selesai DAN RBD-04 (transfer kepemilikan) selesai. JANGAN dimulai sebelum keduanya tuntas.

CARA YANG DIREKOMENDASIKAN -- JANGAN MEMINDAHKAN DATA:
C.1 -- Project yang sekarang berisi data nyata DIPERLAKUKAN sebagai Production apa adanya. Namanya boleh diubah; project ref, URL, dan kunci TETAP, sehingga aplikasi tidak terputus sedetik pun.
C.2 -- Buat project DEV BARU yang kosong, dibangun dari migrasi. Ini murah karena rebuild-from-migrations sudah terbukti jalan di CI tiap push.
C.3 -- Staging yang ada tetap sebagai staging.
C.4 -- ALTERNATIF YANG DITOLAK (catat alasannya supaya tidak dibuka ulang): membuat Production baru lalu memindahkan data ke sana berarti memindahkan payroll dan seluruh master data lewat proses yang belum pernah diuji. Risikonya tidak sebanding dengan manfaatnya.

PRASYARAT MUTLAK SEBELUM MENYENTUH APA PUN:
C.5 -- Backup pg_dump terverifikasi BERISI DATA (bukan schema-only), dibuktikan dengan memeriksa adanya baris data di tabel sampel. Pelajaran doktrin proyek: workflow backup pernah hijau padahal isinya schema-only.

LINGKUP:
C.6 -- Isolasi environment variable & secret (ini isi INF-03, kerjakan bersama): pastikan staging TIDAK PERNAH bisa menunjuk database production dan sebaliknya. Tidak ada secret server bocor lewat awalan NEXT_PUBLIC_. Secret production tidak pernah disalin ke staging.
C.7 -- Pemisahan Auth site URL & redirect URL per lingkungan (isi INF-04): redirect production tidak boleh mengarah ke staging. Token POD dan magic link LAMA wajib tetap tervalidasi -- ini kontrak eksternal dari INF-01 I.6.
C.8 -- Verifikasi backup otomatis tetap berjalan setelah perapian. Jangan sampai jadwal backup hilang bersama perubahan organisasi.
C.9 -- Dokumentasikan setiap perubahan infrastruktur. Utamakan perubahan yang bisa dibatalkan.

BUKTI WAJIB: (a) Dari lingkungan staging, coba akses database production -> gagal. Tunjukkan buktinya, bukan pernyataan. (b) Setelah perapian: login, query, storage, dan alur auth penuh diuji di tiap lingkungan -> semuanya jalan. (c) Buka satu halaman POD memakai token LAMA dari surat jalan yang sudah dicetak -> tetap membuka halaman yang benar. (d) Jumlah baris tabel kunci di Production SAMA PERSIS sebelum & sesudah perapian -- bila beda sebaris pun, HENTIKAN dan laporkan.

STOP CONDITION:
- Tanpa bukti backup sah (C.5), JANGAN mulai sama sekali.
- Bila perapian ternyata menuntut project ref atau kunci berubah -> berhenti dan laporkan. Itu berarti aplikasi akan terputus, dan keputusannya milik pemilik produk.

CATATAN DESAIN DITEMUKAN 22 Agu 2026 (dilaporkan, BELUM diubah mekanismenya): tag task ini (Database/Integrasi/Keamanan) TIDAK termasuk Visual/Teks-Bahasa, sehingga penanda "aman paralel" otomatis (C.3 spesifikasi asli, murni dari tag) akan terhitung TRUE -- padahal pemilik produk menyatakan eksplisit task ini TIDAK aman paralel (prasyarat keras INF-01+RBD-04 belum tentu selesai). Ini karena "aman paralel" versi tag hanya mengukur "tidak bentrok pekerjaan UX", BUKAN "siap dikerjakan sekarang" -- 2 konsep berbeda yang kebetulan sama-sama disebut "aman paralel". Perlu keputusan pemilik produk: biarkan bedanya cukup didokumentasikan begini, atau ubah mekanisme penanda supaya juga memperhitungkan prasyarat keras?$inf02$,
    notes = 'Detail lengkap dimasukkan 22 Agu 2026 oleh pemilik produk. Tanda "PERLU KONFIRMASI" DIHAPUS. PIC gabungan (Claude Code + Pemilik Produk) karena keputusan organisasi/infra perlu persetujuan pemilik akun, eksekusi teknis oleh Claude Code.'
  where company_id = v_company_id and task_code = 'INF-02';

end $$;
