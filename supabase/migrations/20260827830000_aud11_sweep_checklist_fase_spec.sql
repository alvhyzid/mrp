-- AUD-11 -- sapu penuh docs/checklist-fase-spec-vs-fabrix.md (47 baris tabel
-- status, per 20 Agu 2026 -- dokumen sendiri menghitung "43" di rekap ringkas,
-- pengecekan baris-per-baris tabel ini menghasilkan 47; tetap disapu seluruhnya,
-- bukan cuma 43). Metodologi sama seperti AA.1/H.4/BB.2: tiap baris dicocokkan
-- ke build_tasks lewat kata kunci, bukan asumsi.
--
-- HASIL PER KATEGORI:
-- (a) masih relevan, BELUM ada task -> 3 dicatat di bawah (safety_stock,
--     biaya mesin & overhead costing, Invoice & Piutang/AR).
-- (b) sudah dikerjakan sejak 20 Agu tanpa disadari, TIDAK dijadikan task baru:
--     "Operation" (routing_step_standard_crew) -- checklist masih menulis
--     "0 baris di semua tahap", TAPI "Bagian B" (20 Agu, migrasi seri
--     20260821xxx) SUDAH mengisi kru standar untuk lini gummy (routing_id 6)
--     dan serbuk (routing_id 61/62) -- HANYA premix (5 tahap serbuk + 1
--     gummy) yang MASIH 0 baris. Task MST-11 (sudah ada) tetap menutupi sisa
--     pekerjaannya (UI pengaturan + premix) -- tidak perlu task kedua.
-- (c) sudah tidak berlaku karena keputusan sesudahnya: TIDAK ADA ditemukan --
--     dokumen ini sudah relatif mutakhir (ditulis 20 Agu, sebagian besar
--     berisi keputusan "ditunda sadar"/"ditolak" yang eksplisit dan masih
--     berlaku, bukan status sementara yang lalu dibatalkan).
-- Sisanya (~43 dari 47 baris): SUDAH tercakup task lain yang sudah ada
-- (RDM-02/03/04/05, MST-10/11/13, DOC-02, PJL-06, AIR-01/02, AIP-01, dan
-- beberapa keputusan "sengaja tidak diadopsi"/"sudah cukup di skala sekarang"
-- yang tidak butuh task sama sekali) -- rinciannya dilaporkan di chat, bukan
-- diulang di komentar migrasi ini.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- seed build_tasks (migrasi ini) dilewati (no-op).';
    return;
  end if;

insert into public.build_tasks
  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes)
values
(
  v_company_id, 'MST-14', 'Kolom Safety Stock per Item (Material Requirement Planning)', 'MST', 'Master Data',
  'Mesin kekurangan bahan (shortage engine) menghitung netting kebutuhan vs stok per lot dengan benar, TAPI belum punya konsep `safety_stock` (stok pengaman minimum) per item -- seluruh bahan MLVT tampil sebagai "kekurangan" apa adanya tanpa buffer pengaman.',
  'Tanpa safety stock, sistem tidak bisa membedakan "benar-benar kurang" dari "sudah di bawah ambang aman tapi masih ada stok" -- keputusan pembelian ulang jadi lebih reaktif (menunggu benar-benar nol) daripada proaktif.',
  'bisa_menunggu', array['Database','Fungsi'], 'Claude Code', 'menunggu', null, 'temuan_claude',
  'Tambah kolom `safety_stock_qty` (nullable, per item) ke `items`, ikutkan di perhitungan shortage engine sebagai ambang tambahan (kebutuhan efektif = kebutuhan bersih + safety_stock). Sudah disepakati sebagai "tumpangan murah" per checklist sumber (20 Agu 2026) -- tinggal dibangun, bukan keputusan bisnis baru yang perlu ditanya ulang.',
  'Ditemukan lewat AUD-11 (22 Agu 2026, sapu docs/checklist-fase-spec-vs-fabrix.md, baris "Material Requirement" Phase 3) -- sudah dicatat "disepakati" di dokumen sejak 20 Agu tapi tidak pernah jadi task tersendiri.'
),
(
  v_company_id, 'MRG-12', 'Biaya Mesin & Overhead dalam Costing', 'MRG', 'Margin & Biaya',
  'Mesin biaya (costing engine) sudah menghitung biaya material+SDM+margin dua tingkat, TAPI biaya mesin (depresiasi/listrik per jam mesin) dan overhead pabrik BELUM masuk komponen HPP -- keputusan sadar sejak awal (K3), bukan lupa.',
  'HPP saat ini hanya mencerminkan bahan+SDM -- begitu ada cukup data produksi nyata (2-3 bulan, MLVT), biaya mesin/overhead perlu ditambahkan supaya margin yang ditampilkan tidak lebih optimis dari kenyataan.',
  'tidak_mendesak', array['Formula'], 'Claude Code', 'ditunda_sadar', null, 'temuan_claude',
  'JANGAN dikerjakan sebelum pemicu terpenuhi (K3: 2-3 bulan data produksi nyata terkumpul, supaya angka biaya mesin/overhead per unit tidak menebak dari data kosong). Begitu pemicu terpenuhi, perlu keputusan pemilik produk soal basis alokasi (per jam mesin? per unit output? flat per batch?).',
  'Ditemukan lewat AUD-11 (22 Agu 2026, sapu docs/checklist-fase-spec-vs-fabrix.md, baris "Costing" Phase 6) -- keputusan ditunda-sadar sudah tercatat di dokumen sejak 20 Agu dengan pemicu jelas, tapi tidak pernah jadi task berdiri sendiri yang bisa dilacak/dibuka kembali otomatis saat pemicunya terpenuhi.'
),
(
  v_company_id, 'FIN-01', 'Invoice & Piutang (Accounts Receivable) — Roadmap FABRIX Finance', 'FIN', 'Keuangan',
  'FABRIX by design TIDAK menggantikan software akuntansi (mengekspor ke sana, bukan menggantikan) -- tapi Invoice & Piutang (AR) sendiri, sebelum data diekspor ke akuntansi, belum punya modul di FABRIX sama sekali. Costing/margin sudah ada; Invoice & AR masih murni roadmap.',
  'Tanpa modul Invoice & AR, penerbitan tagihan ke klien dan pelacakan piutang belum dan tidak akan tersambung ke data Sales Order/pengiriman yang sudah ada di FABRIX -- masih dikerjakan di luar sistem.',
  'bisa_menunggu', array['Fungsi','Database'], 'Pemilik Produk', 'menunggu', null, 'temuan_claude',
  'Perlu keputusan pemilik produk lebih dulu (bukan teknis semata, sesuai CLAUDE.md): apakah modul Invoice & AR memang masuk cakupan FABRIX (vs cukup ekspor data ke software akuntansi eksternal), dan kalau ya, cakupannya sampai mana (invoice standar? termin pembayaran? aging piutang?). Belum ada desain skema untuk ini.',
  'Ditemukan lewat AUD-11 (22 Agu 2026, sapu docs/checklist-fase-spec-vs-fabrix.md, baris "Finance" Phase 6) -- disebut eksplisit sebagai "roadmap FABRIX Finance" di dokumen sejak 20 Agu tapi tidak pernah jadi task tersendiri.'
);

update public.build_tasks
set status = 'selesai',
    completed_at = now(),
    detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nDITUTUP 22 Agu 2026 (AUD-11) -- seluruh 47 baris tabel status docs/checklist-fase-spec-vs-fabrix.md diperiksa satu per satu terhadap kondisi terkini dan terhadap build_tasks. Hasil: 3 baris genuinely belum pernah jadi task (dicatat: MST-14 safety_stock, MRG-12 biaya mesin & overhead, FIN-01 Invoice & Piutang). 1 baris ("Operation"/routing_step_standard_crew) sudah SEBAGIAN dikerjakan sejak 20 Agu (kru gummy+serbuk utama terisi via Bagian B) tanpa checklist ini diperbarui -- tidak dijadikan task baru karena MST-11 sudah menutupi sisa pekerjaannya (premix + UI). 0 baris ditemukan kedaluwarsa (dokumen ini sudah relatif mutakhir, keputusan "ditunda sadar"/"ditolak" di dalamnya masih berlaku). Sisanya (~43 baris) sudah tercakup task lain yang sudah ada (RDM-02/03/04/05, MST-10/11/13, DOC-02, PJL-06, AIR-01/02, AIP-01) atau memang keputusan "tidak perlu dibangun" yang masih sah.'
where task_code = 'AUD-11'
  and company_id = v_company_id;

end $$;
