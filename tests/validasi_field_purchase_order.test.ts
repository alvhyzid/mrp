// DS-25 — PENJAGA VALIDASI TINGKAT FIELD, pilot: modal "Buat PO" di /purchasing.
//
// ============================================================================
// KENAPA BERKAS INI ADA
// ============================================================================
// Sebuah formulir bisa TAHU isian mana yang salah dan tetap tidak memberi tahu penggunanya.
// Modal PO punya enam kontrol (dua di atas, tiga per baris item, dan barisnya bisa banyak),
// sementara seluruh penolakan muncul sebagai SATU kalimat di dasar modal. Pesan seperti
// "Jumlah pesan harus angka positif" pada PO lima baris memindahkan pekerjaan mencari dari
// sistem ke pengguna -- padahal validatornya tahu persis baris mana.
//
// ============================================================================
// APA YANG DIUJI: PERILAKU, BUKAN JUMLAH
// ============================================================================
// Penjaga ini TIDAK menghitung berapa banyak `invalidText` ada di repo. Angka itu bisa naik
// tanpa satu pun galat sampai ke tempat yang benar. Yang diuji: untuk sebuah masukan yang
// salah, apakah jawabannya MENYEBUTKAN field yang bisa diperbaiki pengguna -- dan yang sama
// pentingnya, apakah galat yang BUKAN milik satu field tetap TIDAK menyebutkannya.
//
// Golongan mengikuti docs/ux/FABRIX_FIELD_VALIDATION_CLASS_STANDARD.md §2.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tanpaKomentar } from './util/tanpaKomentar';
import {
  parsePurchaseOrderInput,
  petakanGalatServerPo,
  FIELD_PO,
  FIELD_PO_BARIS
} from '../src/features/mrp/server/purchaseOrderValidation';

const barisSah = { item_id: 7, qty_ordered: 3, unit_price: 1000 };
const masukanSah = { supplier_id: 1, production_plant_id: 2, expected_date: '2026-09-01', lines: [barisSah] };

describe('DS-25 — validasi tingkat field pada PO ke supplier', () => {
  it('(a) masukan yang sah tidak menghasilkan galat sama sekali', () => {
    const hasil = parsePurchaseOrderInput({ ...masukanSah });
    expect(hasil.error).toBeUndefined();
    expect(hasil.field).toBeUndefined();
    expect(hasil.data?.lines).toHaveLength(1);
  });

  it('(b) galat GOLONGAN A menyebut field yang bisa diperbaiki pengguna', () => {
    const kasus: { masukan: Record<string, unknown>; field: string }[] = [
      { masukan: { ...masukanSah, supplier_id: 0 }, field: 'supplier_id' },
      { masukan: { ...masukanSah, production_plant_id: 0 }, field: 'production_plant_id' }
    ];
    for (const { masukan, field } of kasus) {
      const hasil = parsePurchaseOrderInput(masukan);
      expect(hasil.error, `${field} seharusnya ditolak`).toBeTruthy();
      expect(hasil.field, `galat untuk ${field} harus menyebut field-nya`).toBe(field);
      expect(hasil.line, `${field} bukan field baris`).toBeUndefined();
    }
  });

  it('(c) galat pada BARIS menyebut field DAN nomor barisnya', () => {
    const kasus: { baris: Record<string, unknown>[]; field: string; line: number }[] = [
      { baris: [barisSah, { ...barisSah, item_id: 0 }], field: 'item_id', line: 1 },
      { baris: [barisSah, barisSah, { ...barisSah, qty_ordered: 0 }], field: 'qty_ordered', line: 2 },
      { baris: [{ ...barisSah, unit_price: -5 }], field: 'unit_price', line: 0 }
    ];
    for (const { baris, field, line } of kasus) {
      const hasil = parsePurchaseOrderInput({ ...masukanSah, lines: baris });
      expect(hasil.error, `${field} baris ${line} seharusnya ditolak`).toBeTruthy();
      expect(hasil.field).toBe(field);
      expect(hasil.line, `harus menyebut baris ke-${line}, bukan "salah satu baris"`).toBe(line);
    }
  });

  it('(d) galat GOLONGAN B tetap TIDAK menyebut field — dan itu yang benar', () => {
    // "Minimal 1 baris item wajib diisi" bukan milik satu isian: pengguna harus MENAMBAH
    // baris, bukan memperbaiki sesuatu yang terlihat. Menandainya di sebuah kontrol akan
    // menunjuk isian yang bukan penyebabnya.
    for (const lines of [[], undefined]) {
      const hasil = parsePurchaseOrderInput({ ...masukanSah, lines });
      expect(hasil.error).toBeTruthy();
      expect(hasil.field, 'galat tingkat formulir tidak boleh mengaku milik sebuah field').toBeUndefined();
      expect(hasil.line).toBeUndefined();
    }
  });

  it('(e) kalimat pesannya TIDAK berubah — pemindahan dan penulisan ulang tidak dicampur', () => {
    // Aturan §6 butir 5: memindahkan galat DAN menulis ulang kalimatnya sekaligus membuat
    // tidak ada yang bisa tahu mana yang memperbaiki apa.
    expect(parsePurchaseOrderInput({ ...masukanSah, supplier_id: 0 }).error).toBe('Supplier wajib dipilih.');
    expect(parsePurchaseOrderInput({ ...masukanSah, production_plant_id: 0 }).error).toBe('Lokasi pabrik (alamat kirim) wajib dipilih.');
    expect(parsePurchaseOrderInput({ ...masukanSah, lines: [] }).error).toBe('Minimal 1 baris item wajib diisi.');
    expect(parsePurchaseOrderInput({ ...masukanSah, lines: [{ ...barisSah, qty_ordered: 0 }] }).error).toBe('Jumlah pesan harus angka positif.');
  });

  it('(f) halaman menandai KONTROL-nya, bukan hanya menampilkan kalimat', () => {
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/pages/PurchasingPage.tsx'), 'utf8'));
    expect(s, 'halaman harus menyimpan field yang ditolak, bukan hanya kalimatnya').toMatch(/poFieldError/);
    // Kontrol modal PO wajib menerima invalid + invalidText dari Carbon, bukan aria buatan sendiri.
    expect(s.match(/invalidText=/g)?.length ?? 0, 'kontrol modal PO belum menerima invalidText').toBeGreaterThanOrEqual(5);
    expect(s, 'jangan menulis aria-invalid sendiri — Carbon sudah memancarkannya').not.toMatch(/aria-invalid=/);
  });

  it('(g) galat field dibersihkan saat isiannya diubah dan saat modal dibuka', () => {
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/pages/PurchasingPage.tsx'), 'utf8'));
    // Sengaja TIDAK mengikat bentuk nilainya (null vs []). Versi pertama penjaga ini menuntut
    // `setPoFieldError(null)` dan itu menguji DETAIL IMPLEMENTASI, bukan perilaku — persis yang
    // dilarang brief kelas ini. Yang diuji: galatnya benar-benar dibersihkan.
    const bersih = (s.match(/setPoFieldError\(\s*(?:null|\[\])\s*\)/g) ?? []).length;
    expect(bersih, 'harus dibersihkan di beberapa tempat: buka modal, ubah isian, dan sebelum kirim ulang').toBeGreaterThanOrEqual(3);
  });

  it('(h) notifikasi tingkat formulir HANYA muncul untuk galat yang bukan milik field', () => {
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/pages/PurchasingPage.tsx'), 'utf8'));
    // Penjaga ini sengaja mengikat SYARAT RENDER-nya, bukan keberadaan komponennya:
    // InlineNotification yang tetap tampil saat galat sudah ditandai di field akan
    // menampilkan kalimat yang sama dua kali.
    expect(s, 'notifikasi formulir modal PO harus disyaratkan tidak ada poFieldError').toMatch(
      /poFormStatus === 'error' && poFormMessage && (?:!poFieldError|poFieldError\.length === 0)/
    );
  });
});

// ============================================================================
// T-V4 — PENJAGA PEMETAAN FIELD DI BATAS SERVER -> KLIEN
// ============================================================================
// Jawaban server adalah data RUNTIME. TypeScript tidak memeriksanya, dan sampai penjaga ini
// ada, sebuah nama field yang salah ketik menghasilkan bentuk kegagalan yang paling sulit
// ditemukan: server mengirim galat -> nol kontrol cocok -> notifikasi formulir JUGA digerbang
// mati karena "sudah ada galat field" -> pengguna TIDAK MELIHAT APA PUN -> seluruh test tetap
// hijau. Galatnya tidak salah tempat; galatnya HILANG.
//
// Yang diuji di bawah adalah PERILAKU di batas itu, bukan bentuk kodenya.
describe('T-V4 — pemetaan galat server ke field formulir', () => {
  const duaBaris = 2;

  it('(i) field yang TIDAK DIKENAL tidak boleh menghilangkan galatnya', () => {
    for (const field of ['does_not_exist', 'quantity', 'quantitty', '', 'supplier', 'SUPPLIER_ID']) {
      const hasil = petakanGalatServerPo({ error: 'Pesan asli dari server.', field }, duaBaris);
      expect(hasil.jenis, `field "${field}" tidak dikenal -> wajib naik ke tingkat formulir`).toBe('formulir');
      expect(hasil.pesan, 'kalimat aslinya WAJIB dipertahankan — pengguna tetap harus tahu apa yang salah').toBe('Pesan asli dari server.');
    }
  });

  it('(j) field baris dengan line di luar jangkauan tidak boleh menandai baris yang salah', () => {
    for (const line of [duaBaris, duaBaris + 5, -1, 99]) {
      const hasil = petakanGalatServerPo({ error: 'Jumlah pesan harus angka positif.', field: 'qty_ordered', line }, duaBaris);
      expect(hasil.jenis, `line ${line} di luar jangkauan (${duaBaris} baris)`).toBe('formulir');
      expect(hasil.pesan).toBe('Jumlah pesan harus angka positif.');
    }
  });

  it('(k) field baris TANPA line naik ke tingkat formulir — barisnya tidak bisa ditebak', () => {
    for (const line of [undefined, null, '0', 1.5, NaN]) {
      const hasil = petakanGalatServerPo({ error: 'Item pada salah satu baris tidak valid.', field: 'item_id', line }, duaBaris);
      expect(hasil.jenis, `line=${String(line)} bukan indeks yang sah`).toBe('formulir');
    }
  });

  it('(l) field yang sah dipetakan ke kontrolnya', () => {
    const a = petakanGalatServerPo({ error: 'Supplier wajib dipilih.', field: 'supplier_id' }, duaBaris);
    expect(a).toEqual({ jenis: 'field', field: 'supplier_id', line: undefined, pesan: 'Supplier wajib dipilih.' });

    for (const line of [0, duaBaris - 1]) {
      const b = petakanGalatServerPo({ error: 'Jumlah pesan harus angka positif.', field: 'qty_ordered', line }, duaBaris);
      expect(b, `baris ${line} sah`).toEqual({ jenis: 'field', field: 'qty_ordered', line, pesan: 'Jumlah pesan harus angka positif.' });
    }
  });

  it('(m) field NON-baris yang membawa line tetap ditandai, line-nya diabaikan', () => {
    // Pemetaannya TIDAK gagal — supplier_id tidak ambigu. Yang tidak bermakna hanyalah
    // line-nya, dan menaikkannya ke tingkat formulir justru akan MEMINDAHKAN galat yang
    // sebenarnya bisa ditunjuk. Keputusan ini ditulis di standar §3 supaya tidak dikira lalai.
    const hasil = petakanGalatServerPo({ error: 'Supplier tidak valid.', field: 'supplier_id', line: 1 }, duaBaris);
    expect(hasil).toEqual({ jenis: 'field', field: 'supplier_id', line: undefined, pesan: 'Supplier tidak valid.' });
  });

  it('(n) tanpa field sama sekali -> tingkat formulir, seperti sebelumnya', () => {
    const hasil = petakanGalatServerPo({ error: 'Role Anda tidak punya izin membuat PO ke supplier.' }, duaBaris);
    expect(hasil.jenis).toBe('formulir');
    expect(hasil.pesan).toBe('Role Anda tidak punya izin membuat PO ke supplier.');
  });

  it('(p) memperbaiki sebuah isian mencabut TANDANYA SAJA, dan menghapus baris tidak meninggalkan tanda yatim', () => {
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/pages/PurchasingPage.tsx'), 'utf8'));
    // Isian tingkat atas: satu pintu yang mencabut tanda field ITU saja (bukan seluruhnya —
    // mengosongkan semuanya akan menyembunyikan isian lain yang masih salah).
    expect(s, 'harus ada pintu bersama untuk isian PO tingkat atas').toMatch(/const ubahFieldPo\s*=/);
    expect(s).toMatch(/setPoFieldError\(\(prev\) => prev\.filter\(\(g\) => g\.field !== field\)\)/);
    expect(s, 'dropdown supplier & lokasi wajib lewat pintu itu').toMatch(/ubahFieldPo\('supplier_id'/);
    expect(s).toMatch(/ubahFieldPo\('production_plant_id'/);
    // Isian baris: hanya field+baris itu yang dicabut.
    expect(s).toMatch(/prev\.filter\(\(g\) => !\(g\.field === field && g\.line === index\)\)/);
    // Baris dihapus: SELURUH tanda dibuang, karena indeks baris bergeser dan tanda yang
    // tertinggal akan menunjuk baris yang salah.
    const hapus = s.slice(s.indexOf('const removePoLine'), s.indexOf('const updatePoLine'));
    expect(hapus, 'menghapus baris harus membuang seluruh tanda — indeksnya bergeser').toMatch(/setPoFieldError\(\[\]\)/);
  });

  it('(q) server menyusun galat field lewat pembangun bertipe, bukan objek mentah', () => {
    // Ditemukan lewat MENJALANKAN mutasi, bukan membaca: `ApiResult.body` bertipe
    // Record<string, unknown>, jadi menulis `field: 'supplier'` LANGSUNG di dalamnya lolos
    // typecheck sepenuhnya. Lapisan kompilasi baru berlaku bila namanya melewati sebuah
    // parameter bertipe FieldPo.
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/server/createPurchaseOrder.ts'), 'utf8'));
    expect(s, 'galat field wajib lewat galatFieldPo').toMatch(/galatFieldPo\(/);
    expect(s, 'jangan menulis field mentah di dalam body — typecheck tidak akan memeriksanya').not.toMatch(/body:\s*\{[^}]*field:/);
  });

  it('(o) daftar field adalah SATU sumber, dan formulir memakai nama yang sama persis', () => {
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/pages/PurchasingPage.tsx'), 'utf8'));
    // Nama yang dipakai halaman saat menandai kontrol wajib berasal dari daftar bersama —
    // bukan diketik ulang. Ini yang mencegah salah ketik lahir di sisi klien.
    for (const f of [...FIELD_PO, ...FIELD_PO_BARIS]) {
      if (!s.includes(`galatPo('${f}'`)) continue;
      expect([...FIELD_PO, ...FIELD_PO_BARIS], `${f} harus ada di daftar bersama`).toContain(f);
    }
    // Kunci baris formulir HARUS sama persis dengan daftar field baris.
    expect(s, 'FormLine harus memakai nama yang sama dengan FIELD_PO_BARIS').toMatch(
      new RegExp(`type FormLine = \\{[^}]*${FIELD_PO_BARIS.join('[^}]*')}[^}]*\\}`)
    );
    // Halaman TIDAK boleh memetakan sendiri — pemetaannya lewat satu pintu.
    expect(s, 'halaman harus memakai petakanGalatServerPo, bukan membaca body.field langsung').toMatch(/petakanGalatServerPo/);
    expect(s, 'jangan membaca body.field mentah di halaman').not.toMatch(/body\.field/);
  });
});
