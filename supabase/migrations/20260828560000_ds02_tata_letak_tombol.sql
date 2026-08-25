-- DS-02 (25 Agu 2026) — koreksi TATA LETAK tombol setelah pertanyaan pemilik produk.

do $$
begin
update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'=== KOREKSI TATA LETAK, 25 Agu 2026 (pertanyaan pemilik produk) ===\n\n' ||
    E'PERTANYAANNYA: "penempatan button di kiri untuk fungsi utama (login), apakah memang\n' ||
    E'seperti itu instruksinya di Carbon?"\n\n' ||
    E'JAWABANNYA: aturan yang dipakai MEMANG aturan Carbon -- hanya saja untuk JENIS FORMULIR\n' ||
    E'YANG BERBEDA. Ini kekeliruan yang halus dan tidak akan pernah tertangkap oleh pengukuran,\n' ||
    E'karena tidak ada satu pun nilai yang salah.\n\n' ||
    E'Tabel Carbon di patterns/forms-pattern, bagian "Buttons in forms":\n' ||
    E'    rata kiri, tanpa rapat tepi -> formulir DI DALAM HALAMAN, bukan dialog\n' ||
    E'    rata kanan                  -> formulir bertahap / wizard\n' ||
    E'    MELEBAR PENUH, RAPAT TEPI   -> formulir di dalam DIALOG, PANEL SAMPING, DAN TILE\n' ||
    E'Kalimat persisnya: "In side panels, dialogs, and any other forms within tiles, the button\n' ||
    E'group should span the width of the container and buttons should bleed to the bottom edge."\n\n' ||
    E'Formulir layar publik kita berada DI DALAM TILE. Jadi aturan yang berlaku yang ketiga,\n' ||
    E'bukan yang pertama.\n\n' ||
    E'PENGAKUAN YANG PERLU DICATAT: tombol versi LAMA sebenarnya sudah melebar penuh, dan itu\n' ||
    E'bagian yang BENAR. Yang salah pada versi lama hanya TEKSNYA yang di tengah. Perbaikan\n' ||
    E'pertama saya membetulkan teksnya lalu ikut mencabut lebar penuhnya -- memperbaiki satu\n' ||
    E'hal dan merusak hal lain yang sudah benar.\n\n' ||
    E'YANG DIUBAH SEKARANG:\n' ||
    E'  - Kelompok tombol pindah ke KAKI kartu, melebar penuh, rapat ke tepi.\n' ||
    E'  - Tombol utama di KANAN (aturan Carbon untuk wadah berstruktur), sekunder di kiri.\n' ||
    E'  - Di layar sempit menumpuk vertikal dengan tombol utama di BAWAH -- juga aturan Carbon.\n' ||
    E'  - "Lupa kata sandi?" SENGAJA tetap di dalam formulir, dekat field-nya, sesuai anatomi\n' ||
    E'    login Carbon. Bentuknya tombol ghost supaya area tekannya tetap 48px.\n' ||
    E'  - Padding kartu dipindah ke isi; kartunya sendiri tanpa padding. Tanpa itu tombol\n' ||
    E'    mustahil rapat ke tepi.\n\n' ||
    E'SATU CACAT SAAT MENGERJAKANNYA: jarak di atas tombol sempat 96px -- $spacing-09 diberikan\n' ||
    E'DUA KALI, dari isi dan dari kelompok tombolnya. Dua aturan yang sama-sama benar,\n' ||
    E'dijumlahkan. Sekarang jaraknya hanya datang dari satu tempat.\n\n' ||
    E'KEPUTUSAN PEMILIK PRODUK yang menyertainya: gaya isian tetap DEFAULT, tidak diganti ke\n' ||
    E'FLUID. Carbon menyebut fluid sebagai bentuk ideal untuk layar masuk/daftar, tapi default\n' ||
    E'itulah yang akan dipakai 37 layar lain -- memakai gaya berbeda hanya di layar masuk\n' ||
    E'membuat orang berpindah antara dua tampilan formulir.\n\n' ||
    E'HAL YANG CARBON SERAHKAN KE KITA, jadi bukan pelanggaran: posisi formulir di halaman\n' ||
    E'(kiri/kanan/tengah). Kalimat Carbon: "decisions like where to position the login flow on\n' ||
    E'a page (i.e. left, right, or center) ... can be made at the product team level as long as\n' ||
    E'the fields remain on the grid." Kita memakai TENGAH.\n\n' ||
    E'BUKTI ULANG setelah perubahan: 7 layar x 4 lebar = 28 pemeriksaan, seluruhnya bersih.\n' ||
    E'Build produksi berhasil. Tujuh penjaga tetap hijau.\n\n' ||
    E'Tabel penempatan tombol disalin ke docs/governance/rujukan-carbon.md, karena ia akan\n' ||
    E'menentukan tata letak 31 layar berikutnya.'
where task_code = 'DS-02';
end $$;
