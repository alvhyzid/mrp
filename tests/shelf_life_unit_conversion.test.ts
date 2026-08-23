import { describe, it, expect } from 'vitest';
import {
  shelfLifeToDays,
  daysToShelfLife,
  formatShelfLife,
  SHELF_LIFE_UNIT_DAYS,
  SHELF_LIFE_UNITS
} from '../src/features/mrp/shelfLife';

// MST-18. Yang dijaga di sini bukan tampilan, melainkan JAMINAN bahwa shelf life SELALU
// berakhir sebagai jumlah HARI di database — karena tanggal kedaluwarsa tiap lot dihitung
// dari angka itu, dan FEFO (yang lebih dulu kedaluwarsa, lebih dulu keluar) berdiri di
// atasnya. Usulan mengganti shelf life jadi kategori (Pendek/Menengah/Panjang) ditolak
// justru karena akan menghapus angka ini.

describe('Shelf life: angka + satuan, tersimpan dalam hari (MST-18)', () => {
  it('mengubah tiap satuan jadi hari', () => {
    expect(shelfLifeToDays(10, 'hari')).toBe(10);
    expect(shelfLifeToDays(2, 'minggu')).toBe(14);
    expect(shelfLifeToDays(6, 'bulan')).toBe(180);
    expect(shelfLifeToDays(2, 'tahun')).toBe(730);
  });

  it('menampilkan kembali angka YANG DIKETIK, bukan hasil konversinya', () => {
    // Tanpa ini, "6 bulan" muncul kembali sebagai "180 hari" saat diedit — pengguna
    // melihat angka yang bukan angka yang ia tulis dan mengira sistem mengubahnya.
    expect(daysToShelfLife(180)).toEqual({ nilai: '6', satuan: 'bulan' });
    expect(daysToShelfLife(14)).toEqual({ nilai: '2', satuan: 'minggu' });
    expect(daysToShelfLife(730)).toEqual({ nilai: '2', satuan: 'tahun' });
  });

  it('hanya memakai satuan yang membagi HABIS — sisa tetap ditampilkan sebagai hari', () => {
    // "6,67 bulan" bukan sesuatu yang pernah diketik siapa pun.
    expect(daysToShelfLife(200)).toEqual({ nilai: '200', satuan: 'hari' });
    expect(daysToShelfLife(45)).toEqual({ nilai: '45', satuan: 'hari' });
  });

  it('memilih satuan TERBESAR yang cocok', () => {
    // 365 habis dibagi hari DAN tahun; yang dipilih tahun, bukan hari.
    expect(daysToShelfLife(365)).toEqual({ nilai: '1', satuan: 'tahun' });
    // 90 habis dibagi minggu? tidak (90/7 bukan bulat) -- tapi habis dibagi bulan.
    expect(daysToShelfLife(90)).toEqual({ nilai: '3', satuan: 'bulan' });
  });

  it('bolak-balik TIDAK mengubah jumlah hari (jaminan utama untuk FEFO)', () => {
    for (const hari of [1, 7, 14, 30, 45, 90, 180, 200, 365, 730]) {
      const { nilai, satuan } = daysToShelfLife(hari);
      expect(shelfLifeToDays(Number(nilai), satuan)).toBe(hari);
    }
  });

  it('kosong / nol / negatif diperlakukan sebagai "tidak punya masa simpan"', () => {
    expect(daysToShelfLife(null)).toEqual({ nilai: '', satuan: 'hari' });
    expect(daysToShelfLife(0)).toEqual({ nilai: '', satuan: 'hari' });
    expect(daysToShelfLife(-5)).toEqual({ nilai: '', satuan: 'hari' });
    expect(formatShelfLife(null)).toBe('—');
  });

  it('teks tampilan TIDAK PERNAH menyembunyikan jumlah harinya', () => {
    // Angka hari itu yang dipakai FEFO; menyembunyikannya membuat pengguna tidak punya
    // cara memeriksa apakah sistem memahami maksudnya.
    expect(formatShelfLife(180)).toBe('6 bulan (180 hari)');
    expect(formatShelfLife(10)).toBe('10 hari');
  });

  it('tiap satuan yang ditawarkan punya faktor konversi — tidak ada yang menghasilkan NaN', () => {
    for (const u of SHELF_LIFE_UNITS) {
      expect(Number.isInteger(SHELF_LIFE_UNIT_DAYS[u])).toBe(true);
      expect(SHELF_LIFE_UNIT_DAYS[u]).toBeGreaterThan(0);
    }
    expect(SHELF_LIFE_UNITS).toHaveLength(Object.keys(SHELF_LIFE_UNIT_DAYS).length);
  });
});
