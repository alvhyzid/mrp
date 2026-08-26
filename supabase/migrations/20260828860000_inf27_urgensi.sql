-- INF-27 dinilai ulang setelah dipakai sungguhan sepanjang 25 Agu 2026.
do $mig$
begin
  update build_tasks set urgency = 'penting',
    notes = concat_ws(chr(10), coalesce(notes, ''), '',
      '=== PENILAIAN ULANG 25 Agu 2026 (MM.6) ===',
      'DIPERIKSA: apakah ia MENGHALANGI task berjalan sehingga masuk pengecualian 4a?',
      'JAWABANNYA TIDAK. Ada jalan memutar yang bekerja -- logika penghitung kurungnya',
      'dijalankan langsung lewat skrip terpisah -- dan jalan itu dipakai EMPAT KALI dalam satu',
      'giliran tanpa menghentikan pekerjaan. Jadi ia TETAP DICATAT, tidak dikerjakan.',
      '',
      'TAPI URGENSINYA DINAIKKAN dari Bisa Menunggu ke Penting, dan alasannya bukan frekuensi',
      'melainkan BENTUKNYA: penjaga kurung hanya bisa berjalan lewat vitest ketika TIDAK ADA',
      'migrasi baru yang belum terpasang -- yaitu persis ketika tidak ada yang perlu diperiksa.',
      'Pada saat ia paling dibutuhkan, ia tidak bisa dijalankan.',
      '',
      'Itu menempatkannya di kelas "pengaman yang tidak berbunyi" yang sudah tercatat: ia',
      'terlihat menjaga, lulus setiap kali dijalankan, dan tidak pernah menjaga apa pun.',
      'Bedanya dengan kejadian sebelumnya cuma satu: kali ini kita menyadarinya lebih dulu.')
  where task_code = 'INF-27';
end $mig$;
