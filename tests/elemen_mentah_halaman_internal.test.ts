import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { tanpaKomentar, nomorBaris } from './util/tanpaKomentar';

// PENGAWAS ELEMEN MENTAH DI HALAMAN INTERNAL (DS-16, 26 Agu 2026).
//
// ============================================================================
// KENAPA PENGAWAS INI MENGALAHKAN SAPUAN — dan ini alasan ia didahulukan
// ============================================================================
// Sapuan menemukan cacat dengan MELIHAT. Pengawas menemukannya dengan MEMBACA. Bedanya baru
// terasa saat yang dicari TIDAK ADA DI LAYAR:
//
//   EMPAT dari tujuh tabel yang melewatkan kelas responsif berada DI DALAM BARIS YANG
//   DIMEKARKAN — BomsPage, CustomerPurchaseOrdersPage, RoutingsPage, ShipmentsPage.
//   Tabel itu tidak dirender sama sekali sampai seseorang mengklik baris untuk membukanya.
//
// Artinya TIDAK ADA sapuan visual jenis apa pun yang bisa melihatnya: bukan pembacaan
// halaman, bukan tangkapan layar, dan bukan pengukur dua tepi yang dibuat 26 Agu 2026 —
// ketiganya memotret halaman dalam keadaan TERTUTUP.
//
// Konsekuensinya lebih luas daripada tabel: apa pun yang tersembunyi sampai diklik (panel
// detail, modal, tab tidak aktif, saringan terlipat) punya lubang yang sama. Pengawas yang
// membaca berkas tidak punya lubang itu — ia melihat kode yang akan dirender, bukan piksel
// yang kebetulan sedang tampil.
//
// ============================================================================
// APA YANG DIJAGA
// ============================================================================
//   1. Elemen mentah di berkas halaman: <button> <input> <table> <select> <textarea>.
//      Komponen bersama sudah ada untuk kelimanya; menulis yang mentah berarti membuat jalur
//      hidup kedua yang TIDAK ikut berubah saat komponen bersamanya diperbaiki.
//   2. <Table> Carbon yang TIDAK memakai kelas .tabel-responsif. Tanpa kelas itu, tabelnya
//      tetap berbentuk tabel di layar sempit dan kolom terakhir — hampir selalu "Aksi" —
//      jatuh ke luar layar TANPA gulir yang bisa menjangkaunya.
//
// ============================================================================
// APA YANG TIDAK DIJAGA — batasnya disebut supaya tidak dikira lebih kuat
// ============================================================================
//   - Ini pencocokan teks, bukan parser JSX. Ia tahu membedakan kode dari komentar (lewat
//     pembantu bersama tests/util/tanpaKomentar.ts) dan tidak lebih dari itu.
//   - Ia HANYA menyisir src/features/**/pages/*.tsx. Komponen bersama di src/components/ui
//     SENGAJA tidak disisir: di situlah <button> mentah memang seharusnya hidup, karena
//     komponen bersamanya sendiri harus dibangun dari sesuatu. Utangnya dicatat terpisah —
//     provenance-info-button.tsx menulis <button> ber-Tailwind tulis tangan, bukan memakai
//     komponen Button bersama.
//   - Ia tidak tahu apakah sebuah tabel PANTAS jadi kartu. Ia hanya tahu kelasnya dipasang
//     atau tidak; yang tidak pantas wajib memakai penanda pengecualian di bawah.

const AKAR = join(__dirname, '..');
const DIR_FITUR = join(AKAR, 'src', 'features');

const TAG_MENTAH = ['button', 'input', 'table', 'select', 'textarea'] as const;

// PENANDA PENGECUALIAN, mengikuti pola DS-11 yang sudah terbukti: pengecualian dikunci ke
// KOMENTAR DI DALAM BERKASNYA, bukan ke nomor baris. Dengan begitu ia ikut berpindah saat
// kodenya disunting, dan tidak bisa menggeser diam-diam ke baris yang salah.
//
// PENGAMANNYA: penanda hanya berlaku di berkas yang TERDAFTAR di BERKAS_BOLEH_MENANDAI.
// Tanpa itu, siapa pun bisa membungkam pengawas ini dengan menempelkan satu komentar.
const PENANDA_MULAI = /pengawas-elemen:mulai/;
const PENANDA_SELESAI = /pengawas-elemen:selesai/;

const BERKAS_BOLEH_MENANDAI = new Set([
  'src/features/ppic/pages/PpicDashboardPage.tsx',
  'src/features/documents/pages/DocumentsPage.tsx'
]);

/// Utang yang SUDAH TERCATAT sebagai task dan belum dibereskan. Daftar ini HANYA BOLEH
/// MENYUSUT: bila sebuah entri tidak lagi ditemukan, test ini GAGAL dan menyuruh entrinya
/// dihapus. Tanpa aturan itu, daftar utang berubah jadi tempat menyembunyikan pelanggaran.
const UTANG: { berkas: string; tag: string; jumlah: number; task: string }[] = [];

interface Temuan {
  berkas: string;
  baris: number;
  jenis: string;
  keterangan: string;
}

function berkasHalaman(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...berkasHalaman(p));
    else if (e.isFile() && p.includes(`${sep}pages${sep}`) && p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/// Baris-baris yang berada di antara penanda mulai dan selesai.
function barisDikecualikan(isiAsli: string, rel: string): Set<number> {
  const hasil = new Set<number>();
  if (!BERKAS_BOLEH_MENANDAI.has(rel)) return hasil;
  const baris = isiAsli.split('\n');
  let aktif = false;
  baris.forEach((b, i) => {
    if (PENANDA_MULAI.test(b)) aktif = true;
    if (aktif) hasil.add(i + 1);
    if (PENANDA_SELESAI.test(b)) aktif = false;
  });
  return hasil;
}

/// Isi tag pembuka mulai dari sebuah indeks, sadar tanda kutip dan kurung kurawal JSX.
function tagPembuka(teks: string, i: number): string {
  let kutip: string | null = null;
  let kurawal = 0;
  for (let j = i; j < teks.length; j += 1) {
    const c = teks[j];
    if (kutip) {
      if (c === kutip) kutip = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      kutip = c;
      continue;
    }
    if (c === '{') kurawal += 1;
    else if (c === '}') kurawal -= 1;
    else if (c === '>' && kurawal === 0) return teks.slice(i, j + 1);
  }
  return teks.slice(i, i + 500);
}

/// Berapa kolom sebuah tabel? Menghitung <TableHeader> literal di dalam <TableHead>, DAN —
/// bila kepalanya memetakan sebuah array kolom — jumlah entri array itu.
///
/// MENGEMBALIKAN null BILA TIDAK YAKIN, dan itu disengaja: menebak jumlah kolom lalu
/// menuduh berdasarkan tebakan adalah persis kelas "penjaga salah tuduh" yang sudah lima kali
/// terjadi di proyek ini. Tabel yang tidak terbaca dilaporkan sebagai TIDAK TERPERIKSA di
/// test tersendiri, bukan diloloskan diam-diam.
function hitungKolom(isi: string, indeksTabel: number): number | null {
  const akhir = isi.indexOf('</TableHead>', indeksTabel);
  if (akhir === -1) return null;
  const kepala = isi.slice(indeksTabel, akhir);

  const literal = (kepala.match(/<TableHeader(?=[\s/>])/g) ?? []).length;
  const peta = kepala.match(/\{\s*([A-Za-z_$][\w$]*)\s*\.map\(/);
  if (!peta) return literal || null;

  // Array kolomnya: dari `const NAMA` sampai `];` pertama sesudahnya.
  const deklarasi = new RegExp(`const\\s+${peta[1]}\\b[^\\n]*`).exec(isi);
  if (!deklarasi) return null;
  const mulaiArray = isi.indexOf('[', deklarasi.index);
  const akhirArray = isi.indexOf('];', mulaiArray);
  if (mulaiArray === -1 || akhirArray === -1) return null;
  const blokArray = isi.slice(mulaiArray, akhirArray);

  const entri = (blokArray.match(/\bheader\s*:/g) ?? []).length;
  if (entri === 0) return null;

  // Kolom yang ditambahkan bersyarat sesudah array dibuat ikut dihitung — batas ATAS,
  // supaya tabel yang kadang berkolom banyak tidak lolos hanya karena kadang tidak.
  const sesudahArray = isi.slice(akhirArray, isi.indexOf('return', akhirArray) + 1);
  const tambahan = (sesudahArray.match(new RegExp(`${peta[1]}\\w*\\.push\\(`, 'g')) ?? []).length;

  return literal + entri + tambahan;
}

function sisirBerkas(abs: string): Temuan[] {
  const rel = abs.replace(`${AKAR}/`, '');
  const asli = readFileSync(abs, 'utf8');
  const isi = tanpaKomentar(asli);
  const dikecualikan = barisDikecualikan(asli, rel);
  const temuan: Temuan[] = [];

  for (const tag of TAG_MENTAH) {
    const re = new RegExp(`<${tag}(?=[\\s/>])`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(isi)) !== null) {
      const baris = nomorBaris(isi, m.index);
      if (dikecualikan.has(baris)) continue;
      temuan.push({
        berkas: rel,
        baris,
        jenis: `<${tag}> mentah`,
        keterangan: `pakai komponen bersama di src/components/ui, atau tandai pengecualiannya`
      });
    }
  }

  const reTabel = /<Table(?=[\s/>])/g;
  let t: RegExpExecArray | null;
  while ((t = reTabel.exec(isi)) !== null) {
    const baris = nomorBaris(isi, t.index);
    if (dikecualikan.has(baris)) continue;
    const tag = tagPembuka(isi, t.index);

    if (!/tabel-responsif/.test(tag)) {
      temuan.push({
        berkas: rel,
        baris,
        jenis: '<Table> tanpa .tabel-responsif',
        keterangan:
          'tanpa kelas ini tabelnya tetap tabel di layar sempit dan kolom terakhir jatuh ke luar layar'
      });
      continue;
    }

    // ATURAN AMBANG LEBAR (RR.4): 8 kolom atau lebih WAJIB memakai varian lebar.
    // Diukur 26 Agu 2026: tabel 8-9 kolom butuh 776-820px, jadi ia TETAP terpotong di
    // rentang 672-1055px meski kelas responsif biasa sudah dipasang. Tabel <= 7 kolom
    // terukur muat di 672px.
    const jumlahKolom = hitungKolom(isi, t.index);
    if (jumlahKolom !== null && jumlahKolom >= 8 && !/tabel-responsif--lebar/.test(tag)) {
      temuan.push({
        berkas: rel,
        baris,
        jenis: '<Table> berkolom banyak tanpa varian lebar',
        keterangan: `${jumlahKolom} kolom — pakai className="tabel-responsif--lebar" (ambang 1056px)`
      });
    }
  }

  return temuan;
}

function sisirSemua(): Temuan[] {
  return berkasHalaman(DIR_FITUR)
    .sort()
    .flatMap((f) => sisirBerkas(f));
}

describe('DS-16 — pengawas elemen mentah & tabel non-responsif di halaman internal', () => {
  it('NOL elemen mentah dan NOL <Table> tanpa kelas responsif di luar pengecualian tercatat', () => {
    const temuan = sisirSemua();
    // PENGHITUNG, bukan himpunan: `jumlah: 3` berarti tiga pelanggaran dimaafkan, bukan satu.
    // Versi pertama memakai Set dan diam-diam menciutkan tiga jadi satu — persis kelas cacat
    // "alat ukur melapor terbalik" yang sudah lima kali terjadi di proyek ini.
    const sisaJatah = new Map<string, number>();
    for (const u of UTANG) sisaJatah.set(`${u.berkas}|${u.tag}`, (sisaJatah.get(`${u.berkas}|${u.tag}`) ?? 0) + u.jumlah);

    const tersisa = temuan.filter((t) => {
      const kunci = `${t.berkas}|${t.jenis}`;
      const jatah = sisaJatah.get(kunci) ?? 0;
      if (jatah > 0) {
        sisaJatah.set(kunci, jatah - 1);
        return false;
      }
      return true;
    });

    if (tersisa.length > 0) {
      const pesan = tersisa
        .map((t) => `  ${t.berkas}:${t.baris}  ${t.jenis}\n      -> ${t.keterangan}`)
        .join('\n');
      throw new Error(`Ditemukan ${tersisa.length} pelanggaran:\n${pesan}`);
    }
    expect(tersisa).toHaveLength(0);
  });

  it('daftar UTANG hanya boleh MENYUSUT — entri yang sudah beres wajib dihapus', () => {
    const temuan = sisirSemua();
    const basi = UTANG.filter(
      (u) => temuan.filter((t) => t.berkas === u.berkas && t.jenis === u.tag).length < u.jumlah
    );
    if (basi.length > 0) {
      const pesan = basi.map((u) => `  ${u.berkas} ${u.tag} (${u.task})`).join('\n');
      throw new Error(
        `Entri UTANG berikut sudah tidak ditemukan lagi — hapus dari daftarnya:\n${pesan}\n\n` +
          'Daftar utang yang tidak menyusut berubah jadi tempat menyembunyikan pelanggaran.'
      );
    }
    expect(basi).toHaveLength(0);
  });

  it('menyebutkan tabel yang jumlah kolomnya TIDAK bisa dibaca — bukan meloloskannya diam-diam', () => {
    const takTerbaca: string[] = [];
    for (const abs of berkasHalaman(DIR_FITUR).sort()) {
      const rel = abs.replace(`${AKAR}/`, '');
      const asli = readFileSync(abs, 'utf8');
      const isi = tanpaKomentar(asli);
      const dikecualikan = barisDikecualikan(asli, rel);
      const re = /<Table(?=[\s/>])/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(isi)) !== null) {
        const baris = nomorBaris(isi, m.index);
        if (dikecualikan.has(baris)) continue;
        if (hitungKolom(isi, m.index) === null) takTerbaca.push(`${rel}:${baris}`);
      }
    }

    // Ini BUKAN kegagalan — ia laporan kejujuran. Angka "nol pelanggaran" di test sebelumnya
    // hanya berarti sesuatu bila diketahui berapa banyak yang memang TIDAK diperiksa.
    if (takTerbaca.length > 0) {
      console.log(
        `[DS-16] ${takTerbaca.length} tabel tidak terbaca jumlah kolomnya, jadi aturan ambang ` +
          `8-kolom TIDAK berlaku untuknya:\n  ${takTerbaca.join('\n  ')}`
      );
    }
    expect(Array.isArray(takTerbaca)).toBe(true);
  });

  describe('bukti negatif — pengawas ini TERBUKTI BISA gagal', () => {
    it('menangkap <button> mentah yang benar-benar disisipkan, dan komentar TIDAK dihitung', () => {
      const palsu = [
        'export default function Palsu() {',
        '  // <button> ini cuma disebut di dalam kalimat penjelasan, bukan kode',
        '  return (',
        '    <div>',
        '      <button type="button">nyata</button>',
        '      <Table size="lg" />',
        '    </div>',
        '  );',
        '}'
      ].join('\n');

      const isi = tanpaKomentar(palsu);
      const mentah = [...isi.matchAll(/<button(?=[\s/>])/g)];
      expect(mentah).toHaveLength(1);
      expect(nomorBaris(isi, mentah[0].index!)).toBe(5);

      const tabel = [...isi.matchAll(/<Table(?=[\s/>])/g)];
      expect(tabel).toHaveLength(1);
      expect(/tabel-responsif/.test(tagPembuka(isi, tabel[0].index!))).toBe(false);
    });

    it('TIDAK menghitung <table> yang hanya disebut di dalam komentar', () => {
      const palsu = ['// halaman ini sengaja memakai <table> polos untuk papan Gantt', 'const x = 1;'].join('\n');
      expect([...tanpaKomentar(palsu).matchAll(/<table(?=[\s/>])/g)]).toHaveLength(0);
    });
  });
});
