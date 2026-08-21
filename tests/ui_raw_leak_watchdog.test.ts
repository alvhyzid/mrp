import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
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
type Exception = { file: string; from: number; to: number; reason: string };
const EXCEPTIONS: Exception[] = [
  {
    file: 'src/components/ui/provenance-info-button.tsx',
    from: 211,
    to: 239,
    reason: 'Panel "Detail Teknis" (Sesi 6, 6.4) -- sengaja tetap menampilkan identifier mentah, HANYA dirender kalau useIsCompanyAdmin() true.'
  },
  {
    file: 'src/features/kamus/pages/KamusPage.tsx',
    from: 363,
    to: 379,
    reason: 'Toggle "Detail Teknis" per kartu Kamus (Sesi 6, 6.4) -- sengaja tetap menampilkan term_key/ai_draft mentah, HANYA dirender kalau useIsCompanyAdmin() true.'
  },
  {
    file: 'src/features/mrp/pages/ShipmentsPage.tsx',
    from: 839,
    to: 839,
    reason: 'signerRole diteruskan sebagai prop ke <SuratJalanPreview>, yang punya peta roleLabels sendiri di dalam komponennya. Dibuktikan lewat verifikasi visual (bukti c, penutupan Sesi 6): surat jalan tercetak sungguhan tidak mengandung slug peran mentah di mana pun.'
  }
];

type Finding = { file: string; line: number; field: string; text: string };

function isExcepted(exceptions: Exception[], relFile: string, lineNo: number): boolean {
  return exceptions.some((e) => e.file === relFile && lineNo >= e.from && lineNo <= e.to);
}

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

function scanFileForRawLeaks(absFile: string, repoRoot: string, exceptions: Exception[]): Finding[] {
  const relFile = relative(repoRoot, absFile);
  const lines = readFileSync(absFile, 'utf8').split('\n');
  const findings: Finding[] = [];

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (isExcepted(exceptions, relFile, lineNo)) return;

    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
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
      const narrowWindow = lines.slice(Math.max(0, idx - 3), idx + 1).join(' ').toLowerCase();
      if (narrowWindow.includes('<select')) continue;

      // Payload yang dikirim ke server (JSON.stringify(...)) -- bukan JSX, sering multi-baris.
      const wideWindow = lines.slice(Math.max(0, idx - 8), idx + 1).join(' ').toLowerCase();
      if (wideWindow.includes('json.stringify(')) continue;

      findings.push({ file: relFile, line: lineNo, field, text: trimmed });
    }
  });

  return findings;
}

function scanRepo(repoRoot: string, exceptions: Exception[]): Finding[] {
  const files = [
    ...listPageFiles(join(repoRoot, 'src/features')),
    join(repoRoot, 'src/components/ui/provenance-info-button.tsx')
  ];
  return files.flatMap((f) => scanFileForRawLeaks(f, repoRoot, exceptions));
}

describe('Pengawas kebocoran identifier mentah di UI (penutupan Sesi 6, 21 Agu 2026)', () => {
  it('seluruh halaman aplikasi (src/features/**/pages + ProvenanceInfoButton) NOL kebocoran field berisiko di luar pengecualian eksplisit', () => {
    const findings = scanRepo(ROOT, EXCEPTIONS);
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

      const findings = scanFileForRawLeaks(fixtureFile, ROOT, []);
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

      const findings = scanFileForRawLeaks(fixtureFile, ROOT, []);
      expect(findings).toHaveLength(0);
    });
  });
});
