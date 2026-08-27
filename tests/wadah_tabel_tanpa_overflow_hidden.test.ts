import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, sep, relative } from 'node:path';
import { tanpaKomentar } from './util/tanpaKomentar';

// ============================================================================
// RSP-02 — PENGAWAS: overflow-hidden PADA WADAH TABEL
// ============================================================================
// KENAPA PENGAWAS, BUKAN DAFTAR PERBAIKAN. Keputusan pemilik produk 24 Agu 2026, dan
// alasannya tajam: aturan "periksa contoh sekelas di berkas yang sama" ditulis di CLAUDE.md
// dan DILANGGAR DI HARI YANG SAMA oleh yang menulisnya. RSP-01 mengganti overflow-hidden
// jadi overflow-x-auto di komponen tabel BERSAMA, lalu meninggalkan delapan halaman yang
// menulis tabelnya sendiri. Aturan yang bergantung pada seseorang mengingatnya akan gagal —
// orang yang sedang fokus memperbaiki satu hal memang tidak melihat ke samping.
//
// CACAT YANG DIJAGA, dan kenapa ia yang paling berbahaya: kolom yang tidak muat HILANG
// tanpa ada cara melihatnya. Tidak ada gulir, tidak ada tanda terpotong, tidak ada galat.
// Halamannya terlihat baik-baik saja sambil menyembunyikan data.
//
// ============================================================================
// KONTRAK — apa yang dideteksi, apa yang TIDAK
// ============================================================================
// MENDETEKSI:
//   1. TSX  — `overflow-hidden` pada sebuah className yang MEMBUNGKUS tabel (Table Carbon,
//             DataTable, TableContainer, atau <table> mentah) dalam jangkauan dekat.
//   2. SCSS — aturan yang selektornya menyebut tabel/table DAN menyembunyikan overflow.
//
// TIDAK MENDETEKSI, dan ini disebut supaya tidak dikira lebih kuat daripada kenyataannya:
//   - `overflow: hidden` yang TIDAK berhubungan dengan tabel — foto bulat, kotak pratinjau,
//     teks yang dipotong ellipsis, panel yang menggulir sendiri. Itu pemakaian yang sah dan
//     melarangnya akan melahirkan pengawas yang salah tuduh, yaitu pengawas yang berhenti
//     dibaca orang.
//   - overflow yang datang dari stylesheet Carbon sendiri di node_modules.
//   - apakah sebuah tabel PANTAS jadi kartu di layar sempit — itu wilayah DS-16, bukan sini.
//
// TIDAK MEMUTUSKAN: jumlah kolom, kepantasan komponen, dan rancangan visual.
//
// ============================================================================
// BATAS ALATNYA — pencocokan teks, bukan parser
// ============================================================================
// Komentar dibuang lebih dulu lewat pembantu bersama tests/util/tanpaKomentar.ts (AUD-42),
// jadi kalimat penjelasan yang MENYEBUT `overflow-hidden` tidak dihitung sebagai pemakaian.
// Yang TIDAK ditutupnya: teks di dalam string, dan kedekatan baris hanyalah PERKIRAAN
// struktur JSX — sebuah wadah ber-overflow-hidden yang tabelnya berada 30 baris di bawah
// tidak akan tertangkap. Pengawas ini mencocokkan TEKS, bukan memahami program.
//
// ============================================================================
// HUBUNGAN DENGAN DS-16 — beda pekerjaan, bukan tumpang tindih
// ============================================================================
// DS-16 (tests/elemen_mentah_halaman_internal.test.ts) menjaga BENTUK tabelnya: elemen
// mentah, kelas responsif, varian lebar, pagination, keadaan kosong. Diperiksa 27 Agu 2026:
// berkas itu memuat NOL kata "overflow". Pengawas ini menjaga hal yang berbeda — apakah ada
// sesuatu yang MEMOTONG tabel itu secara mendatar. Sebuah tabel bisa lulus DS-16 sepenuhnya
// dan tetap kehilangan kolomnya di balik wadah ber-overflow-hidden.
// ============================================================================

const AKAR = join(__dirname, '..');

/// PENGECUALIAN EKSPLISIT, MASING-MASING BERALASAN.
/// Menambah baris di sini adalah TINDAKAN SADAR, bukan jalan pintas — itu seluruh alasan
/// daftarnya berbentuk seperti ini dan bukan sebuah pola abaikan.
const PENGECUALIAN: { berkas: string; selektor: string; alasan: string }[] = [
  {
    berkas: 'src/styles/carbon.scss',
    selektor: '.cds--skeleton.cds--data-table td',
    alasan:
      'Sel RANGKA PEMUATAN (skeleton), bukan sel berisi data. Yang dipotong adalah batang ' +
      'abu-abu penanda "sedang memuat" — tidak ada satu pun informasi pengguna di dalamnya, ' +
      'dan membiarkannya meluber justru merusak lebar kolom saat data sungguhan datang.'
  }
];

const PEMBUKA_TABEL = /<(?:table|Table|DataTable|TableContainer)(?=[\s/>])/;

type Temuan = { berkas: string; baris: number; jenis: string; teks: string };

function berkasSumber(dir: string, ekstensi: string[]): string[] {
  const keluar: string[] = [];
  const jalan = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (!/node_modules|\.next|\.git/.test(p)) jalan(p);
      } else if (ekstensi.some((x) => p.endsWith(x))) {
        keluar.push(p);
      }
    }
  };
  jalan(dir);
  return keluar;
}

/// Jangkauan pencarian tabel sesudah baris ber-overflow-hidden.
///
/// ANGKANYA DIPILIH DARI BENTUK CACATNYA, bukan dari selera: kedelapan halaman yang
/// melahirkan RSP-02 semuanya berbentuk `<div className="... overflow-hidden ...">` diikuti
/// pembuka tabel dalam beberapa baris berikutnya. Lebih lebar dari ini mulai menuduh wadah
/// yang kebetulan punya tabel jauh di bawahnya.
const JANGKAUAN_BARIS = 12;

/// Jalur SELALU relatif ke AKAR repositori, bukan ke akar penyisiran.
///
/// KENAPA DISEBUT: versi pertama memakai `relative(akar, f)`, sehingga menyisir `src/`
/// menghasilkan "styles/carbon.scss" sementara daftar pengecualian menyebut
/// "src/styles/carbon.scss" — kuncinya tidak pernah cocok dan pengecualiannya TIDAK BERLAKU.
/// Bentuk cacat yang sama persis dengan mekanisme jatah utang DS-16 (26 Agu 2026): daftar
/// yang ada, terbaca benar, dan tidak pernah dipakai. Ditemukan karena pengawas ini
/// dijalankan terhadap repositori sungguhan, bukan hanya terhadap fixture-nya.
function jalurRelatif(berkasAbsolut: string): string {
  return relative(AKAR, berkasAbsolut).split(sep).join('/');
}

export function sisirWadahTabel(akar: string): Temuan[] {
  const temuan: Temuan[] = [];

  // --- TSX -----------------------------------------------------------------
  for (const f of berkasSumber(akar, ['.tsx'])) {
    const rel = jalurRelatif(f);
    const baris = tanpaKomentar(readFileSync(f, 'utf8')).split('\n');
    baris.forEach((b, i) => {
      if (!/className="[^"]*\boverflow-hidden\b/.test(b)) return;
      const jendela = baris.slice(i, i + JANGKAUAN_BARIS + 1).join('\n');
      if (!PEMBUKA_TABEL.test(jendela)) return;
      temuan.push({ berkas: rel, baris: i + 1, jenis: 'wadah tabel ber-overflow-hidden', teks: b.trim().slice(0, 90) });
    });
  }

  // --- SCSS ----------------------------------------------------------------
  for (const f of berkasSumber(akar, ['.scss'])) {
    const rel = jalurRelatif(f);
    const isi = tanpaKomentar(readFileSync(f, 'utf8'));
    const aturan = /([^\n{}]*(?:tabel|table)[^\n{}]*)\{([^{}]*)\}/gi;
    let m: RegExpExecArray | null;
    while ((m = aturan.exec(isi)) !== null) {
      if (!/overflow(-x)?\s*:\s*hidden/i.test(m[2])) continue;
      const selektor = m[1].trim();
      if (PENGECUALIAN.some((p) => p.berkas === rel && p.selektor === selektor)) continue;
      temuan.push({
        berkas: rel,
        baris: isi.slice(0, m.index).split('\n').length,
        jenis: 'aturan tabel menyembunyikan overflow',
        teks: selektor.slice(0, 90)
      });
    }
  }

  return temuan;
}

describe('RSP-02 — pengawas overflow-hidden pada wadah tabel', () => {
  it('tidak ada wadah tabel yang menyembunyikan overflow di seluruh src/ dan app/', () => {
    const temuan = [...sisirWadahTabel(join(AKAR, 'src')), ...sisirWadahTabel(join(AKAR, 'app'))];

    if (temuan.length > 0) {
      const pesan = temuan
        .map((t) => `  ${t.berkas}:${t.baris}  ${t.jenis}\n      ${t.teks}`)
        .join('\n');
      throw new Error(
        `Ditemukan ${temuan.length} wadah tabel yang memotong isinya:\n${pesan}\n\n` +
          'Pakai overflow-x-auto (atau kelas .tabel-responsif yang sudah ada), BUKAN ' +
          'overflow-hidden. Kolom yang tidak muat harus tetap bisa dijangkau — hilang tanpa ' +
          'gulir adalah cacat yang tidak terlihat sebagai kerusakan.\n' +
          'Bila memang sah, daftarkan di PENGECUALIAN beserta alasannya di berkas ini.'
      );
    }
    expect(temuan).toHaveLength(0);
  });

  // ==========================================================================
  // BUKTI DUA ARAH. Tanpa bagian ini, "hijau" tidak membuktikan apa pun —
  // pengawas yang tidak pernah bisa merah dan pengawas yang menjaga dengan benar
  // menghasilkan keluaran yang sama persis.
  // ==========================================================================
  describe('bukti dua arah — pengawas ini TERBUKTI bisa merah, dan terbukti tidak asal merah', () => {
    const dirFixture = join(__dirname, '__rsp02_fixture__');
    const tulis = (nama: string, isi: string) => {
      mkdirSync(dirFixture, { recursive: true });
      writeFileSync(join(dirFixture, nama), isi, 'utf8');
    };
    const bersihkan = () => rmSync(dirFixture, { recursive: true, force: true });

    it('A. PELANGGARAN: wadah ber-overflow-hidden membungkus Table Carbon -> TERDETEKSI', () => {
      tulis(
        'a.tsx',
        ['export function A() {', '  return (', '    <div className="rounded border overflow-hidden">', '      <Table>', '        <TableBody />', '      </Table>', '    </div>', '  );', '}', ''].join('\n')
      );
      const temuan = sisirWadahTabel(dirFixture);
      expect(temuan).toHaveLength(1);
      expect(temuan[0].baris).toBe(3);
      bersihkan();
    });

    it('B. SAH: Table Carbon tanpa wadah yang memotong -> TIDAK terdeteksi', () => {
      tulis(
        'b.tsx',
        ['export function B() {', '  return (', '    <div className="tabel-responsif">', '      <Table>', '        <TableBody />', '      </Table>', '    </div>', '  );', '}', ''].join('\n')
      );
      expect(sisirWadahTabel(dirFixture)).toHaveLength(0);
      bersihkan();
    });

    it('C. SAH: overflow-hidden pada elemen yang BUKAN wadah tabel -> TIDAK terdeteksi', () => {
      // Foto bulat, kotak pratinjau, dan panel yang menggulir sendiri memang memakainya.
      // Melarangnya menyeluruh akan membuat pengawas ini salah tuduh di belasan tempat sah.
      tulis(
        'c.tsx',
        ['export function C() {', '  return <span className="h-8 w-8 rounded-full overflow-hidden"><img alt="" /></span>;', '}', ''].join('\n')
      );
      expect(sisirWadahTabel(dirFixture)).toHaveLength(0);
      bersihkan();
    });

    it('D. SAH: HTML semantik biasa tanpa overflow-hidden -> TIDAK terdeteksi', () => {
      tulis('d.tsx', ['export function D() {', '  return <table><tbody /></table>;', '}', ''].join('\n'));
      expect(sisirWadahTabel(dirFixture)).toHaveLength(0);
      bersihkan();
    });

    it('E. PELANGGARAN: aturan SCSS bertabel menyembunyikan overflow -> TERDETEKSI', () => {
      tulis('e.scss', ['.wadah-tabel-uji {', '  overflow: hidden;', '}', ''].join('\n'));
      const temuan = sisirWadahTabel(dirFixture);
      expect(temuan).toHaveLength(1);
      expect(temuan[0].jenis).toBe('aturan tabel menyembunyikan overflow');
      bersihkan();
    });

    it('F. SAH: overflow-hidden yang hanya DISEBUT di dalam komentar -> TIDAK terdeteksi', () => {
      // Kelas cacat AUD-42: penjaga yang tidak membedakan KODE dari PENJELASAN. Berkas ini
      // sendiri panjang komentarnya dan menyebut `overflow-hidden` belasan kali.
      tulis(
        'f.tsx',
        [
          'export function F() {',
          '  // Dilarang: <div className="overflow-hidden"><Table /></div>',
          '  /* juga dilarang: className="overflow-hidden" lalu <table> */',
          '  return <div className="tabel-responsif"><Table /></div>;',
          '}',
          ''
        ].join('\n')
      );
      expect(sisirWadahTabel(dirFixture)).toHaveLength(0);
      bersihkan();
    });

    it('G. PENGECUALIAN TERCATAT benar-benar berlaku — dan hanya untuk selektor yang persis', () => {
      // Menguji MEKANISMENYA, bukan hanya keberadaan daftarnya. Pelajaran 26 Agu 2026:
      // mekanisme jatah utang DS-16 ternyata tidak pernah berlaku karena kuncinya tidak
      // cocok, dan tidak ada yang tahu sebab daftarnya masih kosong.
      const terdaftar = PENGECUALIAN[0];
      expect(terdaftar.berkas).toBe('src/styles/carbon.scss');
      expect(terdaftar.alasan.length).toBeGreaterThan(40);

      // BUKTI BAHWA IA BENAR-BENAR BERLAKU, bukan sekadar tercatat: aturan yang dimaafkan
      // memang ADA di berkas sungguhan, dan penyisiran penuh tetap bersih karenanya.
      const isiNyata = readFileSync(join(AKAR, terdaftar.berkas), 'utf8');
      expect(isiNyata).toContain(terdaftar.selektor);

      // Yang diperiksa: TIDAK ADA temuan yang menunjuk selektor yang sudah dimaafkan.
      // SENGAJA bukan "seluruh src/ bersih" — itu klaim milik uji utama di atas, dan
      // menyalinnya ke sini membuat satu pelanggaran nyata melaporkan DUA kegagalan yang
      // seolah berbeda. Pengawas yang menyebut satu cacat dua kali mengaburkan hitungannya.
      const temuanNyata = sisirWadahTabel(join(AKAR, 'src'));
      expect(temuanNyata.filter((t) => t.teks === terdaftar.selektor)).toHaveLength(0);

      // Selektor yang MIRIP tapi tidak persis TIDAK boleh ikut dimaafkan.
      tulis('g.scss', ['.cds--skeleton.cds--data-table th {', '  overflow: hidden;', '}', ''].join('\n'));
      expect(sisirWadahTabel(dirFixture)).toHaveLength(1);
      bersihkan();
    });
  });
});
