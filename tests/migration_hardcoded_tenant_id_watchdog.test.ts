import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tanpaKomentarSql } from './util/tanpaKomentar';
import { join, relative } from 'path';

// II.2 (22 Agu 2026) — pengawas permanen untuk kelas bug yang ditemukan lewat
// insiden CI merah 10 commit (root cause: migrasi build_tasks menulis
// `company_id = 1` (literal) TANPA pengaman "lewati bila perusahaan belum
// ada" — lolos di `db push` (database sudah berisi company_id=1 sejak
// scripts/seed-realcase-itm.js), gagal KERAS di rebuild dari nol/CI karena
// tabel companies masih kosong di titik migrasi itu jalan). Perbaikan kasus
// (10 file) ada di migrasi 20260827605000 dst — pengawas ini menutup KELAS-nya
// supaya migrasi BERIKUTNYA yang melakukan kesalahan sama tertangkap di sini,
// bukan baru ketahuan di CI lagi.
//
// Pola AMAN yang dituntut (sudah dipakai konsisten sejak
// 20260827340000_build_tasks_seed_history.sql): cari company_id lewat
// `select company_id into v_company_id from companies where name = '...'`,
// dan no-op (skip, raise notice) kalau belum ketemu. Pengawas ini TIDAK
// menuntut kata `v_company_id` persis — yang dilarang adalah literal angka
// bulat sebagai nilai company_id di baris VALUES sebuah insert ke tabel
// SELAIN `companies` sendiri (root tenant company_id=1 punya migrasi
// pengaman tersendiri, 20260827605000, dengan ON CONFLICT DO NOTHING —
// pola itu, bukan pola "skip bila belum ada", karena memang migrasi itulah
// yang MEMBUAT baris company pertama).
//
// KETERBATASAN JUJUR: heuristik teks per pola VALUES, bukan parser SQL
// penuh. Insert dinamis (`insert into x (company_id, ...) select ... from
// ...`) otomatis aman (tidak ada `values` literal). Insert ke tabel
// `companies` sendiri dikecualikan (lihat alasan di atas).

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

type Violation = { file: string; table: string; line: number; literal: string };

// Cari akhir statement SQL (titik-koma paling luar, DI LUAR string berkutip
// tunggal) mulai dari startIdx — supaya jendela pencarian sebuah insert tidak
// pernah bocor ke statement SQL berikutnya (mis. `create table` di baris
// setelahnya), termasuk untuk insert satu-baris yang titik-koma-nya di baris
// yang sama dengan `values (...)`, bukan cuma pola `\n);`.
function findStatementEnd(content: string, startIdx: number): number {
  let inString = false;
  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];
    if (ch === "'") {
      if (inString && content[i + 1] === "'") {
        i++; // escaped '' di dalam string, bukan penutup.
        continue;
      }
      inString = !inString;
    } else if (ch === ';' && !inString) {
      return i;
    }
  }
  return content.length - 1;
}

// Ambil field PERTAMA (posisi company_id) dari tiap tuple `(...)` tingkat
// atas dalam sebuah klausa VALUES, sadar-kutip dan sadar-kurung-bersarang --
// supaya angka di DALAM string literal (mis. teks "(5,00 g)" pada catatan
// bebas) atau di dalam array['x','y'] TIDAK ikut kesalahdeteksi sebagai
// company_id. Berhenti begitu tuple tidak diikuti koma (mis. sudah sampai
// "on conflict ..." atau akhir statement).
function extractFirstFieldsOfTuples(
  content: string,
  start: number,
  end: number
): { value: string; index: number }[] {
  const results: { value: string; index: number }[] = [];
  let i = start;
  while (i < end) {
    while (i < end && /\s/.test(content[i])) i++;
    if (content[i] !== '(') break;
    i++;
    let depth = 1;
    let inString = false;
    const fieldStart = i;
    let fieldEnd = -1;
    while (i < end && depth > 0) {
      const ch = content[i];
      if (ch === "'") {
        if (inString && content[i + 1] === "'") {
          i += 2;
          continue;
        }
        inString = !inString;
        i++;
        continue;
      }
      if (!inString) {
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) {
            if (fieldEnd === -1) fieldEnd = i;
            break;
          }
        } else if (ch === ',' && depth === 1 && fieldEnd === -1) {
          fieldEnd = i;
        }
      }
      i++;
    }
    if (fieldEnd === -1) fieldEnd = i;
    const raw = content.slice(fieldStart, fieldEnd);
    const leadingWs = raw.match(/^\s*/)?.[0].length ?? 0;
    results.push({ value: raw.trim(), index: fieldStart + leadingWs });
    i++; // lewati ')'
    while (i < end && /\s/.test(content[i])) i++;
    if (content[i] === ',') {
      i++;
      continue;
    }
    break;
  }
  return results;
}

function scanMigrationsDir(dir: string): Violation[] {
  const violations: Violation[] = [];
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.sql'));
  } catch {
    return violations;
  }

  const headerRe = /insert\s+into\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*company_id\b/gi;

  for (const file of files) {
    const path = join(dir, file);
    // KOMENTAR SQL DIBUANG LEBIH DULU (AUD-42, 27 Agu 2026), lewat varian SQL pembantu
    // bersama — BUKAN varian JavaScript. Komentar SQL memakai `--`, yang tidak dikenal
    // varian JavaScript sama sekali; memakainya di sini akan terasa seperti perlindungan
    // padahal bentuk komentar yang paling lazim di migrasi dibiarkan utuh.
    //
    // Yang ditutup: migrasi yang MENJELASKAN pola terlarang di dalam komentarnya —
    // dan berkas migrasi di proyek ini memang panjang komentarnya. Yang TIDAK ditutup:
    // badan $mig$ ... $mig$ SENGAJA tetap disisir (lihat catatan di berkas pembantunya),
    // sebab hampir seluruh isi migrasi ini hidup di dalamnya.
    //
    // Panjang teks dipertahankan pembantu itu, jadi hitungan nomor baris di bawah
    // (`content.slice(0, f.index).split('\n').length`) tetap menunjuk baris yang benar.
    const content = tanpaKomentarSql(readFileSync(path, 'utf8'));

    let headerMatch: RegExpExecArray | null;
    headerRe.lastIndex = 0;
    while ((headerMatch = headerRe.exec(content)) !== null) {
      const table = headerMatch[1];
      if (table.toLowerCase() === 'companies') continue; // root tenant bootstrap — pola beda, lihat komentar atas.

      const headerEnd = headerRe.lastIndex;
      const statementEnd = findStatementEnd(content, headerEnd);

      const segment = content.slice(headerEnd, statementEnd);
      const valuesRelIdx = segment.search(/\bvalues\b/i);
      if (valuesRelIdx === -1) continue; // insert ... select ... — dinamis, aman.

      const tuplesStart = headerEnd + valuesRelIdx + 'values'.length;
      const fields = extractFirstFieldsOfTuples(content, tuplesStart, statementEnd);
      for (const f of fields) {
        if (/^\d+$/.test(f.value)) {
          const line = content.slice(0, f.index).split('\n').length;
          violations.push({ file, table, line, literal: f.value });
        }
      }
    }
  }

  return violations;
}

describe('Pengawas company_id hardcode di migrasi (II.2, 22 Agu 2026)', () => {
  it('tidak ada migrasi yang menulis company_id literal tanpa pengaman "lewati bila perusahaan belum ada"', () => {
    const violations = scanMigrationsDir(MIGRATIONS_DIR);
    if (violations.length > 0) {
      const message = violations
        .map((v) => `${v.file}:${v.line} -- insert ke "${v.table}" pakai company_id literal = ${v.literal}`)
        .join('\n');
      throw new Error(
        `Ditemukan ${violations.length} migrasi dengan company_id hardcode TANPA pengaman:\n${message}\n\n` +
          `Perbaikan: bungkus insert dalam blok "do $$ ... select company_id into v_company_id from companies where name = '...'; if v_company_id is null then raise notice ...; return; end if; ... end $$;" (lihat 20260827610000 atau 20260827605000/HANDOFF.md untuk pola persis).`
      );
    }
    expect(violations).toHaveLength(0);
  });

  describe('bukti negatif — pengawas ini TERBUKTI BISA gagal (bukan selalu hijau tanpa arti)', () => {
    const fixtureDir = join(__dirname, '__migration_guard_fixture__');
    const fixtureFile = join(fixtureDir, '99999999999999_percobaan_pelanggaran.sql');

    afterAll(() => {
      rmSync(fixtureDir, { recursive: true, force: true });
    });

    it('menanam 1 migrasi percobaan dengan company_id = 1 literal tanpa pengaman -> pengawas MENDETEKSI, menyebut file & baris persis', () => {
      mkdirSync(fixtureDir, { recursive: true });
      const violatingContent = [
        '-- Migrasi PERCOBAAN (sengaja melanggar) untuk membuktikan pengawas II.2 bisa merah.',
        'insert into public.build_tasks',
        '  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, origin)',
        'values (',
        "  1, 'ZZZ-99', 'Percobaan Pelanggaran', 'ZZZ', 'Percobaan',",
        "  'deskripsi', 'efek', 'bisa_menunggu', array['Fungsi'], 'Claude Code', 'menunggu', 'temuan_claude'",
        ');',
        ''
      ].join('\n');
      writeFileSync(fixtureFile, violatingContent, 'utf8');

      const violations = scanMigrationsDir(fixtureDir);
      expect(violations.length).toBe(1);
      expect(violations[0].table).toBe('build_tasks');
      expect(violations[0].literal).toBe('1');
      expect(violations[0].line).toBe(5); // baris persis "  1, 'ZZZ-99',"
      expect(relative(fixtureDir, join(fixtureDir, violations[0].file))).toBe(
        '99999999999999_percobaan_pelanggaran.sql'
      );

      // Cabut lagi -- migrasi ini SENGAJA ditanam untuk uji, bukan migrasi sungguhan.
      rmSync(fixtureDir, { recursive: true, force: true });
    });

    it('pola AMAN (do $$ ... v_company_id ... end $$) dengan angka DI DALAM STRING/komentar tidak salah tuduh', () => {
      mkdirSync(fixtureDir, { recursive: true });
      const safeContent = [
        'do $$',
        'declare',
        '  v_company_id integer;',
        'begin',
        "  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;",
        '  if v_company_id is null then',
        "    raise notice 'lewati';",
        '    return;',
        '  end if;',
        '',
        'insert into public.build_tasks',
        '  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, origin)',
        'values (',
        "  v_company_id, 'ZZZ-98', 'Percobaan Aman 1 hari', 'ZZZ', 'Percobaan',",
        "  'deskripsi', 'efek', 'bisa_menunggu', array['Fungsi'], 'Claude Code', 'menunggu', 'temuan_claude'",
        ');',
        '',
        'end $$;',
        ''
      ].join('\n');
      writeFileSync(fixtureFile, safeContent, 'utf8');

      const violations = scanMigrationsDir(fixtureDir);
      expect(violations).toHaveLength(0);

      rmSync(fixtureDir, { recursive: true, force: true });
    });

    // DITAMBAHKAN 27 Agu 2026 (AUD-42 batch B-01). Uji di atas BERJUDUL "STRING/komentar"
    // tapi fixture-nya tidak memuat satu pun komentar SQL — jadi kelas ini belum pernah
    // benar-benar diuji. Dibuktikan dua arah saat ditambahkan: sebelum pengawas memakai
    // pembuang komentar SQL, kasus ini MERAH; sesudahnya HIJAU.
    it('pelanggaran yang ditulis DI DALAM komentar SQL (--) tidak salah tuduh', () => {
      mkdirSync(fixtureDir, { recursive: true });
      const isiKomentar = [
        '-- Migrasi ini MENJELASKAN pola yang dilarang, tanpa menjalankannya:',
        "--   insert into public.build_tasks (company_id, task_code) values (1, 'ZZZ-97');",
        '-- Penjelasan seperti ini lazim di migrasi proyek ini, dan bukan pelanggaran.',
        'select 1;',
        ''
      ].join('\n');
      writeFileSync(fixtureFile, isiKomentar, 'utf8');

      expect(scanMigrationsDir(fixtureDir)).toHaveLength(0);

      rmSync(fixtureDir, { recursive: true, force: true });
    });

    it('pelanggaran yang sama DI LUAR komentar tetap terdeteksi — bukti arah sebaliknya', () => {
      mkdirSync(fixtureDir, { recursive: true });
      const isiKode = [
        '-- Migrasi ini benar-benar menjalankannya:',
        "insert into public.build_tasks (company_id, task_code) values (1, 'ZZZ-97');",
        ''
      ].join('\n');
      writeFileSync(fixtureFile, isiKode, 'utf8');

      const pelanggaran = scanMigrationsDir(fixtureDir);
      expect(pelanggaran).toHaveLength(1);
      expect(pelanggaran[0].literal).toBe('1');
      expect(pelanggaran[0].line).toBe(2);

      rmSync(fixtureDir, { recursive: true, force: true });
    });

    it('insert dinamis (insert ... select, tanpa values literal) ke tabel non-companies tidak salah tuduh', () => {
      mkdirSync(fixtureDir, { recursive: true });
      const dynamicContent = [
        'insert into public.stock_movements (company_id, lot_id, movement_type, qty)',
        'select company_id, lot_id, 1, qty from some_source_table;',
        ''
      ].join('\n');
      writeFileSync(fixtureFile, dynamicContent, 'utf8');

      const violations = scanMigrationsDir(fixtureDir);
      expect(violations).toHaveLength(0);

      rmSync(fixtureDir, { recursive: true, force: true });
    });

    it('insert literal ke tabel companies sendiri (root tenant bootstrap) dikecualikan dengan sengaja', () => {
      mkdirSync(fixtureDir, { recursive: true });
      const bootstrapContent = [
        'insert into public.companies (company_id, name, industry_type, status)',
        "values (1, 'PT ITM', 'manufacturing', 'trial')",
        'on conflict (company_id) do nothing;',
        ''
      ].join('\n');
      writeFileSync(fixtureFile, bootstrapContent, 'utf8');

      const violations = scanMigrationsDir(fixtureDir);
      expect(violations).toHaveLength(0);

      rmSync(fixtureDir, { recursive: true, force: true });
    });
  });
});
