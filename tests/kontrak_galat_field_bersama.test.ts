// T-V5 — KONTRAK GALAT FIELD BERSAMA, dibuktikan lewat modul KEDUA.
//
// ============================================================================
// APA YANG SEBENARNYA DIUJI DI SINI
// ============================================================================
// Bukan "apakah penyesuaian stok punya invalidText". Yang diuji: apakah SATU mekanisme
// pemetaan bisa melayani dua modul yang bentuknya BERBEDA, tanpa disalin.
//
// Kedua modul sengaja tidak mirip:
//   PO ke supplier   -> modal, PUNYA baris berulang, field baris memakai `line`
//   Penyesuaian stok -> bukan modal, NOL baris berulang, punya field BERSYARAT
//                       (`notes` hanya wajib bila alasannya "Lainnya")
// Kalau satu kontrak melayani keduanya tanpa cabang khusus, ia terbukti sebagai pola.
// Kalau butuh cabang khusus, ia belum terbukti dan tidak boleh dipakai untuk 58 modul.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tanpaKomentar } from './util/tanpaKomentar';
import { buatKontrakGalatField } from '../src/lib/kontrakGalatField';
import {
  FIELD_PENYESUAIAN,
  galatFieldPenyesuaian,
  petakanGalatPenyesuaian
} from '../src/features/mrp/server/recordStockAdjustment';

describe('T-V5 — kontrak bersama, modul kedua: penyesuaian stok', () => {
  it('(a) field yang SAH dipetakan ke kontrolnya', () => {
    for (const field of FIELD_PENYESUAIAN) {
      const hasil = petakanGalatPenyesuaian({ error: 'Pesan uji.', field }, 0);
      expect(hasil, `${field} harus dipetakan`).toEqual({ jenis: 'field', field, line: undefined, pesan: 'Pesan uji.' });
    }
  });

  it('(b) nama yang SALAH KETIK tidak boleh menghilangkan galatnya', () => {
    for (const field of ['lot_idd', 'qty_delta_', 'reason', 'note']) {
      const hasil = petakanGalatPenyesuaian({ error: 'Pesan asli.', field }, 0);
      expect(hasil.jenis, `"${field}" salah ketik -> wajib naik ke tingkat formulir`).toBe('formulir');
      expect(hasil.pesan).toBe('Pesan asli.');
    }
  });

  it('(c) nama yang TIDAK DIKENAL tidak boleh menghilangkan galatnya', () => {
    for (const field of ['does_not_exist', 'supplier_id', '', 'LOT_ID']) {
      const hasil = petakanGalatPenyesuaian({ error: 'Pesan asli.', field }, 0);
      expect(hasil.jenis, `"${field}" bukan milik modul ini`).toBe('formulir');
      expect(hasil.pesan).toBe('Pesan asli.');
    }
  });

  it('(d) SETIAP nama di registri benar-benar punya kontrol di layar', () => {
    // Ini kelas cacat TERSENDIRI, dan berbeda dari salah ketik: nama boleh saja ada di
    // registri, lolos pemeriksaan runtime, lalu ditandai pada kontrol yang TIDAK ADA —
    // dan galatnya hilang persis seperti kalau namanya salah. Registri karena itu harus
    // mencerminkan apa yang benar-benar bisa dilihat pengguna.
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/warehouse/pages/WarehouseDashboardPage.tsx'), 'utf8'));
    for (const field of FIELD_PENYESUAIAN) {
      expect(s, `registri memuat "${field}" tetapi layar tidak pernah menandainya`).toMatch(
        new RegExp(`galatPenyesuaian\\('${field}'\\)`)
      );
    }
  });

  it('(e) galat BISNIS tetap di tingkat formulir, tidak dipaksa jadi galat field', () => {
    for (const pesan of [
      'Role Anda tidak punya izin melakukan penyesuaian stok manual.',
      'User belum terkait dengan perusahaan yang valid.',
      'Lot ini berstatus tidak tersedia (bukan available) — tidak bisa disesuaikan.'
    ]) {
      const hasil = petakanGalatPenyesuaian({ error: pesan }, 0);
      expect(hasil).toEqual({ jenis: 'formulir', pesan });
    }
  });

  it('(f) beberapa galat field tetap terlihat bersamaan di layar', () => {
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/warehouse/pages/WarehouseDashboardPage.tsx'), 'utf8'));
    // Daftar, bukan satu nilai — sama seperti pilot PO.
    expect(s).toMatch(/galatFieldPenyesuaian|penyesuaianFieldError/);
    expect(s, 'penampung galat field wajib berupa daftar').toMatch(/penyesuaianFieldError,\s*setPenyesuaianFieldError\]\s*=\s*useState<[^>]*\[\]>/);
    expect(s, 'notifikasi formulir digerbang saat sudah ada galat field').toMatch(/penyesuaianFieldError\.length === 0/);
  });

  it('(g) modul TANPA baris berulang menolak line, apa pun nilainya', () => {
    // Penyesuaian stok tidak punya baris. `line` karena itu TIDAK PERNAH bermakna, dan
    // kontrak yang sama harus menanganinya tanpa cabang khusus di modul ini.
    for (const line of [0, 1, 99, -1]) {
      const hasil = petakanGalatPenyesuaian({ error: 'Pesan uji.', field: 'qty_delta', line }, 0);
      expect(hasil, `line=${line} tidak bermakna di modul tanpa baris`).toEqual({
        jenis: 'field', field: 'qty_delta', line: undefined, pesan: 'Pesan uji.'
      });
    }
  });

  it('(h) pembangun bertipe menolak nama di luar registri saat KOMPILASI', () => {
    // Perilaku runtime-nya diuji di sini; penolakan saat kompilasi dibuktikan lewat mutasi
    // yang dicatat di dokumen (TS2345), karena kode yang tidak bisa dikompilasi tidak bisa
    // dijalankan sebagai test.
    expect(galatFieldPenyesuaian('Lot wajib dipilih.', 'lot_id')).toEqual({
      error: 'Lot wajib dipilih.',
      field: 'lot_id'
    });
  });

  it('(l) field BERSYARAT: mengganti alasan mencabut tanda pada catatan', () => {
    // Ini yang membedakan modul kedua dari pilot PO, dan sebabnya ia dipilih: `notes` hanya
    // WAJIB saat alasannya "Lainnya". Mengganti alasan membuat kewajibannya lenyap — tandanya
    // harus ikut lenyap, kalau tidak ia menyala pada isian yang sudah tidak wajib lagi dan
    // tidak bisa diperbaiki dengan cara apa pun (§5.4).
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/warehouse/pages/WarehouseDashboardPage.tsx'), 'utf8'));
    expect(s, 'mengganti reason_code wajib ikut mencabut tanda pada notes').toMatch(
      /field === 'reason_code' && g\.field === 'notes'/
    );
    // Dan seluruh isian lewat pintu yang sama, bukan setAdjustmentForm langsung.
    for (const f of ['lot_id', 'qty_delta', 'reason_code', 'notes']) {
      expect(s, `${f} harus lewat pintu ubahFieldPenyesuaian`).toMatch(new RegExp(`ubahFieldPenyesuaian\\('${f}'`));
    }
  });

  it('(i) kontrak bersama TIDAK punya cabang khusus per modul', () => {
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/lib/kontrakGalatField.ts'), 'utf8'));
    for (const bocor of ['supplier_id', 'lot_id', 'purchase', 'penyesuaian', 'PurchaseOrder', 'StockAdjustment']) {
      expect(s, `kontrak bersama menyebut "${bocor}" — itu berarti ia tahu modul tertentu`).not.toContain(bocor);
    }
  });

  it('(j) kedua modul memakai PINTU yang sama, bukan salinannya', () => {
    const po = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/server/purchaseOrderValidation.ts'), 'utf8'));
    const stok = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/server/recordStockAdjustment.ts'), 'utf8'));
    for (const [nama, isi] of [['PO', po], ['penyesuaian stok', stok]] as const) {
      expect(isi, `${nama} harus memakai pabrik kontrak bersama`).toMatch(/buatKontrakGalatField/);
      expect(isi, `${nama} tidak boleh menyalin logika pemetaannya sendiri`).not.toMatch(/jenis:\s*'formulir'/);
    }
  });

  it('(k) pabrik kontrak melayani DUA bentuk registri tanpa perlakuan khusus', () => {
    const denganBaris = buatKontrakGalatField(['a'] as const, ['b'] as const);
    const tanpaBaris = buatKontrakGalatField(['a'] as const, [] as const);
    expect(denganBaris.petakan({ error: 'x', field: 'b', line: 0 }, 1)).toEqual({ jenis: 'field', field: 'b', line: 0, pesan: 'x' });
    expect(denganBaris.petakan({ error: 'x', field: 'b', line: 5 }, 1)).toEqual({ jenis: 'formulir', pesan: 'x' });
    expect(tanpaBaris.petakan({ error: 'x', field: 'a', line: 0 }, 0)).toEqual({ jenis: 'field', field: 'a', line: undefined, pesan: 'x' });
    expect(tanpaBaris.petakan({ error: 'x', field: 'b' }, 0)).toEqual({ jenis: 'formulir', pesan: 'x' });
  });
});
