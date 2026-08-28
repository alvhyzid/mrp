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
import { parsePurchaseOrderInput } from '../src/features/mrp/server/purchaseOrderValidation';

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
