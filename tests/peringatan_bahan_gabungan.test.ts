import { describe, it, expect } from 'vitest';
import { susunPeringatanBahan } from '../src/features/mrp/alasanPeringatanBahan';
import { nilaiStok } from '../src/features/mrp/stockThreshold';

// GDG-10 / KK.1 — SATU peringatan per bahan, sebabnya disebutkan di dalamnya.
//
// Yang dijaga di sini adalah ARTI dan ISI kalimatnya, bukan tampilannya: bahan mana yang
// masuk peringatan, sebab mana yang ikut disebut, dan kapan keadaan bertentangan ditandai.

const dasarStok = { minStockPercent: null as number | null, minStockLevel: null as number | null, persenBawaanPerusahaan: null as number | null };

describe('Peringatan bahan gabungan (GDG-10)', () => {
  it('DUA sebab menyala sekaligus -> keduanya disebut dalam SATU kalimat', () => {
    const stok = nilaiStok({ ...dasarStok, stokSekarang: 80, totalPernahMasuk: 1000, minStockPercent: 20 });
    const p = susunPeringatanBahan({
      namaBahan: 'GULA RAFINASI',
      satuan: 'kg',
      stok,
      kebutuhan: { totalDibutuhkan: 120, tersedia: 80, jumlahWorkOrder: 3, perintah: ['BATCH-001', 'BATCH-002', 'BATCH-003'] }
    });

    expect(p.perlu).toBe(true);
    expect(p.sebabMenyala).toEqual(['stok_menipis', 'kurang_untuk_produksi']);
    // Inti keputusan pemilik produk: SELURUH sebab, bukan yang pertama saja.
    expect(p.pesan).toContain('di bawah ambang');
    expect(p.pesan).toContain('kurang 40 kg untuk 3 perintah produksi');
    // Perintah produksinya DISEBUT, bukan cuma dihitung (keputusan pemilik produk).
    expect(p.pesan).toContain('(BATCH-001, BATCH-002, BATCH-003)');
    expect(p.pesan).toContain(', DAN ');
    expect(p.keparahan).toBe('critical');
  });

  it('BAHAN YANG BELUM PERNAH DIBELI tidak pernah masuk peringatan ini', () => {
    // "Belum ada pembelian" dan "stok habis" sama-sama nol dan artinya berbeda jauh.
    const stok = nilaiStok({ ...dasarStok, stokSekarang: 0, totalPernahMasuk: 0, persenBawaanPerusahaan: 20 });
    const p = susunPeringatanBahan({ namaBahan: 'BAHAN BARU', satuan: 'kg', stok, kebutuhan: null });
    expect(p.perlu).toBe(false);
    expect(p.pesan).toBe('');
  });

  it('SEBAB YANG BERTENTANGAN ditandai di depan, bukan diselipkan di ekor kalimat', () => {
    // Stok menipis menurut persen, TAPI produksi yang berjalan masih tercukupi.
    const stok = nilaiStok({ ...dasarStok, stokSekarang: 150, totalPernahMasuk: 1000, minStockPercent: 20 });
    const p = susunPeringatanBahan({
      namaBahan: 'PEKTIN',
      satuan: 'kg',
      stok,
      kebutuhan: { totalDibutuhkan: 100, tersedia: 150, jumlahWorkOrder: 2, perintah: ['BATCH-010', 'BATCH-011'] }
    });

    expect(p.bertentangan).toBe(true);
    expect(p.pesan.startsWith('PEKTIN — PERIKSA DULU.')).toBe(true);
    expect(p.pesan).toContain('Masih cukup untuk seluruh produksi yang sedang berjalan.');
    // Menipis saja belum menghentikan pekerjaan siapa pun.
    expect(p.keparahan).toBe('warning');
  });

  it('bertentangan ARAH SEBALIKNYA: stok aman menurut ambang, tapi kurang untuk produksi', () => {
    const stok = nilaiStok({ ...dasarStok, stokSekarang: 900, totalPernahMasuk: 1000, minStockPercent: 20 });
    const p = susunPeringatanBahan({
      namaBahan: 'GELATIN',
      satuan: 'kg',
      stok,
      kebutuhan: { totalDibutuhkan: 1200, tersedia: 900, jumlahWorkOrder: 5, perintah: ['B1', 'B2', 'B3', 'B4', 'B5'] }
    });

    expect(p.perlu).toBe(true);
    expect(p.bertentangan).toBe(true);
    expect(p.sebabMenyala).toEqual(['kurang_untuk_produksi']);
    expect(p.pesan).toContain('Sisa stoknya sendiri masih di atas ambang.');
    expect(p.keparahan).toBe('critical');
  });

  it('kebutuhan produksi yang BELUM DIKETAHUI disebut apa adanya, tidak dianggap nol', () => {
    // Menganggapnya nol sama dengan mengklaim "produksi tidak membutuhkannya" -- klaim yang
    // tidak dimiliki siapa pun.
    const stok = nilaiStok({ ...dasarStok, stokSekarang: 80, totalPernahMasuk: 1000, minStockPercent: 20 });
    const p = susunPeringatanBahan({ namaBahan: 'ASAM SITRAT', satuan: 'kg', stok, kebutuhan: null });
    expect(p.perlu).toBe(true);
    expect(p.bertentangan).toBe(false);
    expect(p.pesan).toContain('Kebutuhan produksi belum bisa dihitung');
  });

  it('stok HABIS disebut apa adanya dan selalu critical', () => {
    const stok = nilaiStok({ ...dasarStok, stokSekarang: 0, totalPernahMasuk: 500, persenBawaanPerusahaan: 20 });
    const p = susunPeringatanBahan({ namaBahan: 'PERISA JERUK', satuan: 'kg', stok, kebutuhan: null });
    expect(p.sebabMenyala).toEqual(['stok_habis']);
    expect(p.keparahan).toBe('critical');
    expect(p.pesan).toContain('Stok HABIS');
  });

  it('tidak ada sebab yang menyala -> DIAM, bukan peringatan bernada tenang', () => {
    // Peringatan yang berbunyi untuk hal yang bukan masalah adalah cara tercepat membuat
    // orang berhenti membaca peringatan.
    const stok = nilaiStok({ ...dasarStok, stokSekarang: 900, totalPernahMasuk: 1000, minStockPercent: 20 });
    const p = susunPeringatanBahan({
      namaBahan: 'AIR RO',
      satuan: 'liter',
      stok,
      kebutuhan: { totalDibutuhkan: 100, tersedia: 900, jumlahWorkOrder: 1, perintah: ['B9'] }
    });
    expect(p.perlu).toBe(false);
    expect(p.pesan).toBe('');
  });

  it('bahan TANPA ambang sama sekali tidak dinilai dari sisi stok, tapi kekurangan produksi TETAP berbunyi', () => {
    // Dua sebab yang berdiri sendiri: tidak adanya ambang tidak boleh membungkam sebab lain.
    const stok = nilaiStok({ ...dasarStok, stokSekarang: 50, totalPernahMasuk: 1000 });
    expect(stok.status).toBe('tanpa_ambang');
    const p = susunPeringatanBahan({
      namaBahan: 'LESITIN',
      satuan: 'kg',
      stok,
      kebutuhan: { totalDibutuhkan: 200, tersedia: 50, jumlahWorkOrder: 4, perintah: ['B6', 'B7', 'B8', 'B9'] }
    });
    expect(p.perlu).toBe(true);
    expect(p.sebabMenyala).toEqual(['kurang_untuk_produksi']);
    expect(p.bertentangan).toBe(false);
  });

  it('lebih dari tiga perintah produksi: tiga disebut, sisanya dihitung', () => {
    const stok = nilaiStok({ ...dasarStok, stokSekarang: 900, totalPernahMasuk: 1000, minStockPercent: 20 });
    const p = susunPeringatanBahan({
      namaBahan: 'GELATIN',
      satuan: 'kg',
      stok,
      kebutuhan: { totalDibutuhkan: 1200, tersedia: 900, jumlahWorkOrder: 5, perintah: ['B1', 'B2', 'B3', 'B4', 'B5'] }
    });
    expect(p.pesan).toContain('(B1, B2, B3, dan 2 lagi)');
  });
});
