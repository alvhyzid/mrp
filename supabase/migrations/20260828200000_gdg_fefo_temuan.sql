-- Temuan arkeologi FEFO (B.6) jadi task. Dua temuan, dipisah karena sifatnya berbeda.

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, d.kode, d.nama, 'GDG', 'Gudang', d.deskripsi, d.efek, d.urgensi,
  array['Data','Fungsi']::text[], d.pic, 'menunggu', 'temuan_claude', d.detail, d.catatan
from (values
(
  'GDG-05',
  'suggest_fefo_lots TIDAK PERNAH DIPANGGIL SIAPA PUN',
  'Fungsi saran FEFO ada di database, lengkap dan benar bentuknya, tetapi nol pemanggil di seluruh src/ dan app/. FEFO tidak pernah benar-benar dijalankan.',
  'Aturan "yang lebih dulu kedaluwarsa, lebih dulu keluar" hanya ada sebagai niat. Pengambilan bahan sepenuhnya bergantung kebiasaan operator, dan sistem tidak membantu sama sekali — padahal terlihat seolah membantu.',
  'penting',
  'Claude Code',
  E'DIBUKTIKAN 24 Agu 2026: `grep -rn "suggest_fefo_lots" src/ app/` mengembalikan NOL hasil.\n\n' ||
  E'INI KEJADIAN KEEMPAT dari kelas "terlihat bekerja padahal tidak", setelah tombol Tunda/Batal, ' ||
  E'status Work Order, dan alert low_stock. Bedanya: tiga yang lalu terlihat di layar; yang ini ' ||
  E'tidak terlihat sama sekali, jadi tidak ada yang akan mengadukannya.\n\n' ||
  E'HARUS BERES SEBELUM gudang mulai mengisi tanggal kedaluwarsa. Menyambungkan FEFO setelah ada ' ||
  E'ratusan lot berarti mengubah kebiasaan yang sudah terbentuk, bukan membentuk kebiasaan.',
  'Ditemukan saat menjawab pertanyaan lain (bagaimana FEFO memperlakukan lot tanpa tanggal). Pertanyaannya tentang urutan; jawabannya ternyata urutan itu belum pernah dipakai.'
),
(
  'GDG-06',
  'Lot Tanpa Tanggal Kedaluwarsa Diperlakukan Sebagai PALING AWET oleh FEFO — MENUNGGU KEPUTUSAN',
  'suggest_fefo_lots mengurutkan dengan `expiry_date asc nulls last`, sehingga lot yang tanggalnya belum diketahui selalu jatuh di urutan PALING BELAKANG.',
  'Bahan yang status kedaluwarsanya tidak diketahui justru diambil paling akhir. Bila kebetulan bahan itu yang paling tua, ia mengendap paling lama sampai benar-benar rusak — dan sistem yang menyebabkannya.',
  'penting',
  'Pemilik Produk',
  E'KEADAAN SEKARANG (diperiksa langsung di definisi fungsi): `order by expiry_date asc nulls last, ' ||
  E'lot_id asc`. Lot tanpa tanggal TETAP MUNCUL (tidak disembunyikan), tapi selalu paling belakang.\n\n' ||
  E'TIGA PILIHAN yang disodorkan ke pemilik produk — ini keputusan proses gudang, bukan keputusan teknis:\n' ||
  E'  A. Lot tanpa tanggal muncul PALING DEPAN dengan penanda "tanggal belum diketahui". Operator ' ||
  E'melihatnya lebih dulu dan terdorong menanyakan ke vendor. Risiko: bila ternyata memang baru, ' ||
  E'bahan baru terpakai duluan.\n' ||
  E'  B. Tetap di belakang, TAPI dengan penanda mencolok. Aman dari salah ambil, tapi mempertahankan ' ||
  E'masalah bahan tua yang mengendap.\n' ||
  E'  C. Dipisah jadi DAFTAR SENDIRI di samping saran FEFO.\n\n' ||
  E'CONDONG ARSITEK: C. Menempatkan lot tanpa tanggal di urutan mana pun berarti sistem BERPURA-PURA ' ||
  E'TAHU posisinya. Memisahkannya mengakui yang sebenarnya — status kedaluwarsanya tidak diketahui, ' ||
  E'dan itu keputusan manusia, bukan urutan otomatis. Tapi C paling mahal, dan A paling dekat dengan ' ||
  E'semangat "yang tidak diketahui harus terlihat".\n\n' ||
  E'HARUS DIPUTUSKAN SEBELUM gudang mulai mengisi: begitu ada ratusan lot, memperbaiki urutannya ' ||
  E'berarti memeriksa ulang semuanya.',
  'Tidak ada yang diubah sambil menunggu keputusan. Catatan: lot di database saat ini NOL, jadi belum ada data yang terpengaruh — ini waktu termurah untuk memutuskannya.'
)
) as d(kode, nama, deskripsi, efek, urgensi, pic, detail, catatan)
where not exists (select 1 from build_tasks b where b.task_code = d.kode and b.company_id = 1);
