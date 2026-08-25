-- DS-04 (25 Agu 2026) — lonceng notifikasi disejajarkan dengan aksi header lain.

do $$
begin
update build_tasks set
  notes = coalesce(notes || E'\n\n','') ||
    E'=== LONCENG NOTIFIKASI TIDAK SEJAJAR (temuan pemilik produk) ===\n\n' ||
    E'SEBABNYA: pemicunya <button> berukuran 32x32 yang ditulis sendiri, diletakkan\n' ||
    E'berdampingan dengan aksi header Carbon berukuran 48x48. Ia bukan meleset beberapa\n' ||
    E'piksel -- ukurannya memang berbeda 16px.\n\n' ||
    E'YANG PENTING SOAL PERBAIKANNYA: bukan digeser, melainkan DIGANTI komponen Carbon\n' ||
    E'(HeaderGlobalAction). Menggesernya akan membuatnya meleset lagi setiap kali Carbon\n' ||
    E'mengubah tinggi header -- dan tidak akan ada yang mengingatkan. Ikut komponennya berarti\n' ||
    E'ukuran, hover, fokus, DAN warna ikut tema shell (g100) dengan sendirinya.\n' ||
    E'Pembungkusnya juga disetel setinggi header dan tidak menyusut; panel isinya digantung\n' ||
    E'dari TEPI BAWAH pembungkus (top: 100%), bukan dari jarak yang dihitung tangan.\n\n' ||
    E'DIUKUR SESUDAH PERBAIKAN -- keempat aksi header:\n' ||
    E'  lonceng      atas 0, bawah 48, tinggi 48, titik tengah y=24\n' ||
    E'  tombol "+"   atas 0, bawah 48, tinggi 48, titik tengah y=24\n' ||
    E'  tombol akun  atas 0, bawah 48, tinggi 48, titik tengah y=24\n' ||
    E'  keluar       atas 0, bawah 48, tinggi 48, titik tengah y=24\n' ||
    E'Panel lonceng: tepat di bawah header (atas=48), rata kanan dengan tombolnya.\n\n' ||
    E'=== EFEK SAMPING YANG DITEMUKAN PENJAGA SENDIRI ===\n' ||
    E'Test sudut tajam MERAH sesudah perbaikan ini, dan alasannya bagus: lonceng berhenti\n' ||
    E'memakai kelas `rounded-full` -- bukan karena bentuknya berubah, melainkan karena\n' ||
    E'bulatannya PINDAH ke stylesheet sebagai border-radius: 50%.\n' ||
    E'Penjaga versi lama hanya menyisir berkas TSX, jadi bentuk bulat yang pindah ke SCSS akan\n' ||
    E'LOLOS TANPA TERDETEKSI. Itu lubang yang bentuknya PERSIS SAMA dengan cacat yang\n' ||
    E'melahirkan penjaga ini: memeriksa satu tempat lalu menyimpulkan seluruhnya.\n' ||
    E'Jangkauannya diperluas ke SCSS, dan dibuktikan menggigit: border-radius 50% disisipkan\n' ||
    E'ke publik.scss -> merah menyebut berkasnya; dicabut -> hijau.\n\n' ||
    E'BATAS YANG DISADARI: hanya PEMICUNYA yang jadi Carbon. Isi panel notifikasi masih\n' ||
    E'komponen lama dengan warna ditulis tangan -- itu pekerjaan gelombang berikutnya.\n\n' ||
    E'BUKTI ULANG: 28/28 halaman utuh, 5 lebar benar, konsol BERSIH, build produksi berhasil,\n' ||
    E'13 test lulus.'
where task_code = 'DS-04';
end $$;
