import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { tanpaKomentar } from './util/tanpaKomentar';

// ============================================================================
// DS-09 (revisi) — DETAIL BARIS YANG DIMEKARKAN DI /items
// ============================================================================
// Tiga hal yang diminta pemilik produk setelah meninjau /items secara visual, dan yang
// TIDAK boleh diam-diam kembali seperti semula:
//
//   1. Detailnya berkisi 3 kolom di desktop, 2 di tablet, 1 di ponsel.
//      Sebelumnya satu kolom label|nilai bertumpuk — diukur di peramban, panelnya
//      setinggi 1503px di 1440px dan 1956px di 360px.
//
//   2. Panelnya berlatar lapisan TERANG yang MENETAP, bukan lapisan hover.
//      Sebelumnya latarnya transparan saat diam dan #e8e8e8 ($layer-hover) begitu kursor
//      menyentuhnya — dan karena panelnya setinggi ~1500px, kursor pembacanya hampir
//      selalu di atasnya, sehingga "sementara" itu jadi menetap.
//
//   3. Aksi merusak berjauhan dari aksi biasa DI SEMUA LEBAR.
//      Sebelumnya `margin-inline-start: auto` hanya berlaku mulai 42rem, sehingga di 360px
//      jarak Ubah↔Hapus HANYA 8px — justru di layar tempat jari paling besar.
//
// ============================================================================
// KENAPA UJI INI MEMBACA SCSS, BUKAN MERENDER HALAMAN
// ============================================================================
// Repository ini TIDAK punya infrastruktur uji berbasis peramban sama sekali — nol
// playwright/jsdom di tests/, dan vitest berjalan tanpa environment DOM. Menambahkannya
// adalah pekerjaan tersendiri dengan cakupannya sendiri, bukan bagian revisi ini.
//
// Jadi yang diuji di sini adalah ATURAN YANG MENGHASILKAN perilaku itu, di tingkat tertinggi
// yang benar-benar tersedia. Bukti perilakunya sendiri diambil dengan mengukur di peramban
// dan dilaporkan terpisah — dan uji ini menjaga supaya aturannya tidak dicabut diam-diam.
// ============================================================================

const SCSS = 'app/(shell)/items/items.scss';
const HALAMAN = 'src/features/mrp/pages/ItemsPage.tsx';

/// Mengambil isi satu blok aturan CSS teratas berdasarkan pemilihnya.
function blok(isi: string, pemilih: string): string | null {
  const i = isi.indexOf(pemilih + ' {');
  if (i === -1) return null;
  const j = isi.indexOf('}', i);
  return j === -1 ? null : isi.slice(i, j);
}

describe('DS-09 — detail baris yang dimekarkan di /items', () => {
  const scss = readFileSync(SCSS, 'utf8');
  const scssBersih = tanpaKomentar(scss);

  it('(a) kisi detail: 1 kolom bawaan, 2 kolom di 42rem, 3 kolom di 82rem', () => {
    const dasar = blok(scssBersih, '.item-detail__daftar');
    expect(dasar, 'blok .item-detail__daftar tidak ditemukan').not.toBeNull();
    expect(dasar!).toMatch(/display:\s*grid/);
    expect(dasar!, 'ponsel harus satu kolom').toMatch(/grid-template-columns:\s*1fr/);

    // Dua breakpoint yang SUDAH dipakai repo ini (42rem = Carbon md, 66rem = Carbon lg),
    // bukan angka baru. Bila kelak breakpoint-nya berubah, uji ini ikut menahannya.
    const media42 = scssBersih.match(/@media \(min-width: 42rem\) \{[\s\S]*?\n\}/g) || [];
    const media82 = scssBersih.match(/@media \(min-width: 82rem\) \{[\s\S]*?\n\}/g) || [];
    const punya = (blokMedia: string[], kolom: number) =>
      blokMedia.some((b) => b.includes('.item-detail__daftar') && new RegExp(`repeat\\(${kolom},`).test(b));

    expect(punya(media42, 2), 'di 42rem (tablet) kisi detail harus 2 kolom').toBe(true);
    // 82rem (xlg Carbon), BUKAN 66rem: diukur di peramban, pada 66rem sel detail jatuh dari
    // 444px ke 225px karena navigasi samping terbuka di ambang yang sama. 66rem juga bukan
    // salah satu dari enam lebar wajib, jadi titik perubahan itu tak pernah difoto.
    expect(punya(media82, 3), 'di 82rem (desktop besar) kisi detail harus 3 kolom').toBe(true);
  });

  it('(b) sel kisi tidak boleh melebar mengikuti isinya', () => {
    // Tanpa minmax(0, 1fr) dan min-inline-size: 0, satu nilai panjang mendorong kolom lain
    // menyempit dan kisinya berhenti seragam — persis kelas cacat yang membuat kolom
    // terpotong diam-diam di proyek ini.
    const sel = blok(scssBersih, '.item-detail__baris');
    expect(sel!).toMatch(/min-inline-size:\s*0/);
    expect(scssBersih).toMatch(/repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(scssBersih).toMatch(/repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  });

  it('(c) panel detail memakai lapisan TERANG yang menetap, bukan lapisan hover', () => {
    const detail = blok(scssBersih, '.item-detail');
    expect(detail!, 'panel detail harus punya latar sendiri').toMatch(/background-color:\s*theme\.\$layer-02/);
    // $layer-hover tidak boleh dipakai sebagai latar menetap di mana pun pada berkas ini.
    expect(scssBersih).not.toMatch(/background-color:\s*theme\.\$layer-hover/);
  });

  it('(d) hover Carbon pada baris ANAK ditimpa, hover baris INDUK dibiarkan', () => {
    // Carbon memberi $layer-hover ke baris anak lewat TIGA jalur (dibaca dari paket
    // terpasang). Ketiganya harus ditimpa, kalau tidak panelnya tetap berkedip.
    expect(scssBersih).toMatch(/tr\[data-child-row\] td/);
    expect(scssBersih, 'jalur hover dari baris induk harus ikut ditimpa')
      .toMatch(/cds--parent-row\.cds--expandable-row:hover \+ tr\[data-child-row\] td/);
    expect(scssBersih, 'jalur hover baris anak sendiri harus ikut ditimpa')
      .toMatch(/cds--expandable-row--hover \+ tr\[data-child-row\] td/);
    // Baris INDUK tidak boleh ikut ditimpa: umpan balik hover di situ benar dan berguna.
    expect(scssBersih).not.toMatch(/tr\.cds--parent-row[^,{]*\{[^}]*background-color/);
  });

  it('(e) aksi merusak berjauhan dari aksi biasa DI SEMUA LEBAR', () => {
    const aksi = blok(scssBersih, '.item-detail__aksi');
    expect(aksi!, 'aksi tidak boleh membungkus — di sel sempit membungkus berarti menempel')
      .toMatch(/flex-wrap:\s*nowrap/);
    expect(aksi!, 'jarak DASAR wajib ada, bukan hanya margin auto').toMatch(/gap:\s*spacing\.\$spacing-07/);

    // Yang paling penting: `margin-inline-start: auto` TIDAK boleh lagi terkurung di dalam
    // media query. Di 360px itulah yang membuat jaraknya cuma 8px.
    const hapus = blok(scssBersih, '.item-detail__hapus');
    expect(hapus!, 'blok .item-detail__hapus harus ada di tingkat atas').toMatch(/margin-inline-start:\s*auto/);
    const dalamMedia = (scssBersih.match(/@media[^{]*\{[\s\S]*?\n\}/g) || []).some((b) =>
      b.includes('.item-detail__hapus')
    );
    expect(dalamMedia, '.item-detail__hapus tidak boleh hanya berlaku di dalam media query').toBe(false);
  });

  it('(f) Ubah tetap tertiary, Hapus memakai danger--ghost dan tetap berlabel teks', () => {
    const tsx = tanpaKomentar(readFileSync(HALAMAN, 'utf8'));
    expect(tsx, 'Ubah harus Carbon tertiary').toMatch(/kind="tertiary"[^>]*onClick=\{\(\) => startEdit\(item\)\}/);
    expect(tsx, 'Hapus harus Carbon danger--ghost').toMatch(/kind="danger--ghost"[^>]*className="item-detail__hapus"/);
    // Label teks WAJIB tetap ada — bukan tombol ikon saja.
    expect(tsx).toMatch(/className="item-detail__hapus"[\s\S]{0,220}Hapus/);
    // Dan penghapusan tetap lewat modal berbahaya Carbon, bukan kotak peramban.
    expect((tsx.match(/window\.confirm\s*\(/g) || []).length).toBe(0);
  });
});

describe('DS-09 — formulir Dokumen di dalam panel detail /items', () => {
  const scss = tanpaKomentar(readFileSync(SCSS, 'utf8'));
  const tsx = tanpaKomentar(readFileSync(HALAMAN, 'utf8'));

  it('(g) kisi formulir: 1 kolom bawaan, 2 kolom mulai 42rem', () => {
    const dasar = blok(scss, '.item-kisi');
    expect(dasar, 'blok .item-kisi tidak ditemukan').not.toBeNull();
    expect(dasar!).toMatch(/display:\s*grid/);
    expect(dasar!, 'ponsel harus satu kolom').toMatch(/grid-template-columns:\s*1fr/);

    const media42 = scss.match(/@media \(min-width: 42rem\) \{[\s\S]*?\n\}/g) || [];
    const duaKolom = media42.some(
      (b) => b.includes('.item-kisi') && /repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(b)
    );
    expect(duaKolom, 'di 42rem formulir Dokumen harus 2 kolom').toBe(true);
  });

  it('(h) lebar field dibatasi — isian pendek tidak boleh selebar layar', () => {
    // Diukur sebelum diperbaiki: satu field terentang 1016px di 1440px dan 1496px di 1920px.
    // Batas lebar inilah yang menahannya; tanpa itu dua kolom pun masih memberi ~740px.
    const media42 = scss.match(/@media \(min-width: 42rem\) \{[\s\S]*?\n\}/g) || [];
    const dibatasi = media42.some((b) => b.includes('.item-kisi') && /max-inline-size:/.test(b));
    expect(dibatasi, '.item-kisi wajib punya batas lebar di layar lega').toBe(true);
  });

  it('(i) aturan SATU KOLOM milik DS-18 tetap berlaku untuk modal', () => {
    // DS-18 menetapkan formulir MODAL satu kolom, dengan kutipan Carbon tentang modal.
    // `.item-kisi` dikeluarkan dari aturan itu karena ia tidak pernah dipakai di modal --
    // tapi `.item-form`, yang MEMANG modal, tidak boleh ikut berubah.
    const form = blok(scss, '.item-form');
    expect(form, 'blok .item-form tidak ditemukan').not.toBeNull();
    expect(form!, 'formulir modal harus tetap satu kolom (flex column)').toMatch(/flex-direction:\s*column/);
    expect(form!, 'formulir modal tidak boleh jadi kisi berkolom').not.toMatch(/grid-template-columns:\s*repeat/);
  });

  it('(j) hanya SATU tombol primary di blok lampiran', () => {
    // Diukur sebelum diperbaiki: "Pilih berkas" DAN "Unggah dokumen" dua-duanya primary.
    // Perbaikannya lewat properti Carbon sendiri, bukan penimpaan CSS: FileUploader
    // meneruskan buttonKind ke FileUploaderButton (bawaannya "primary").
    expect(tsx, 'FileUploader harus menurunkan tombolnya jadi tertiary').toMatch(/buttonKind="tertiary"/);
    // Tombol unggah tetap aksi utama: tanpa kind eksplisit, Carbon memberinya primary.
    expect(tsx).toMatch(/Unggah dokumen/);
  });

  it('(k) memilih berkas dan mengunggah hidup di SATU blok', () => {
    expect(scss, 'kelas blok berkas harus ada').toMatch(/\.item-lampir__berkas/);
    const iBlok = tsx.indexOf('item-lampir__berkas');
    const iUploader = tsx.indexOf('<FileUploader');
    const iAksi = tsx.indexOf('item-lampir__aksi');
    expect(iBlok, 'blok berkas tidak ditemukan di halaman').toBeGreaterThan(-1);
    expect(iUploader, 'FileUploader harus berada DI DALAM blok berkas').toBeGreaterThan(iBlok);
    expect(iAksi, 'aksi unggah harus berada DI DALAM blok berkas').toBeGreaterThan(iUploader);
  });

  it('(l) perilaku unggah TIDAK berubah — tombol tidak dimatikan oleh ketiadaan berkas', () => {
    // handleUploadItemDoc sudah memeriksa dan menjawab "Pilih berkas dokumennya dulu.".
    // Mematikan tombolnya akan MENGHILANGKAN kalimat itu -- mengubah perilaku, bukan
    // hanya tampilan. Penjaga ini menahan perubahan itu terjadi diam-diam.
    expect(tsx, 'pemeriksaan berkas di handler wajib tetap ada').toMatch(/if \(!docFile\)/);
    expect(tsx).toMatch(/Pilih berkas dokumennya dulu/);
    // Satu-satunya alasan tombol dimatikan adalah proses unggah yang sedang berjalan.
    expect(tsx).toMatch(/disabled=\{docStatus === 'uploading'\}/);
    expect(tsx, 'tombol tidak boleh dimatikan hanya karena berkas belum dipilih').not.toMatch(/disabled=\{!docFile/);
  });
});
