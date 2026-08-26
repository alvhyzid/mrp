-- DS-09: halaman Kamus selesai dimigrasikan (26 Agu 2026), plus SATU temuan yang
-- DICATAT dan TIDAK DIKERJAKAN sesuai aturan FOKUS SATU TASK.
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  -- ------------------------------------------------------------------
  -- 1. Catatan kemajuan DS-09
  -- ------------------------------------------------------------------
  update build_tasks
     set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '--- 26 Agu 2026 — halaman ke-22: Kamus (/kamus) ---',
       'Tile + Tag + TextInput + Dropdown + InlineNotification + SkeletonText + Accordion + CodeSnippet.',
       'POLA: Carbon TIDAK punya pola "antrean pertanyaan"; disebut terbuka sesuai B.2, acuan',
       'terdekat pola Forms. BUKAN DataTable karena tiap baris butuh tiga isian teks bebas.',
       '',
       'TIGA hal yang ikut diperbaiki karena melekat pada migrasinya:',
       '  a. Saringan status/prioritas sebelumnya memakai PLACEHOLDER "Semua status" yang TIDAK',
       '     BISA DIPILIH KEMBALI — begitu satu status dipilih, tidak ada jalan pulang ke',
       '     seluruhnya selain memuat ulang halaman. Sekarang "Semua ..." adalah BARIS pilihan.',
       '  b. Warna Tag status TIDAK_RELEVAN diubah dari merah ke abu-abu: ia berarti "diputuskan',
       '     tidak perlu dijawab", bukan kegagalan. Merah membuat keputusan yang benar terlihat',
       '     seperti masalah.',
       '  c. Huruf kapital dirapikan mengikuti aturan "kapital hanya di awal kalimat".',
       '',
       'PENJAGA YANG IKUT DIPERBARUI DI GILIRAN YANG SAMA: pengecualian "Detail teknis" di',
       'tests/ui_raw_leak_watchdog.test.ts dikunci ke NOMOR BARIS. Migrasi ini menggesernya,',
       'jadi rentangnya diperbarui dari 363-379 menjadi 410-425.',
       '',
       'BUKTI DI PERAMBAN (tenant uji Company B, NOL baris ditulis ke basis data):',
       '  3 kartu, 9 Tag, 6 isian (tinggi 48px), 2 dropdown penugasan, 1 notifikasi draf AI,',
       '  "Detail teknis" terbuka saat diklik sungguhan, 0 isian mentah, 0 gulir menyamping,',
       '  tombol terkecil 40px.',
       '  BATAS BUKTI YANG DISEBUT TERBUKA: jawaban /api/kamus DIGANTI DI PERAMBAN karena tenant',
       '  uji tidak punya satu pun baris kamus. Yang dibuktikan BENTUK kartunya, BUKAN jalur',
       '  datanya — dan jalur data memang tidak disentuh migrasi ini.',
       '',
       'SISA: 17 halaman.'
     )
   where company_id = v_company_id and task_code = 'DS-09';

  -- ------------------------------------------------------------------
  -- 2. Temuan yang DICATAT dan TIDAK DIKERJAKAN
  -- ------------------------------------------------------------------
  perform pastikan_kode_task_kosong('DS-10');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'DS-10',
    'ProvenanceInfoButton Masih Tombol Mentah — Satu-satunya di Halaman yang Sudah Carbon',
    'DS', 'Design System',
    'Tombol "Lihat asal angka" (ProvenanceInfoButton) belum memakai komponen Carbon, sehingga setiap halaman yang sudah dimigrasikan tetap menyisakan satu tombol mentah.',
    'Menentukan apakah panel Asal-Usul terasa bagian dari sistem yang sama atau tempelan dari sistem lama.',
    'penting', 'menunggu', 'temuan_claude', 'Claude Code',
    concat_ws(chr(10),
      'DITEMUKAN 26 Agu 2026 saat memigrasikan halaman Kamus, DENGAN PENGUKURAN — bukan dugaan.',
      'Penghitung elemen mentah di halaman Kamus berhenti di angka 1, dan elemen itu ternyata:',
      '  class="inline-flex items-center text-muted-foreground hover:text-foreground"',
      '  aria-label="Lihat asal angka: Progres prioritas 1-2"',
      '',
      'BUKAN cacat halaman Kamus. Komponennya bersama (src/components/ui/provenance-info-button.tsx)',
      'dan dipakai di BANYAK halaman yang sudah dimigrasikan — jadi angka "nol elemen mentah" di',
      'halaman mana pun yang menampilkan angka keuangan sebenarnya belum pernah benar-benar nol.',
      '',
      'KENAPA TIDAK DIKERJAKAN SEKARANG: aturan FOKUS SATU TASK. Ini komponen bersama yang',
      'menyentuh banyak halaman sekaligus, bukan satu baris yang jelas benar — persis jenis',
      'perubahan yang tidak boleh diselipkan ke tengah pekerjaan lain.',
      '',
      'YANG PERLU DIPUTUSKAN SAAT DIKERJAKAN: panel penjelasannya sendiri juga bukan komponen',
      'Carbon. Carbon punya Toggletip untuk penjelasan yang dibuka dengan KLIK (bukan hover) —',
      'itu cocok dengan aturan bantuan-klik yang sudah berlaku di proyek ini. Periksa halaman',
      'Usage-nya lebih dulu; jangan langsung mengganti bungkusnya saja.'
    ),
    'Lahir dari DS-09 halaman Kamus. Dicatat, tidak dikerjakan.'
  );
end
$mig$;
