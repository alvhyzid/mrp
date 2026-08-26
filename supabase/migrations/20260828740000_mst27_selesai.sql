-- MST-27 selesai dibangun (25 Agu 2026).
do $mig$
begin
  update build_tasks set status = 'selesai',
    notes = concat_ws(chr(10), coalesce(notes, ''), '',
      '=== SELESAI 25 Agu 2026 ===',
      'Setelan ke-18 default_min_stock_percent hidup, dan ambang efektif kini TIGA LAPIS di',
      'tentukanAmbang() -- satu tempat, bukan disebar ke pemanggil.',
      '',
      'TERBUKTI DI PERAMBAN, bukan disimpulkan dari kode (tenant uji Company B):',
      '  - kelompok baru "Peringatan stok" muncul di Setelan Perhitungan berisi field itu,',
      '    lengkap dengan peringatan bahwa ia memengaruhi angka yang sudah lewat;',
      '  - setelah diisi 20 lewat layar, form Item berkata "Dikosongkan berarti memakai persen',
      '    bawaan perusahaan, yaitu 20%", dan kolom angka mutlak berkata "Diabaikan";',
      '  - panel detail item berkata "20% dari total yang pernah masuk (persen bawaan perusahaan)".',
      '',
      'Enam test baru, dibuktikan MERAH dulu lalu hijau. Satu di antaranya penjaga anti-kejutan:',
      'perusahaan yang BELUM mengisi setelan ini berperilaku persis seperti sebelumnya.',
      '',
      'SISA FIXTURE SUDAH DIBERSIHKAN: baris setelan + jejaknya di Company B dihapus, item',
      'UJI-MST27 dihapus permanen lewat jalur aplikasi.',
      '',
      'YANG MASIH DIPERLUKAN DARI PEMILIK PRODUK: mengisi angkanya untuk PT ITM. Sampai diisi,',
      'peringatan stok berperilaku persis seperti sebelum setelan ini ada -- nol peringatan baru.')
  where task_code = 'MST-27';
end $mig$;
