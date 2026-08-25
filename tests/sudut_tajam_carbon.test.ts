import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

// DS-01 / FF.1 lanjutan (25 Agu 2026) — SUDUT TAJAM CARBON, DIUKUR DARI CSS KELUARAN.
//
// KENAPA TEST INI ADA, dan kenapa ia MENJALANKAN Tailwind alih-alih membaca config:
//
// Sudut membulat sudah "diperbaiki" sekali dan tetap membulat. Sebabnya bukan Carbon ditimpa,
// bukan CSS global, bukan komponen yang salah — melainkan cara memeriksanya. Skala
// borderRadius bawaan Tailwind punya SEMBILAN anak tangga; config hanya menimpa TIGA
// (lg/md/sm). Pemeriksaan sebelumnya melihat ketiga anak tangga itu, mendapati semuanya 0px,
// lalu menyimpulkan SELURUH skalanya nol. Enam sisanya diam-diam tetap memakai nilai Tailwind,
// dan kode memakai empat di antaranya di 34 tempat.
//
// Membaca config tidak bisa menangkap itu, karena yang salah justru ada di bagian yang TIDAK
// tertulis di config. Satu-satunya bukti yang sah adalah CSS yang benar-benar dipancarkan.
// Karena itu test ini menjalankan Tailwind sungguhan atas SELURUH anak tangga yang mungkin,
// lalu membaca hasilnya.
//
// DI LUAR JANGKAUAN: ini menjaga sudut dari sisi Tailwind. Sudut yang berasal dari stylesheet
// Carbon sendiri (Toggletip 2px, tombol radio 50%, dan seterusnya) TIDAK dijaga di sini —
// itu memang spesifikasi Carbon, bukan penyimpangan.

const AKAR = join(__dirname, '..');

// `full` sengaja dikecualikan: dipakai foto profil dan titik hitung lonceng notifikasi, yang
// memang bulat dan bukan kontrol bersudut.
const DIKECUALIKAN = new Set(['rounded-full']);

const SELURUH_ANAK_TANGGA = [
  'rounded',
  'rounded-none',
  'rounded-sm',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'rounded-2xl',
  'rounded-3xl',
  'rounded-full'
];

function pancarkanCss(kelas: string[]): Map<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'sudut-'));
  writeFileSync(join(dir, 'in.css'), '@tailwind utilities;\n');
  writeFileSync(join(dir, 'probe.tsx'), `export const x = "${kelas.join(' ')}";`);
  execFileSync(
    'npx',
    ['tailwindcss', '-i', join(dir, 'in.css'), '-o', join(dir, 'out.css'), '--content', join(dir, 'probe.tsx'), '-c', join(AKAR, 'tailwind.config.ts')],
    { cwd: AKAR, stdio: 'pipe' }
  );
  const css = readFileSync(join(dir, 'out.css'), 'utf8');

  const hasil = new Map<string, string>();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const nilai = /border-radius:\s*([^;}]+)/.exec(m[2])?.[1]?.trim();
    if (!nilai) continue;
    for (const sel of m[1].split(',')) {
      const nama = sel.trim().replace(/^\./, '');
      if (SELURUH_ANAK_TANGGA.includes(nama)) hasil.set(nama, nilai);
    }
  }
  return hasil;
}

function berkasTsx(dir: string, keluar: string[] = []): string[] {
  for (const nama of readdirSync(dir)) {
    if (nama === 'node_modules' || nama === '.next' || nama.startsWith('.')) continue;
    const p = join(dir, nama);
    if (statSync(p).isDirectory()) berkasTsx(p, keluar);
    else if (/\.(tsx|ts|css|scss)$/.test(nama)) keluar.push(p);
  }
  return keluar;
}

describe('DS-01 — sudut tajam Carbon dijaga dari CSS yang benar-benar dipancarkan', () => {
  it('SELURUH anak tangga borderRadius memancarkan 0, bukan hanya yang ditimpa config', () => {
    const dipancarkan = pancarkanCss(SELURUH_ANAK_TANGGA);

    const melanggar: string[] = [];
    for (const kelas of SELURUH_ANAK_TANGGA) {
      if (DIKECUALIKAN.has(kelas)) continue;
      const nilai = dipancarkan.get(kelas);
      // Anak tangga yang tidak dipancarkan sama sekali bukan pelanggaran -- ia tidak bisa
      // membulatkan apa pun.
      if (nilai === undefined) continue;
      if (!/^0(px|rem|em)?$/.test(nilai)) melanggar.push(`${kelas} = ${nilai}`);
    }

    expect(
      melanggar,
      `Anak tangga borderRadius berikut memancarkan sudut membulat: ${melanggar.join(', ')}. ` +
        'Timpa nilainya jadi 0px di tailwind.config.ts. Menimpa sebagian anak tangga saja adalah ' +
        'persis cacat yang melahirkan test ini.'
    ).toEqual([]);
  });

  it('kelas sudut bulat yang dikecualikan hanya dipakai di tempat yang memang bulat', () => {
    const berkas = [...berkasTsx(join(AKAR, 'src')), ...berkasTsx(join(AKAR, 'app'))];
    const pemakai: string[] = [];
    for (const f of berkas) {
      if (/\brounded-full\b/.test(readFileSync(f, 'utf8'))) pemakai.push(f.replace(AKAR + '/', ''));
    }

    // Foto profil dan titik hitung notifikasi memang bulat menurut konvensi mana pun.
    // Tombol berbentuk pil TIDAK termasuk -- itu bukan Carbon, dan sembilan di antaranya
    // sudah diubah jadi bersudut tajam pada 25 Agu 2026.
    // JANGKAUAN DIPERLUAS 25 Agu 2026, dan alasannya ditemukan oleh test ini sendiri:
    // lonceng notifikasi berhenti memakai kelas `rounded-full` bukan karena bentuknya berubah,
    // melainkan karena bulatannya PINDAH ke stylesheet sebagai `border-radius: 50%`.
    // Versi pertama penjaga ini hanya menyisir TSX, jadi bentuk bulat yang pindah ke SCSS
    // akan lolos tanpa terdeteksi — lubang yang persis sama bentuknya dengan cacat yang
    // melahirkan penjaga ini: memeriksa satu tempat lalu menyimpulkan seluruhnya.
    for (const f of [...berkasTsx(join(AKAR, 'app')), ...berkasTsx(join(AKAR, 'src'))]) {
      if (!/\.scss$/.test(f)) continue;
      if (/border-radius:\s*(50%|9999px)/.test(readFileSync(f, 'utf8'))) {
        pemakai.push(f.replace(AKAR + '/', '') + ' (border-radius di SCSS)');
      }
    }

    expect(
      pemakai.sort(),
      'Ada berkas baru memakai bentuk bulat. Bila itu tombol atau kontrol, ia tidak boleh ' +
        'berbentuk pil di sistem yang memakai Carbon. Bila memang bulat (foto profil, titik ' +
        'hitung notifikasi), tambahkan berkasnya ke daftar ini beserta alasannya.'
    // Daftarnya URUT ABJAD karena `pemakai` disortir -- bukan urut kepentingan.
    ).toEqual([
      // Avatar berinisial di header + titik hitung notifikasi. Keduanya memang bulat, dan
      // keduanya hidup di stylesheet kerangka aplikasi.
      'app/(shell)/shell.scss (border-radius di SCSS)',
      // Foto profil — bulat menurut konvensi avatar di mana pun.
      'src/features/auth/pages/ProfilePage.tsx'
    ]);
  });
});
