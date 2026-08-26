-- Blok YY (26 Agu 2026): PPIC bagian 1 — lima bagian non-Gantt dirapikan ke Carbon.
-- Papan Gantt DIPISAH jadi pekerjaan tersendiri, sesuai keputusan pemilik produk.
do $mig$
declare v_company_id integer; v_kode text;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  -- ===== Papan Gantt jadi task tersendiri =====
  perform pastikan_kode_task_kosong('DS-19');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'DS-19',
    'Papan Gantt PPIC Dibangun Ulang Sesuai Spesifikasi Carbon',
    'DS', 'Design System',
    concat_ws(chr(10),
      'Papan Gantt saat ini kisi <table> ber-table-fixed dengan gaya Tailwind tulis tangan.',
      'Carbon punya spesifikasi Gantt lengkap di data-visualization/gantt-charts.'),
    concat_ws(chr(10),
      'Papan Gantt adalah satu-satunya tempat di sistem ini yang menampilkan JADWAL sebagai',
      'jadwal. Bentuk kisi tabelnya menyulitkan membaca durasi dan urutan tahap.'),
    'penting', 'menunggu', 'pemilik_produk', 'Claude Code',
    concat_ws(chr(10),
      'KOREKSI YANG MELAHIRKAN TASK INI: rencana Carbon PPIC menyatakan "papan Gantt TIDAK',
      'punya pola Carbon". Itu SALAH. Pemeriksaan dilakukan di patterns/ dan components/ —',
      'dua tempat yang disebut aturan — lalu disimpulkan tidak ada. Tempat ketiga,',
      'data-visualization/, tidak pernah dibuka. Aturan urutan pemeriksaan Carbon sudah',
      'diperbarui di docs/governance/rujukan-carbon.md.',
      '',
      'YANG WAJIB DIBACA SEBELUM MULAI, karena ia mengubah arti "pakai Carbon":',
      '  "The charts below are not included in the carbon-charts library."',
      'Gantt di Carbon adalah SPESIFIKASI + berkas Figma (Alpha), BUKAN komponen. Paket',
      '@carbon/charts pun tidak memuatnya dan tidak terpasang di proyek ini. Jadi ini',
      'MEMBANGUN sesuai spesifikasi, bukan memasang komponen.',
      '',
      'ANATOMI dari tiga gambar spesifikasinya:',
      '  KIRI (Card component): chevron mekar/tutup, nama tugas tebal, rentang tanggal,',
      '    deretan Tag berwarna untuk subtask dengan "+3" abu untuk sisanya, menu titik-tiga.',
      '    Saat dimekarkan: sub-kartu berisi nama subtask, tanggal, dan Tag "assigned to".',
      '  KANAN (Task component): batang berlatar warna muda, avatar bulat di kiri, nama di',
      '    tengah, persen di kanan; GARIS PROGRES di bawah batang (pekat = selesai, abu =',
      '    sisa); BELAH KETUPAT untuk milestone (padat = tercapai, kosong = belum).',
      '    Saat dimekarkan: latar biru muda melingkupi area, sub-tugas jadi kartu putih',
      '    berbayang dengan GARIS PENGHUBUNG SIKU antar sub-tugas.',
      '  SUMBU WAKTU: peta-mini di paling atas, nama bulan, lalu nama hari — AKHIR PEKAN',
      '    DIREDUPKAN.',
      '  ANJURAN DESAIN: batang berwarna KONTRAS ditaruh berdekatan, warna serupa dijauhkan;',
      '    judul tugas jelas; semua yang ditugaskan tercantum di kartu.',
      '',
      'PEMETAAN KE DATA KITA:',
      '  Task     -> batch produksi          Subtask  -> tahap routing',
      '  Judul    -> Work Center + kodenya   Persen   -> tahap selesai / total tahap',
      '  Garis penghubung -> urutan tahap (sequence_no) — ADA',
      '  Tag "assigned to" -> PERIKSA DULU apakah "siapa mengerjakan" tersedia per tahap',
      '  Tab proyek dan milestone -> TIDAK ADA padanannya. Bila datanya memang tidak ada,',
      '    bagiannya DIHAPUS dari rencana — bukan dibuatkan field baru.',
      '',
      'SISA TAILWIND TULIS TANGAN DI HALAMAN INI SELURUHNYA MILIK PAPAN GANTT: 40 baris,',
      '33 di antaranya di dalam wilayah Gantt (baris 1330-1560). Sengaja tidak dirapikan',
      'sekarang — merapikan gaya sesuatu yang akan diganti seluruhnya adalah pekerjaan yang',
      'dibuang dua kali.',
      '',
      'BUKTI YANG DIMINTA: enam lebar wajib, DENGAN DATA SUNGGUHAN. Pengukuran sebelumnya',
      'berjalan di tenant uji yang NOL Work Center, jadi kisinya kosong dan tidak membuktikan',
      'apa pun tentang perilakunya saat penuh.'),
    'Dipisah dari perapian PPIC atas keputusan pemilik produk, 26 Agu 2026.');

  -- ===== Catat perapian bagian non-Gantt di DS-09 =====
  select task_code into v_kode from build_tasks
   where company_id = v_company_id and task_code = 'DS-09' limit 1;
  if v_kode is not null then
    update build_tasks
       set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '=== PPIC BAGIAN 1 — LIMA BAGIAN NON-GANTT, 26 Agu 2026 ===',
       '',
       'TIGA TABEL MENTAH jadi Table Carbon ber-.tabel-responsif dengan data-label:',
       '  Usulan Standar Produksi (7 kolom) · Kapasitas per Work Center (6 kolom)',
       '  Yield per tahap di modal detail (5 kolom)',
       'Ketiganya kini punya keadaan kosong DI DALAM tabel dan rangka pemuatan Carbon',
       '(DataTableSkeleton), menggantikan tulisan "Memuat..." polos.',
       '',
       'TAILWIND TULIS TANGAN: 114 baris -> NOL di luar papan Gantt. Diganti kelas bersama',
       'ber-token di app/(shell)/ppic/ppic.scss — nol px, nol nilai warna langsung.',
       '',
       'TEMUAN YANG LAYAK DICATAT — PENANDA PENGECUALIAN SAYA SENDIRI TERLALU LUAS.',
       'Saat DS-09, penanda "pengawas-elemen" dipasang di DEPAN SETIAP <table> mentah di',
       'berkas ini lewat satu skrip, termasuk tabel yang BUKAN papan Gantt. Akibatnya tiga',
       'tabel data biasa ikut membawa alasan pengecualian Gantt, dan pengawas elemen mentah',
       'DIAM untuk ketiganya. Pengecualian yang dipasang borongan adalah pengawas yang',
       'dibungkam tanpa ada yang memutuskannya. Sekarang tersisa LIMA penanda, dan kelimanya',
       'benar-benar milik papan Gantt (3 tabel kisi + 2 tombol sel hari).',
       '',
       'DEVIASI YANG DISEBUT TERBUKA: kapasitas Work Center tetap disunting DI DALAM BARIS.',
       'Carbon menyatakan DataTable bukan untuk "a more complex display of the data or',
       'interactions" dan bukan pengganti aplikasi lembar kerja. Memindahkannya ke modal',
       'adalah pertanyaan ALUR KERJA (seberapa sering kapasitas diubah), bukan pertanyaan',
       'tampilan — menahan perapian sampai pertanyaan itu dijawab berarti menjadikan alur',
       'kerja sebagai syarat pekerjaan UI. Kontrolnya sendiri sudah komponen Carbon.',
       '',
       'JUGA TIDAK DIUBAH, dan disebut supaya tidak "dirapikan" nanti: daftar nilai dua kolom',
       'di modal detail tahap. Aturan "field memenuhi lebar modal" berbicara tentang FIELD',
       'FORMULIR; ini daftar label-nilai yang memang dibaca berdampingan.'
     )
     where company_id = v_company_id and task_code = 'DS-09';
  end if;
end
$mig$;
