-- Catatan keputusan pemilik produk atas GDG-10 (25 Agu 2026).
do $mig$
begin
  update build_tasks set
    notes = concat_ws(chr(10), coalesce(notes, ''), '',
      '=== KEPUTUSAN PEMILIK PRODUK 25 Agu 2026: GABUNG, DAN SEBUT PERINTAH PRODUKSINYA ===',
      'Peringatan material_shortage PER WORK ORDER DICABUT. Peringatan gabungan per bahan kini',
      'menyebut sendiri perintah produksi mana yang tertahan.',
      '',
      'Work Order tidak punya nomor di sistem ini, jadi yang dipakai menyebutnya: nomor batch',
      'produksinya bila sudah ada, kalau belum kode produk + kuantitas rencana. Disebut',
      'maksimal tiga, sisanya dihitung -- "(B1, B2, B3, dan 2 lagi)".',
      '',
      'LUBANG YANG NYARIS TIDAK BERBUNYI: baris peringatan itu ternyata satu-satunya hal yang',
      'membuat sebuah Work Order tampil "Terhambat". Mencabutnya lebih dulu akan membuat WO',
      'yang bahannya kurang tampil "Siap Mulai", tanpa satu pun hal yang gagal atau merah.',
      '',
      'URUTAN YANG DIPAKAI:',
      '  1. work_orders_readiness diubah menghitung kekurangan bahan langsung dari bom_lines',
      '     dan lots (kolom baru kekurangan_bahan);',
      '  2. tests/kesiapan_wo_dari_data.test.ts membuktikan kesiapan tetap "blocked" DENGAN NOL',
      '     baris peringatan di tabel, dan tetap "ready" untuk yang bahannya cukup;',
      '  3. baru setelah itu peringatannya dicabut, yang masih terbuka ditutup lewat migrasi.',
      '',
      'BEDA STOK YANG DISENGAJA: kesiapan WO memakai stok PER PABRIK; peringatan bahan memakai',
      'stok LINTAS PABRIK. Dua pertanyaan berbeda, bukan ketidakkonsistenan.')
  where task_code = 'GDG-10';
end $mig$;
