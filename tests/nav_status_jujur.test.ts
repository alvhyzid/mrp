import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { WORKSPACES, MENU_AKUN, ARTI_STATUS, type ItemNav } from '../src/features/navigasi/navConfig';

// NAV-01 / DS-04 (25 Agu 2026) — PENJAGA KEJUJURAN STATUS NAVIGASI.
//
// KENAPA PENJAGA INI ADA, dan kenapa ia yang paling penting di antara penjaga-penjaga DS:
//
// Navigasi ini SENGAJA menampilkan 102 item, sementara hanya 27 yang halamannya benar-benar
// ada. Keputusan itu sah — pemilik produk memilihnya supaya navigasinya jadi PETA apa yang
// akan dikerjakan. Tapi keputusan itu hanya bertahan selama penandanya JUJUR.
//
// Begitu satu item mengaku 'aktif' padahal halamannya tidak ada, seluruh penandanya kehilangan
// arti sekaligus: pengguna yang sekali tertipu berhenti mempercayai penanda mana pun, dan
// menu yang menampilkan 75 item "belum ada" berubah dari peta menjadi kebisingan.
//
// Doktrin proyek yang melahirkannya: STATUS YANG DIKETIK DARI INGATAN ADALAH STATUS YANG
// BERBOHONG. Di sini bohongnya mahal — orang melihat menu, mengira fiturnya ada, lalu
// berhenti mencari cara lain.
//
// DI LUAR JANGKAUAN: ini membandingkan status dengan KEBERADAAN route. Ia tidak bisa
// membuktikan halamannya berfungsi. Halaman yang ada tapi rusak akan lolos test ini —
// contohnya /company/setelan (AUD-35), yang route-nya ada tapi selalu mengalihkan ke login.
// Itu sebabnya statusnya ditulis 'sebagian', bukan 'aktif'.

const AKAR = join(__dirname, '..');

function ruteYangBenarBenarAda(): Set<string> {
  const hasil = new Set<string>();
  const telusuri = (dir: string) => {
    for (const nama of readdirSync(dir)) {
      const p = join(dir, nama);
      if (statSync(p).isDirectory()) {
        if (nama === 'api') continue;
        telusuri(p);
      } else if (nama === 'page.tsx') {
        const rel = dir.slice(join(AKAR, 'app').length);
        hasil.add(rel.replace(/\/\([^)]+\)/g, '') || '/');
      }
    }
  };
  telusuri(join(AKAR, 'app'));
  return hasil;
}

// MENU_AKUN ikut dijaga. Ia dipisahkan dari navigasi kiri hanya karena TEMPATNYA berbeda,
// bukan karena kejujurannya boleh lebih longgar — dan justru menu yang jarang dibuka lebih
// mudah menyimpan status basi tanpa ada yang menyadarinya.
const SEMUA_GRUP = [...WORKSPACES, ...MENU_AKUN];
const semuaItem: ItemNav[] = SEMUA_GRUP.flatMap((w) => w.items);

describe('NAV-01 — penanda status navigasi tidak boleh berbohong', () => {
  it('setiap href menunjuk halaman yang BENAR-BENAR ada di App Router', () => {
    const rute = ruteYangBenarBenarAda();
    const bohong = semuaItem
      .filter((i) => i.href && !rute.has(i.href))
      .map((i) => `${i.label} -> ${i.href}`);

    expect(
      bohong,
      `Item navigasi berikut menunjuk halaman yang TIDAK ADA:\n  ${bohong.join('\n  ')}\n` +
        'Menu yang diklik lalu menghasilkan halaman kosong lebih buruk daripada menu yang ' +
        'ditandai "belum ada". Hapus href-nya, atau bangun halamannya.'
    ).toEqual([]);
  });

  it('item ber-status aktif WAJIB punya href — status aktif tanpa halaman adalah kebohongan', () => {
    const bohong = semuaItem.filter((i) => i.status === 'aktif' && !i.href).map((i) => i.label);
    expect(
      bohong,
      `Item berikut mengaku 'aktif' tapi tidak punya halaman: ${bohong.join(', ')}`
    ).toEqual([]);
  });

  it('item TANPA href tidak boleh ber-status aktif, dan wajib punya arti yang bisa dibaca', () => {
    const salah: string[] = [];
    for (const i of semuaItem) {
      if (i.href) continue;
      if (i.status === 'aktif') salah.push(`${i.label}: aktif tanpa href`);
      const arti = ARTI_STATUS[i.status];
      if (!arti || !arti.singkat || !arti.panjang) salah.push(`${i.label}: status "${i.status}" tanpa penjelasan`);
    }
    expect(salah, salah.join('\n')).toEqual([]);
  });

  it('Sales Forecast ditandai DITOLAK, bukan "belum ada"', () => {
    // Perbedaan ini bukan tata bahasa. "Belum ada" berarti tunggu; "ditolak" berarti jangan
    // tunggu. Menampilkan hal yang sudah ditolak seolah direncanakan akan membuat seseorang
    // menunggu sesuatu yang tidak akan pernah datang -- dan keputusan penolakannya sudah
    // tercatat (SLS-90).
    const forecast = semuaItem.find((i) => i.label === 'Sales Forecast');
    expect(forecast, 'Item "Sales Forecast" hilang dari navigasi').toBeDefined();
    expect(forecast!.status).toBe('ditolak');
    expect(forecast!.href, 'Item yang ditolak tidak boleh bisa diklik').toBeUndefined();
  });

  it('tidak ada label ganda di dalam satu workspace', () => {
    const ganda: string[] = [];
    for (const w of SEMUA_GRUP) {
      const lihat = new Set<string>();
      for (const i of w.items) {
        if (lihat.has(i.label)) ganda.push(`${w.label} -> ${i.label}`);
        lihat.add(i.label);
      }
    }
    expect(ganda, ganda.join(', ')).toEqual([]);
  });

  it('mencetak ringkasan kejujuran, supaya angkanya terlihat tiap kali test jalan', () => {
    const hitung: Record<string, number> = {};
    for (const i of semuaItem) hitung[i.status] = (hitung[i.status] ?? 0) + 1;
    // Bukan assertion ketat pada angka -- angka ini MEMANG akan berubah seiring halaman
    // dibangun. Yang dijaga cuma satu: jangan sampai nol item aktif (berarti konfignya rusak).
    expect(hitung.aktif ?? 0).toBeGreaterThan(0);
    console.log(
      `  [NAV-01] ${semuaItem.length} item di ${WORKSPACES.length} workspace + ${MENU_AKUN.length} grup menu akun: ` +
        Object.entries(hitung)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')
    );
  });
});
