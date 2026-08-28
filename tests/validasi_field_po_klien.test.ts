// WS-01 / WS-03 — VALIDASI TINGKAT FIELD PADA PO KLIEN.
//
// ============================================================================
// KENAPA MODUL INI, DAN KENAPA SEKARANG
// ============================================================================
// PO klien adalah formulir TERBESAR di seluruh permukaan Sales: 21 kontrol, modal bertahap
// empat langkah, dan baris item berulang. Audit Sales mengukur NOL dari 44 kontrol form Sales
// punya galat tingkat field -- seluruh penolakan muncul sebagai satu kalimat di dasar modal,
// dan pada modal empat langkah kalimat itu bahkan bisa berada di langkah yang berbeda dari
// isian yang salah.
//
// Kontraknya TIDAK dibuat baru: src/lib/kontrakGalatField.ts sudah terbukti melayani dua
// modul yang bentuknya berbeda (PO supplier bermodal + berbaris, penyesuaian stok tanpa
// baris). Modul ini adalah pemakai KETIGA, dan ia menguji hal yang belum pernah diuji:
// apakah kontrak yang sama bekerja pada formulir BERTAHAP.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tanpaKomentar } from './util/tanpaKomentar';
import {
  parseCustomerPoInput,
  petakanGalatPoKlien,
  FIELD_PO_KLIEN,
  FIELD_PO_KLIEN_BARIS
} from '../src/features/mrp/server/customerPurchaseOrderValidation';

const barisSah = { item_id: 7, qty_ordered: 3, unit_price: 1000 };
const sah = { customer_id: 1, po_number: 'PO-001', payment_terms: 'full', lines: [barisSah] };

describe('WS-01 — galat PO klien menempel di isian yang salah', () => {
  it('(a) masukan sah tidak menghasilkan galat', () => {
    const h = parseCustomerPoInput({ ...sah });
    expect(h.error).toBeUndefined();
    expect(h.field).toBeUndefined();
    expect(h.input?.lines).toHaveLength(1);
  });

  it('(b) galat isian tingkat atas menyebut field-nya', () => {
    for (const [masukan, field] of [
      [{ ...sah, customer_id: 0 }, 'customer_id'],
      [{ ...sah, po_number: '  ' }, 'po_number'],
      [{ ...sah, payment_terms: 'cicilan' }, 'payment_terms']
    ] as const) {
      const h = parseCustomerPoInput(masukan as Record<string, unknown>);
      expect(h.error, `${field} seharusnya ditolak`).toBeTruthy();
      expect(h.field, `galat ${field} harus menyebut field-nya`).toBe(field);
      expect(h.line, `${field} bukan field baris`).toBeUndefined();
    }
  });

  it('(c) galat baris menyebut field DAN nomor barisnya', () => {
    for (const [baris, field, line] of [
      [[barisSah, { ...barisSah, item_id: 0 }], 'item_id', 1],
      [[barisSah, barisSah, { ...barisSah, qty_ordered: 0 }], 'qty_ordered', 2],
      [[{ ...barisSah, unit_price: -1 }], 'unit_price', 0]
    ] as const) {
      const h = parseCustomerPoInput({ ...sah, lines: [...baris] as unknown[] });
      expect(h.error).toBeTruthy();
      expect(h.field).toBe(field);
      expect(h.line, `harus menyebut baris ke-${line}, bukan "salah satu baris"`).toBe(line);
    }
  });

  it('(d) "PO harus punya minimal 1 baris" tetap TIDAK menyebut field', () => {
    // GOLONGAN B: penggunanya harus MENAMBAH baris, bukan memperbaiki isian yang terlihat.
    for (const lines of [[], undefined]) {
      const h = parseCustomerPoInput({ ...sah, lines });
      expect(h.error).toBe('PO harus punya minimal 1 baris item.');
      expect(h.field, 'galat tingkat formulir tidak boleh mengaku milik sebuah field').toBeUndefined();
    }
  });

  it('(e) kalimat pesannya TIDAK berubah — pemindahan dan penulisan ulang tidak dicampur', () => {
    expect(parseCustomerPoInput({ ...sah, customer_id: 0 }).error).toBe('Client tidak valid.');
    expect(parseCustomerPoInput({ ...sah, po_number: '' }).error).toBe('Nomor PO client wajib diisi.');
    expect(parseCustomerPoInput({ ...sah, payment_terms: 'x' }).error).toBe('Syarat pembayaran tidak valid.');
    expect(parseCustomerPoInput({ ...sah, lines: [{ ...barisSah, qty_ordered: 0 }] }).error)
      .toBe('Jumlah dipesan harus berupa angka lebih besar dari 0.');
  });

  it('(f) nama yang salah ketik atau tak dikenal TIDAK boleh menghilangkan galatnya', () => {
    for (const field of ['customer', 'po_numberr', 'quantity', '', 'CUSTOMER_ID']) {
      const h = petakanGalatPoKlien({ error: 'Pesan asli dari server.', field }, 1);
      expect(h.jenis, `"${field}" tidak dikenal -> naik ke tingkat formulir`).toBe('formulir');
      expect(h.pesan, 'kalimat aslinya WAJIB dipertahankan').toBe('Pesan asli dari server.');
    }
  });

  it('(g) line di luar jangkauan tidak boleh menandai baris yang salah', () => {
    for (const line of [1, 9, -1, 1.5, undefined]) {
      const h = petakanGalatPoKlien({ error: 'Item tidak valid.', field: 'item_id', line }, 1);
      expect(h.jenis, `line=${String(line)} tidak sah untuk 1 baris`).toBe('formulir');
    }
    expect(petakanGalatPoKlien({ error: 'Item tidak valid.', field: 'item_id', line: 0 }, 1))
      .toEqual({ jenis: 'field', field: 'item_id', line: 0, pesan: 'Item tidak valid.' });
  });

  it('(h) SETIAP nama di registri benar-benar punya kontrol di layar', () => {
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/pages/CustomerPurchaseOrdersPage.tsx'), 'utf8'));
    // Versi pertama penjaga ini hanya mencari `galatPoKlien('x')` — dan itu TERLALU LONGGAR:
    // mencabut `invalidText` sambil membiarkan `invalid` tetap membuatnya HIJAU, padahal
    // kontrolnya menyala merah TANPA menjelaskan apa yang salah. Diperketat: KEDUA properti
    // wajib ada, karena `invalid` tanpa `invalidText` adalah tanda tanpa pesan.
    for (const f of FIELD_PO_KLIEN) {
      expect(s, `"${f}" tidak ditandai invalid di layar`).toMatch(new RegExp(`invalid=\\{Boolean\\(galatPoKlien\\('${f}'\\)\\)\\}`));
      expect(s, `"${f}" ditandai invalid TANPA pesan`).toMatch(new RegExp(`invalidText=\\{galatPoKlien\\('${f}'\\)`));
    }
    for (const f of FIELD_PO_KLIEN_BARIS) {
      expect(s, `"${f}" tidak ditandai invalid di baris`).toMatch(new RegExp(`invalid=\\{Boolean\\(galatPoKlien\\('${f}', index\\)\\)\\}`));
      expect(s, `"${f}" ditandai invalid TANPA pesan`).toMatch(new RegExp(`invalidText=\\{galatPoKlien\\('${f}', index\\)`));
    }
  });

  it('(i) halaman memetakan lewat pintu bersama, bukan membaca body.field sendiri', () => {
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/pages/CustomerPurchaseOrdersPage.tsx'), 'utf8'));
    expect(s).toMatch(/petakanGalatPoKlien/);
    expect(s, 'jangan membaca body.field mentah di halaman').not.toMatch(/body\.field/);
    expect(s, 'jangan menulis aria-invalid sendiri — Carbon sudah memancarkannya').not.toMatch(/aria-invalid=/);
    expect(s, 'notifikasi formulir digerbang saat sudah ada galat field').toMatch(/poFieldError\.length === 0/);
  });

  it('(k) galat pada isian di langkah lain memindahkan modal ke langkah itu', () => {
    // DITEMUKAN LEWAT MENJALANKAN, bukan membaca: jawaban 409 untuk `po_number` (langkah 0)
    // dikirim saat modal berada di langkah 3. Kontrolnya ditandai dengan benar — tetapi
    // langkahnya sedang tersembunyi, jadi layar TIDAK MENAMPILKAN APA PUN, dan notifikasi
    // formulir ikut digerbang mati karena "sudah ada galat field".
    //
    // Ini kelas yang sama dengan field tak dikenal: galatnya bukan salah tempat, galatnya
    // HILANG. Bedanya, penyebabnya bukan nama yang salah melainkan langkah yang salah.
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/pages/CustomerPurchaseOrdersPage.tsx'), 'utf8'));
    expect(s, 'harus ada peta langkah per isian').toMatch(/LANGKAH_FIELD/);
    expect(s, 'pemetaan galat harus memindahkan langkah').toMatch(/setLangkah\(LANGKAH_FIELD\[terpetakan\.field\]\)/);
    // Peta itu wajib memuat SELURUH nama registri — nama yang tertinggal akan memindahkan
    // modal ke `undefined`.
    for (const f of [...FIELD_PO_KLIEN, ...FIELD_PO_KLIEN_BARIS]) {
      expect(s, `peta langkah tidak memuat "${f}"`).toMatch(new RegExp(`${f}:\\s*\\d`));
    }
  });

  it('(j) modul memakai pabrik kontrak bersama, bukan menyalin logikanya', () => {
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/server/customerPurchaseOrderValidation.ts'), 'utf8'));
    expect(s, 'harus memakai pabrik kontrak bersama').toMatch(/buatKontrakGalatField/);
    expect(s, 'tidak boleh menyalin logika pemetaannya sendiri').not.toMatch(/jenis:\s*'formulir'/);
  });
});
