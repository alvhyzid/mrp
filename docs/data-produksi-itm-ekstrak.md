# Ekstrak Data Produksi PT ITM — Suplemen Seed Real Case

**Sumber:** `DATA_PRODUKSI_PT_ITM.pdf` (diekstrak verbatim oleh arsitek, 18 Agu 2026) + koreksi pemilik produk.
**Aturan prioritas kalau ada konflik:** `spesifikasi-aturan-biaya-v1.md` (rev. 3) > file ini > PDF asli. Bagian yang SUDAH DIKOREKSI pemilik produk ditandai ⚠️ — pakai nilai koreksinya, bukan nilai PDF.

---

## 1. Data Karyawan (33 orang)

| Nama | Jabatan | Gaji | Skema | Department (`employees.department`) |
|---|---|---|---|---|
| Alvan | Direktur | 20.000.000 | Bulanan | management |
| Bayu | General Manager | 15.000.000 | Bulanan | management |
| Dimas | Manager PPIC | 8.000.000 | Bulanan | ppic |
| Dika | Staff PPIC | 4.000.000 | Bulanan | ppic |
| Mega | Staff Purchasing | 3.500.000 | Bulanan | purchasing |
| Asni | SPV Finance | 5.000.000 | Bulanan | finance |
| Ayu | SPV HRD | 5.000.000 | Bulanan | hr |
| Dina | SPV Produksi Gummy | 3.500.000 | Bulanan | production |
| Angga | SPV Produksi Powder | 3.500.000 | Bulanan | production |
| Miasih, Sutik, Mini, Momo, Joni, Alif | Pegawai Kontrak Gummy (6 orang) | 2.000.000 | Bulanan | production |
| Iwan, Nawi, Budi, Joko, Retno, Mimi | Pegawai PHL Gummy (6 orang) | 50.000 | Harian | production |
| Ali, Uli, Ardi, Yupi, Bobo, Baki, Moli, Suci, Tono, Tunik, Centik, Boko | Pegawai PHL Powder (12 orang) | 50.000 | Harian | production |

Tarif per jam mengikuti spesifikasi §2 (bulanan ÷ 173,3333; harian ÷ jam terjadwal hari itu: 7 biasa / 5 Sabtu). Gaji tunduk aturan privasi yang berlaku (hanya company_admin + HRD + diri sendiri).

---

## 2. SOP Produksi Gummy (10 proses — bahan routing)

Durasi AKTIF tidak diberikan di PDF → isi sebagai `ESTIMASI_MANUAL` berlabel (pola K8). Durasi TUNGGU eksplisit dari SOP dicantumkan di bawah.

1. **Premix Gelatin** (batch WIP terpisah, dibuat H-1): dry mix gelatin Nitta Bloom250 60g + citric 1g → masak air 100ml sampai 40°C → masukkan drymix → **tunggu 12 jam** (wait_duration = 720 menit).
2. **Proses Cooking** (6 tahap internal, boleh dimodelkan 1 step routing "Cooking" atau dipecah — pilih yang praktis): (T1) mix maltitol + polydextrose + polysorb, masak s/d 120°C; (T2) dry mix perfecta gel 928 + perfecta gel mb + air 100ml + sorbitol liquid + glyserin, masak sampai matang; (T3) campur T1+T2, aduk homogen; (T4) tunggu suhu turun ke 90°C; (T5) tambahkan gelatin bloom dari premix gelatin; (T6) tambahkan kolagen + citric acid + glutathione.
3. **Molding**: cetak adonan pada suhu 80°C.
4. **Setting**: ruang set **1 jam** (wait_duration = 60 menit).
5. **Demolding**: lepaskan gummy dari cetakan.
6. **Coating**: bahan Capol, rasio 1kg gummy : 1ml coating.
7. **Curing**: ruang curing **3 hari** (wait_duration = 4320 menit).
8. **Filling**: isi botol 60 pcs/botol; (SOP menyebut segel alumunium & tutup botol — ⚠️ item alumunium seal/child lock/plastic seal/silica gel TIDAK masuk biaya v1 sesuai keputusan harga pemilik produk).
9. **Pengemasan**: stiker label botol → lipat box dalam → isi box → masukkan box luar → stiker segel.
10. **Pengepakan**: ⚠️ PDF menulis "karton isi 20 box" — DIKOREKSI pemilik produk: **karton isi 27 botol, harga Rp3.500**.

## 3. SOP Produksi Minuman Serbuk (12 proses)

1. Persiapan: timbang semua bahan per kebutuhan mixing.
2. Mixing premix: tiap premix di-mix satu-satu, ditempatkan di plastik klip (batch premix 500g–5kg).
3. Mixing utama: semua bahan non-premix + premix sesuai formulasi (batch minimal 60 kg).
4. Ayak hasil mixing di mesin ayak.
5. Pindahkan ke area filling.
6. Filling ke sachet (mesin sachet).
7. QC sachet bocor.
8. Filling box: 14 sachet/box (yang lolos QC).
9. Tutup box + lem.
10. Coding expired date + kode produksi.
11. Plastic wrap box + tunnel.
12. Pengepakan: karton isi 42 box (⚠️ harga karton dari pemilik produk: **Rp15.000**).

---

## 4. Harga Bahan Baku (per KG atau per LITER — dari PDF, verbatim + normalisasi nama)

| Nama di PDF | Nama baku (pakai ini di item master) | Harga/kg atau /L |
|---|---|---|
| Maltitol powder | Maltitol Powder | 315.000 |
| polysorb | Polysorb | 268.000 |
| Sorbitol liquid | Sorbitol Liquid | 18.000 |
| Gelatin Bloom 25- *(terpotong di PDF)* | Gelatin Nitta Bloom250 | 210.000 |
| Perfecta gel 928 | Perfecta Gel 928 | 95.000 |
| Perfecta gel mb | Perfecta Gel MB | 60.000 |
| Gellan gum | Gellan Gum | 400.000 |
| glyserin | Glyserin | 30.000 |
| polydextrose | Polydextrose | 60.000 |
| Malic Acid | Malic Acid | 44.000 |
| Citric Acid | Citric Acid | 25.000 |
| kolegen *(typo PDF)* | Kolagen | 210.000 |
| glutathione | Glutathione | 2.500.000 |
| air | Air | 500 |
| Maltodextrin | Maltodextrin | 20.000 |
| Sorbitol powder | Sorbitol Powder | 58.000 |
| inulin | Inulin | 60.000 |
| PSYLIUM HUSK | Psylium Husk | 280.000 |
| papain | Papain | 500.000 |
| bromalin | Bromalin | 400.000 |
| zoefree | Zoefree | 28.000 |
| GARAM | Garam | 12.000 |
| GARCIA CAMBOGIA *(typo PDF)* | Garcinia Cambogia | 400.000 |
| Stevia Powder | Stevia Powder | 900.000 |
| Sucralose | Sucralose | 40.000 |
| Derasi Orange | Derasi Orange (flavor vendor — produk tetap "Drinkme Lemon") | 1.400.000 |
| Asorbic Acid *(typo PDF)* | Ascorbic Acid | 70.000 |
| Sereh Powder | Sereh Powder | 300.000 |

Konversi ke per-gram/per-ml = harga ÷ 1000 (sudah dipakai konsisten di seluruh contoh spesifikasi).

## 5. Harga Kemasan

| Item | Harga/pcs | Catatan |
|---|---|---|
| Botol PET N200 | 5.500 | ⚠️ PDF BOM menulis "N800" — dikoreksi: N200 |
| Label Stiker Botol N200 | 1.100 | per botol |
| Inner Box | 800 | per botol |
| Outer Box | 1.100 | ⚠️ PER BOTOL (bukan dibagi) — koreksi pemilik produk |
| Stiker Segel | 200 | per botol |
| Karton Gummy (isi 27 botol) | 3.500 | ⚠️ dari pemilik produk (tidak ada di PDF) |
| Sachet | 138 | per sachet |
| Box isi 14 Sachet | 1.500 | per box |
| Plastic Wrap Box | 200 | per box |
| Karton Serbuk (isi 42 box) | 15.000 | ⚠️ dari pemilik produk (tidak ada di PDF) |

## 6. Lead Time & Stok (PDF + revisi real case)

- Order bahan baku: **2–5 hari** (semua supplier bahan).
- Cetak sachet: **2 minggu kerja**; cetak box: **2 minggu kerja**.
- Botol: ⚠️ PDF menulis "stok 2.000, sisanya order China 4 minggu" — DIKOREKSI real case: **stok 0; 30.500 pcs ETA 22 Agustus 2026** (PO supplier China, belum diterima).
- Seluruh stok bahan baku saat inject = **0** — data stok opname riil menyusul (diinput lewat fitur Saldo Awal).
