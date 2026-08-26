import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// PENJAGA KURUNG MIGRASI (25 Agu 2026).
//
// ============================================================================
// KENAPA PENJAGA INI ADA
// ============================================================================
// Dalam SATU giliran kerja, cacat yang sama terjadi DUA KALI: sebuah `insert ... values (`
// ditutup dengan `');` — satu kurung untuk `concat_ws`, dan tidak ada satu pun untuk
// `values (`. Kedua kalinya menghabiskan waktu jauh lebih banyak daripada seharusnya,
// dan alasannya bukan kecerobohan melainkan BENTUK PESAN GALATNYA:
//
//   ERROR: unexpected end of function definition at end of input
//   LINE 75: end $mig$;
//
// Postgres menunjuk baris `end $mig$;` — tempat yang benar-benar salah. Blok DO-nya utuh;
// yang tidak utuh kurungnya, ratusan baris di atas. Tiga tebakan pertama semuanya salah
// alamat (dikira dollar-quote, dikira pemisah statement CLI, dikira karakter aneh di teks).
//
// Yang menemukannya adalah membelah bloknya jadi potongan kecil dan menjalankan tiap
// potongan — pekerjaan yang tidak perlu dilakukan siapa pun lagi bila penjaga ini ada.
//
// ============================================================================
// APA YANG DIJAGA, DAN APA YANG TIDAK
// ============================================================================
// Ini penghitung kurung yang SADAR STRING, bukan parser SQL. Ia tahu bahwa `(` di dalam
// 'teks (begini)' bukan kurung sungguhan, dan tahu bahwa `''` di dalam string adalah tanda
// kutip yang di-escape, bukan penutup. Ia TIDAK memahami tata bahasa SQL sama sekali.
//
// Artinya: ia menangkap kurung yang tidak seimbang — kelas cacat yang sudah terjadi dua
// kali — dan TIDAK menangkap kesalahan SQL lain. Itu memang batasnya, dan disebutkan di
// sini supaya tidak ada yang mengira migrasi yang lolos penjaga ini pasti benar.

const DIR = join(__dirname, '..', 'supabase', 'migrations');

interface Ketidakseimbangan {
  berkas: string;
  pesan: string;
}

/// Menghitung kurung di luar literal string dan komentar. Mengembalikan pesan bila tidak
/// seimbang, atau null bila seimbang.
function periksaKurung(isi: string): string | null {
  let dalamString = false;
  let dalamKomentarBaris = false;
  let dalamKomentarBlok = false;
  let tagDolar: string | null = null;
  let saldo = 0;
  let barisTerakhirBuka = 0;
  let baris = 1;

  for (let i = 0; i < isi.length; i += 1) {
    const c = isi[i];
    if (c === '\n') {
      baris += 1;
      dalamKomentarBaris = false;
      continue;
    }

    if (dalamKomentarBaris) continue;

    if (dalamKomentarBlok) {
      if (c === '*' && isi[i + 1] === '/') { dalamKomentarBlok = false; i += 1; }
      continue;
    }

    // Dollar-quoting ($mig$ ... $mig$). Isinya tetap dihitung: justru DI DALAM blok DO
    // itulah kurung yang hilang selama ini berada.
    if (!dalamString && c === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(isi.slice(i));
      if (m) {
        if (tagDolar === null) tagDolar = m[0];
        else if (tagDolar === m[0]) tagDolar = null;
        i += m[0].length - 1;
        continue;
      }
    }

    if (dalamString) {
      // '' di dalam string = satu tanda kutip, bukan penutup.
      if (c === "'") {
        if (isi[i + 1] === "'") { i += 1; continue; }
        dalamString = false;
      }
      continue;
    }

    if (c === "'") { dalamString = true; continue; }
    if (c === '-' && isi[i + 1] === '-') { dalamKomentarBaris = true; i += 1; continue; }
    if (c === '/' && isi[i + 1] === '*') { dalamKomentarBlok = true; i += 1; continue; }

    if (c === '(') { saldo += 1; barisTerakhirBuka = baris; }
    else if (c === ')') {
      saldo -= 1;
      if (saldo < 0) return `kurung TUTUP berlebih di baris ${baris}`;
    }
  }

  if (dalamString) return 'ada literal string yang tidak pernah ditutup';
  if (saldo > 0) {
    return `${saldo} kurung BUKA tidak pernah ditutup (yang terakhir dibuka di sekitar baris ${barisTerakhirBuka})`;
  }
  return null;
}

describe('Migrasi: kurung seimbang sebelum menyentuh database', () => {
  it('setiap berkas migrasi punya kurung yang seimbang di luar string dan komentar', () => {
    const berkas = readdirSync(DIR).filter((n) => n.endsWith('.sql')).sort();
    expect(berkas.length, 'tidak ada berkas migrasi sama sekali — jalur pemeriksaannya salah').toBeGreaterThan(0);

    const rusak: Ketidakseimbangan[] = [];
    for (const nama of berkas) {
      const pesan = periksaKurung(readFileSync(join(DIR, nama), 'utf8'));
      if (pesan) rusak.push({ berkas: nama, pesan });
    }

    expect(
      rusak.map((r) => `${r.berkas}: ${r.pesan}`),
      'Migrasi berikut kurungnya tidak seimbang. Postgres akan menolaknya dengan pesan yang ' +
        'menunjuk baris TERAKHIR berkas ("unexpected end of function definition at end of input"), ' +
        'bukan tempat kurungnya hilang — jadi perbaiki dari sini, jangan dari pesan Postgres.'
    ).toEqual([]);
  });

  it('penghitungnya sendiri benar: mengenali kurung di dalam string sebagai BUKAN kurung', () => {
    // Tanpa kesadaran string, contoh di bawah akan dilaporkan rusak padahal benar.
    expect(periksaKurung("select f('teks ( dengan kurung', 'lain )');")).toBeNull();
    expect(periksaKurung("select 'tanda '' kutip di dalam', g(1);")).toBeNull();
    // Dan bentuk yang benar-benar rusak TETAP tertangkap — persis bentuk yang terjadi 2x.
    expect(periksaKurung("insert into t (a, b) values (1, concat_ws(chr(10), 'x', 'y');")).toContain('tidak pernah ditutup');
  });
});
