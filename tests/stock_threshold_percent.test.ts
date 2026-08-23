import { describe, it, expect } from 'vitest';
import { nilaiStok, hitungAmbang, perluPeringatan } from '../src/features/mrp/stockThreshold';

// MST-19. Yang dijaga: ARTI ambang stok, bukan tampilannya.
//
// Keputusan pemilik produk: persen dihitung dari JUMLAH YANG PERNAH MASUK, bukan dari
// stok saat ini. Test pertama di bawah adalah yang membuktikan kenapa itu penting.

const dasar = { minStockPercent: null as number | null, minStockLevel: null as number | null };

describe('Ambang stok minimum berbasis persen (MST-19)', () => {
  it('ambang TIDAK ikut turun saat stok turun — inti keputusan pemilik produk', () => {
    // Persen dari JUMLAH YANG PERNAH MASUK: ambang tetap 100 walau stok tinggal 20.
    const a = hitungAmbang({ ...dasar, stokSekarang: 1000, totalPernahMasuk: 1000, minStockPercent: 10 });
    const b = hitungAmbang({ ...dasar, stokSekarang: 20, totalPernahMasuk: 1000, minStockPercent: 10 });
    expect(a).toBe(100);
    expect(b).toBe(100);

    // Bandingkan dengan cara yang DITOLAK (persen dari stok saat ini): ambangnya akan
    // jadi 2 saat stok tinggal 20 -- sehingga stok 20 dianggap "aman" padahal nyaris habis.
    const ambangSalah = (20 * 10) / 100;
    expect(ambangSalah).toBe(2);
    expect(nilaiStok({ ...dasar, stokSekarang: 20, totalPernahMasuk: 1000, minStockPercent: 10 }).status).toBe('menipis');
  });

  it('MEMBEDAKAN "belum pernah masuk" dari "stok habis" — keduanya nol, artinya berbeda', () => {
    const belum = nilaiStok({ ...dasar, stokSekarang: 0, totalPernahMasuk: 0, minStockPercent: 10 });
    const habis = nilaiStok({ ...dasar, stokSekarang: 0, totalPernahMasuk: 500, minStockPercent: 10 });

    expect(belum.status).toBe('belum_pernah_masuk');
    expect(habis.status).toBe('habis');
    expect(belum.keterangan).not.toBe(habis.keterangan);
  });

  it('"belum pernah masuk" TIDAK memicu peringatan; "habis" memicu', () => {
    // Peringatan yang berbunyi untuk hal yang bukan masalah adalah cara tercepat membuat
    // orang berhenti membaca peringatan.
    expect(perluPeringatan(nilaiStok({ ...dasar, stokSekarang: 0, totalPernahMasuk: 0, minStockPercent: 10 }))).toBe(false);
    expect(perluPeringatan(nilaiStok({ ...dasar, stokSekarang: 0, totalPernahMasuk: 500, minStockPercent: 10 }))).toBe(true);
  });

  it('tanpa ambang apa pun: tidak dinilai, dan TIDAK memicu peringatan palsu', () => {
    const p = nilaiStok({ ...dasar, stokSekarang: 5, totalPernahMasuk: 100 });
    expect(p.status).toBe('tanpa_ambang');
    expect(p.ambang).toBeNull();
    expect(perluPeringatan(p)).toBe(false);
  });

  it('persen MENANG atas angka mutlak bila keduanya terisi', () => {
    // Aturan "mana yang menang" hidup di SATU tempat, tidak disebar ke tiap pemanggil.
    expect(hitungAmbang({ stokSekarang: 0, totalPernahMasuk: 1000, minStockPercent: 5, minStockLevel: 900 })).toBe(50);
  });

  it('angka mutlak lama tetap dipakai bila persen belum diisi', () => {
    // Item lama tidak boleh kehilangan ambangnya dalam semalam.
    const p = nilaiStok({ stokSekarang: 40, totalPernahMasuk: 1000, minStockPercent: null, minStockLevel: 50 });
    expect(p.ambang).toBe(50);
    expect(p.status).toBe('menipis');
  });

  it('stok tepat DI ambang dihitung aman, bukan menipis', () => {
    const p = nilaiStok({ ...dasar, stokSekarang: 100, totalPernahMasuk: 1000, minStockPercent: 10 });
    expect(p.status).toBe('aman');
  });

  it('persen nol atau negatif diperlakukan seperti tidak diisi', () => {
    expect(hitungAmbang({ stokSekarang: 0, totalPernahMasuk: 1000, minStockPercent: 0, minStockLevel: null })).toBeNull();
    expect(hitungAmbang({ stokSekarang: 0, totalPernahMasuk: 1000, minStockPercent: -5, minStockLevel: null })).toBeNull();
  });
});
