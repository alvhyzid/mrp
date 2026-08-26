-- DS-09: halaman Routing selesai dimigrasikan ke Carbon (26 Agu 2026).
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  update build_tasks
     set detail_pekerjaan = detail_pekerjaan || chr(10) || concat_ws(chr(10),
       '',
       '--- 26 Agu 2026 — halaman ke-23: Routing (/routing) ---',
       'POLA: Data table. Cetakannya SENGAJA disamakan dengan halaman Pelanggan (DataTable +',
       'TableToolbar + TableToolbarSearch + Checkbox + Pagination), supaya dua layar yang',
       'melakukan hal sama tidak berbeda bentuk.',
       'MODAL: ComposedModal ukuran lg, sifatnya BERTAHAP — pengguna menambah dan menghapus',
       'baris tahap sebelum menyimpan.',
       '',
       'EMPAT hal yang ikut diperbaiki, semuanya ditemukan lewat MENJALANKAN, bukan membaca:',
       '  a. "Durasi aktif" tampil MERAH sebelum pengguna mengetik apa pun — NumberInput',
       '     menganggap kosong melanggar min. Diperbaiki dengan prop allowEmpty. Kotak merah',
       '     sebelum ada kesalahan melatih orang mengabaikan warna merah.',
       '  b. Baris tahap memakai kisi TETAP tujuh kolom di semua lebar. Diukur di dalam modal:',
       '     placeholder terpotong jadi "mis. Mi:" dan tombolnya jadi "Hapus tahap" tanpa ruang.',
       '     Sekarang 1 kolom di bawah 672px, 2 kolom di 672px, 3 kolom di 1056px ke atas.',
       '  c. "Durasi aktif" dan "Laju" SALING MEMBATALKAN — mengisi Laju membuat Durasi aktif',
       '     tidak dipakai. Sebelumnya hubungan itu hanya disebut di paragraf panjang di bawah.',
       '     Sekarang keduanya BERSEBELAHAN, Laju punya helper "kalau diisi, ini yang dipakai",',
       '     dan Durasi aktif berubah jadi "Diabaikan — laju di sebelah kanan yang dipakai"',
       '     begitu Laju terisi.',
       '  d. Hapus/Arsipkan sebelumnya BERDEMPETAN dengan Detail/Ubah di kolom Aksi. Sekarang',
       '     didorong ke kanan dengan seluruh lebar sel di antaranya, kind="danger--tertiary".',
       '',
       'CATATAN PAKET (bukti aturan D.2 — periksa paket, bukan dokumentasi): ModalFooter di',
       '@carbon/react 1.114 MEWAJIBKAN `children` meskipun primaryButtonText/secondaryButtonText',
       'ada. Tombolnya karena itu ditulis sebagai children; Carbon tetap yang mengatur lebarnya.',
       '',
       'BUKTI DI PERAMBAN (tenant uji Company B): 455 komponen Carbon, 0 elemen mentah, modal',
       'terbuka lewat KLIK SUNGGUHAN, footer berisi Batal + Buat Routing, dan gulir menyamping',
       'TIDAK ADA di keempat lebar wajib (360/768/1280/1920). Jumlah kolom baris tahap terukur',
       '1 / 2 / 3 / 3 berturut-turut.',
       '',
       'SISA: 12 halaman.'
     )
   where company_id = v_company_id and task_code = 'DS-09';
end
$mig$;
