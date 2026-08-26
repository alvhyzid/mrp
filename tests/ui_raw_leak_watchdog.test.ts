import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { tanpaKomentar } from './util/tanpaKomentar';
import { join, relative } from 'path';

// Sesi 6 — penutupan (21 Agu 2026), diminta pemilik produk setelah menyadari
// tests/glossary.test.ts HANYA menguji ISI peta glossary.ts, bukan menjaga
// APAKAH halaman sungguhan masih memakainya. Test ini adalah PENGAWAS
// KEBOCORAN: menyapu kode sumber setiap halaman (src/features/**/pages/**/*.tsx
// + komponen bersama ProvenanceInfoButton) mencari pola akses field mentah
// (mis. `.status}`, `.role}`, `.ai_draft}`) yang dirender ke JSX TANPA melalui
// satu pun fungsi/peta label yang disetujui -- persis kelas bug yang muncul
// berulang kali sepanjang Sesi 6 (termasuk 1 bug NYATA yang ketahuan lewat
// draf pengawas ini sendiri sebelum di-commit: ProvenanceInfoButton merender
// `r.role` mentah dari kpi_responsibilities.role, sudah diperbaiki jadi
// getRoleLabel(r.role) -- lihat HANDOFF.md bagian penutupan Sesi 6).
//
// KETERBATASAN JUJUR (bukan pengganti verifikasi visual browser -- lihat
// CLAUDE.md "Aturan Verifikasi Manual"): ini SAPUAN KODE SUMBER per baris,
// bukan sapuan HTML hasil render sungguhan. Tidak bisa menjangkau kasus di
// mana identifier mentah datang murni dari NILAI data (bukan dari kode itu
// sendiri) kecuali nilai itu diakses lewat properti field yang terdaftar di
// RISKY_FIELDS di bawah. Heuristiknya berbasis pola teks, bukan parser AST
// penuh -- baris pemanggilan Supabase (`.from(`, `.select(`), payload
// `JSON.stringify(...)` yang dikirim ke server, dan objek `return {...}` /
// `setXxx({...})` biasa SENGAJA dikecualikan karena itu bukan teks yang
// dirender ke pengguna.

const ROOT = join(__dirname, '..');

// Field yang PERNAH atau BERISIKO membocorkan enum/identifier mentah ke UI --
// lihat riwayat perbaikan Sesi 6 di HANDOFF.md untuk daftar kejadian nyata.
const RISKY_FIELDS = [
  'status',
  'role',
  'severity',
  'wage_type',
  'event_type',
  'requested_event_type',
  'leave_type',
  'sensitivity',
  'department',
  'doc_type',
  'table_name',
  'entity',
  'ai_draft',
  'term_key',
  'approval_status',
  'payment_status',
  'output_type',
  'scope'
];

// Penanda AMAN: kalau salah satu substring ini ada di baris yang sama, field
// risiko dianggap SUDAH melalui fungsi/peta label yang disetujui (atau bukan
// konteks JSX sama sekali).
const SAFE_MARKERS = [
  'label', // cocok utk *Labels[...], getFieldLabel(, getRoleLabel(, humanizeXxx (via kata "humanize" sendiri juga, tapi label lebih umum dipakai)
  'variant[', // statusBadgeVariant[...] dkk
  'humanize',
  'kamustermtitle',
  'response.status', // kode status HTTP (200/404), BUKAN enum bisnis
  '.find(' // pola lookup-dengan-fallback, mis. documentTypes.find(...)?.name ?? doc.doc_type
];

// Pengecualian EKSPLISIT dan bernama alasan -- BUKAN pola longgar. Tambah
// baris baru di sini HANYA kalau memang sengaja menampilkan identifier
// mentah (6.4: Detail Teknis khusus company_admin), atau sudah terverifikasi
// nyata bahwa nilainya dihumanisasi di tempat lain (mis. lewat prop ke
// komponen anak yang punya peta labelnya sendiri).
// ============================================================================
// PENGECUALIAN DIKUNCI KE PENANDA DI DALAM BERKASNYA, BUKAN KE NOMOR BARIS
// ============================================================================
// Sampai 26 Agu 2026 pengecualian ditulis sebagai rentang NOMOR BARIS, dan itu menggigit
// TIGA KALI dalam satu hari: tiap kali berkasnya disunting, rentangnya menunjuk baris lain.
// Akibatnya DUA ARAH, dan keduanya buruk:
//   1. baris yang memang dikecualikan jadi DITUDUH bocor -- penjaga yang salah tuduh, dan
//      penjaga yang salah tuduh melatih orang mengabaikan hasilnya;
//   2. baris lain yang benar-benar bocor jadi DIAMPUNI diam-diam -- lubang tanpa bunyi,
//      karena hasil testnya tetap hijau.
//
// Sekarang pengecualiannya IKUT BERPINDAH bersama kodenya: bagian yang sengaja menampilkan
// identifier mentah diapit dua komentar penanda di berkasnya sendiri —
//     // penjaga-kebocoran:mulai <alasan singkat>
//     ...
//     // penjaga-kebocoran:selesai
// Daftar di bawah hanya menyebut BERKAS MANA yang boleh punya penanda itu, supaya penanda
// tidak bisa ditaburkan sembarangan untuk membungkam pengawas ini.
const BERKAS_BOLEH_DIKECUALIKAN: { file: string; reason: string }[] = [
  {
    file: 'src/components/ui/provenance-info-button.tsx',
    reason: 'Panel "Detail Teknis" (Sesi 6, 6.4) -- sengaja menampilkan identifier mentah, HANYA dirender kalau useIsCompanyAdmin() true.'
  },
  {
    file: 'src/features/kamus/pages/KamusPage.tsx',
    reason: 'Toggle "Detail teknis" per kartu Kamus (Sesi 6, 6.4) -- sengaja menampilkan term_key/ai_draft mentah, HANYA dirender kalau useIsCompanyAdmin() true.'
  },
  {
    file: 'src/features/mrp/pages/ShipmentsPage.tsx',
    reason: 'signerRole diteruskan sebagai prop ke <SuratJalanPreview>, yang punya peta roleLabels sendiri. Dibuktikan lewat verifikasi visual: surat jalan tercetak tidak mengandung slug peran mentah.'
  }
];

const PENANDA_MULAI = 'penjaga-kebocoran:mulai';
const PENANDA_SELESAI = 'penjaga-kebocoran:selesai';

/// Baca penanda pengecualian dari isi berkas. Mengembalikan himpunan nomor baris yang
/// dikecualikan. Penanda di berkas yang TIDAK terdaftar di atas sengaja diabaikan — kalau
/// tidak, siapa pun bisa membungkam pengawas ini dengan menempelkan satu komentar.
function barisDikecualikan(relFile: string, lines: string[]): Set<number> {
  const hasil = new Set<number>();
  if (!BERKAS_BOLEH_DIKECUALIKAN.some((e) => e.file === relFile)) return hasil;
  let didalam = false;
  lines.forEach((line, idx) => {
    if (line.includes(PENANDA_MULAI)) {
      didalam = true;
      return;
    }
    if (line.includes(PENANDA_SELESAI)) {
      didalam = false;
      return;
    }
    if (didalam) hasil.add(idx + 1);
  });
  return hasil;
}

type Finding = { file: string; line: number; field: string; text: string };

// Kumpulkan seluruh file .tsx langsung di dalam folder bernama "pages" di
// bawah root yang diberikan (rekursif) -- ini yang jadi layar sungguhan yang
// dilihat pengguna, beda dari server/ (logic) atau komponen generik lainnya.
function listPageFiles(root: string): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.tsx') && dir.endsWith('/pages')) results.push(full);
    }
  }
  if (existsSync(root)) walk(root);
  return results;
}

function scanFileForRawLeaks(absFile: string, repoRoot: string): Finding[] {
  const relFile = relative(repoRoot, absFile);
  const asli = readFileSync(absFile, 'utf8');

  // URUTAN DUA LANGKAH INI PENTING DAN MUDAH TERBALIK, jadi disebut terbuka:
  //
  //   1. PENANDA PENGECUALIAN DIBACA DARI TEKS ASLI. Penandanya SENDIRI berupa komentar
  //      (`penjaga-kebocoran:mulai`), jadi membacanya dari teks yang komentarnya sudah
  //      dibuang akan menghapus seluruh pengecualian sekaligus — penjaga langsung menuduh
  //      setiap baris yang selama ini sah.
  //   2. PENYISIRAN dilakukan pada teks yang komentarnya SUDAH dibuang, lewat pembantu
  //      bersama tests/util/tanpaKomentar.ts.
  //
  // Sebelum 27 Agu 2026 berkas ini membuang komentar dengan caranya sendiri:
  // `trimmed.startsWith('//')`. Itu hanya menutup komentar yang berdiri di AWAL baris, dan
  // membiarkan dua bentuk lain lolos: komentar yang MENEMPEL di ujung baris kode, dan baris
  // tengah blok /* ... */ yang tidak diawali bintang. Keduanya persis bentuk yang sudah
  // lima kali membuat penjaga di proyek ini salah tuduh.
  const lines = asli.split('\n');
  const dikecualikan = barisDikecualikan(relFile, lines);
  const barisBersih = tanpaKomentar(asli).split('\n');
  const findings: Finding[] = [];

  barisBersih.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (dikecualikan.has(lineNo)) return;

    const trimmed = line.trim();
    if (trimmed.startsWith('import ')) return;
    if (/\.(from|select|eq|order|rpc|insert|update|delete|upsert)\(/.test(line)) return;
    if (/^return \{/.test(trimmed)) return; // objek JS biasa, bukan JSX
    if (/^set[A-Z]\w*\(\{/.test(trimmed)) return; // setState(objek), bukan JSX

    for (const field of RISKY_FIELDS) {
      const re = new RegExp(`\\{[^{}]*\\.${field}\\b[^{}]*\\}`, 'g');
      if (!re.test(line)) continue;

      // Perbandingan (=== / !==) langsung setelah field -- cabang logika, bukan render mentah.
      const comparisonRe = new RegExp(`\\.${field}\\b\\s*(===|!==)`);
      if (comparisonRe.test(line)) continue;

      const lower = line.toLowerCase();
      if (SAFE_MARKERS.some((m) => lower.includes(m))) continue;

      // <Select value={...}> -- value cuma state kontrol; teks yang tampil datang dari
      // SelectItem/children (biasanya sudah lewat label map), sering di baris terpisah.
      //
      // DIPERBAIKI 25 Agu 2026 setelah pengawas ini MENUDUH SALAH untuk ketiga kalinya.
      // Versi lama mencari teks "<select" di dalam jendela TIGA BARIS ke atas. Dua hal
      // membuatnya meleset sekaligus, dan keduanya lahir dari migrasi Carbon:
      //   1. komponennya kini diimpor dengan nama lain (`<CarbonSelect>`), yang TIDAK
      //      mengandung substring "<select";
      //   2. `labelText` sekarang berisi JSX berbaris-baris (LabelBantuan), jadi pembuka
      //      elemennya jauh lebih dari tiga baris di atas `value={...}`.
      // Yang benar bukan memperlebar jendelanya (itu justru menutupi kebocoran sungguhan),
      // melainkan mencari PEMBUKA ELEMEN TERDEKAT ke atas, lalu menilai elemen ITU.
      if (/\bvalue=\{/.test(line)) {
        // Elemen pemilik sebuah atribut selalu ditulis pada lekukan yang LEBIH DANGKAL
        // daripada atributnya. Syarat itulah yang membedakan `<CarbonSelect` (pemilik) dari
        // `<LabelBantuan` yang kebetulan lewat di antaranya sebagai isi prop `labelText`.
        const lekukan = (t: string) => t.length - t.trimStart().length;
        const lekukanAtribut = lekukan(line);
        // Bentuk sebaris: <Select value={...}> -- pemiliknya ada di baris yang sama.
        let pembuka: string | null = /<([A-Za-z][A-Za-z0-9_]*)\b[^<>]*\bvalue=\{/.exec(line)?.[1]?.toLowerCase() ?? null;
        let j = idx - 1;
        while (!pembuka && j >= 0 && idx - j <= 40) {
          const m = /<([A-Za-z][A-Za-z0-9_]*)\b/.exec(lines[j]);
          if (m && lekukan(lines[j]) < lekukanAtribut) { pembuka = m[1].toLowerCase(); break; }
          j -= 1;
        }
        // Kontrol yang teks tampilnya datang dari daftar pilihan, BUKAN dari `value`.
        const PILIHAN = ['select', 'carbonselect', 'dropdown', 'combobox', 'multiselect', 'radiobuttongroup'];
        if (pembuka && PILIHAN.includes(pembuka)) continue;
      }

      // `selectedItem={...}` pada Dropdown/ComboBox/MultiSelect Carbon — nama prop yang
      // berbeda untuk hal yang sama dengan `value` pada <Select>.
      //
      // DITAMBAHKAN 25 Agu 2026 setelah pengawas ini menuduh salah untuk KELIMA kalinya,
      // dan syaratnya SENGAJA lebih ketat daripada sekadar mengecualikan nama komponen:
      // ia hanya dianggap aman bila elemen yang sama juga menyediakan `itemToString`.
      //
      // Alasannya bisa gagal, dan itu yang membuatnya bernilai: TANPA `itemToString`,
      // Carbon merender isi `selectedItem` APA ADANYA — dan kecurigaan pengawas ini justru
      // BENAR. Mengecualikan berdasarkan nama komponen saja akan menutupi kasus itu.
      if (/\bselectedItem=\{|\binitialSelectedItem=\{/.test(line)) {
        const lekukan = (t: string) => t.length - t.trimStart().length;
        const lekukanAtribut = lekukan(line);
        let awalElemen = -1;
        for (let j = idx - 1; j >= 0 && idx - j <= 40; j -= 1) {
          if (/<([A-Za-z][A-Za-z0-9_]*)\b/.test(lines[j]) && lekukan(lines[j]) < lekukanAtribut) {
            awalElemen = j;
            break;
          }
        }
        if (awalElemen >= 0) {
          // Blok prop elemen itu: dari pembukanya sampai penutup `/>` atau `>` pertama pada
          // lekukan yang sama atau lebih dangkal.
          let akhirElemen = awalElemen;
          for (let j = awalElemen; j < lines.length && j - awalElemen <= 60; j += 1) {
            akhirElemen = j;
            if (/\/>|^\s*>/.test(lines[j]) && j > awalElemen) break;
          }
          const blok = lines.slice(awalElemen, akhirElemen + 1).join(' ');
          if (blok.includes('itemToString')) continue;
        }
      }

      // Payload yang dikirim ke server (JSON.stringify(...)) -- bukan JSX, sering multi-baris.
      const wideWindow = lines.slice(Math.max(0, idx - 8), idx + 1).join(' ').toLowerCase();
      if (wideWindow.includes('json.stringify(')) continue;

      findings.push({ file: relFile, line: lineNo, field, text: trimmed });
    }
  });

  return findings;
}

function scanRepo(repoRoot: string): Finding[] {
  const files = [
    ...listPageFiles(join(repoRoot, 'src/features')),
    join(repoRoot, 'src/components/ui/provenance-info-button.tsx')
  ];
  return files.flatMap((f) => scanFileForRawLeaks(f, repoRoot));
}

describe('Pengawas kebocoran identifier mentah di UI (penutupan Sesi 6, 21 Agu 2026)', () => {
  it('seluruh halaman aplikasi (src/features/**/pages + ProvenanceInfoButton) NOL kebocoran field berisiko di luar pengecualian eksplisit', () => {
    const findings = scanRepo(ROOT);
    if (findings.length > 0) {
      const message = findings.map((f) => `${f.file}:${f.line} [field: ${f.field}] -> ${f.text}`).join('\n');
      throw new Error(`Ditemukan ${findings.length} kebocoran identifier mentah:\n${message}`);
    }
    expect(findings).toHaveLength(0);
  });

  describe('bukti negatif -- pengawas ini TERBUKTI BISA gagal (bukan selalu hijau tanpa arti)', () => {
    const fixtureDir = join(ROOT, 'tests', '__leak_watchdog_fixture__', 'pages');
    const fixtureFile = join(fixtureDir, 'FixturePage.tsx');

    afterAll(() => {
      rmSync(join(ROOT, 'tests', '__leak_watchdog_fixture__'), { recursive: true, force: true });
    });

    it('menanam 1 kebocoran sengaja (status mentah tanpa label map) -> pengawas MENDETEKSI, menyebut file & baris persis', () => {
      mkdirSync(fixtureDir, { recursive: true });
      const leakyContent = [
        "'use client';",
        '',
        'export default function FixturePage({ row }: { row: { status: string } }) {',
        '  return (',
        '    <div>',
        '      <span>{row.status}</span>',
        '    </div>',
        '  );',
        '}',
        ''
      ].join('\n');
      writeFileSync(fixtureFile, leakyContent, 'utf8');

      const findings = scanFileForRawLeaks(fixtureFile, ROOT);
      expect(findings.length).toBeGreaterThan(0);
      const hit = findings.find((f) => f.field === 'status');
      expect(hit).toBeDefined();
      expect(hit!.line).toBe(6); // baris persis "{row.status}" di fixture di atas
      expect(hit!.text).toContain('row.status');

      // Cabut lagi -- kebocoran ini SENGAJA ditanam untuk uji, bukan bug sungguhan.
      rmSync(join(ROOT, 'tests', '__leak_watchdog_fixture__'), { recursive: true, force: true });
    });

    it('baris yang SAMA tapi sudah lewat label map (COMMON_STATUS_LABELS[...] ?? row.status) -> pengawas TIDAK salah tuduh', () => {
      mkdirSync(fixtureDir, { recursive: true });
      const safeContent = [
        "'use client';",
        "import { COMMON_STATUS_LABELS } from '@/lib/glossary';",
        '',
        'export default function FixturePage({ row }: { row: { status: string } }) {',
        '  return (',
        '    <div>',
        '      <span>{COMMON_STATUS_LABELS[row.status] ?? row.status}</span>',
        '    </div>',
        '  );',
        '}',
        ''
      ].join('\n');
      writeFileSync(fixtureFile, safeContent, 'utf8');

      const findings = scanFileForRawLeaks(fixtureFile, ROOT);
      expect(findings).toHaveLength(0);
    });
  });
});
