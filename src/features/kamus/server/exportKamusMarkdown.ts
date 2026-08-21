import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const SCOPE_TO_FILENAME: Record<string, string> = {
  FIELD: 'istilah.md',
  METRIC: 'metrik.md',
  RELATION: 'relasi.md',
  RULE: 'aturan.md'
};

// Ekspor kamus_terms berstatus DIKONFIRMASI jadi markdown per scope --
// "database adalah tempat kerja; markdown di repo adalah sumber resmi"
// (docs/rencana-modul-kamus-paralel.md §3.6). CATATAN PENTING: endpoint ini
// MENGEMBALIKAN teks markdown (bukan menulis file ke repo langsung) --
// aplikasi Next.js yang di-deploy (Vercel) TIDAK PUNYA akses tulis ke
// filesystem git, apalagi commit otomatis. Alur nyata: admin panggil endpoint
// ini, simpan responsnya sebagai docs/kamus/{istilah,metrik,relasi,aturan}.md,
// commit lewat git seperti biasa -- sama seperti berkas dokumentasi lain di
// proyek ini, bukan proses otomatis.
export async function exportKamusMarkdown(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Hanya Admin Perusahaan atau General Manager yang dapat mengekspor kamus.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const { data: terms, error } = await adminClient
      .from('kamus_terms')
      .select('scope, entity, field, term_key, priority, domain, ai_draft, answer_plain, answer_pitfall, answer_range, confirmed_at')
      .eq('company_id', appUser.company_id)
      .eq('status', 'DIKONFIRMASI')
      .order('scope', { ascending: true })
      .order('term_key', { ascending: true });
    if (error) return { status: 500, body: { error: error.message } };

    const byScope: Record<string, typeof terms> = { FIELD: [], METRIC: [], RELATION: [], RULE: [] };
    for (const term of terms ?? []) {
      (byScope[term.scope] ??= []).push(term);
    }

    const files: Record<string, string> = {};
    for (const [scope, filename] of Object.entries(SCOPE_TO_FILENAME)) {
      const rows = byScope[scope] ?? [];
      const lines: string[] = [
        `# Kamus — ${scope} (diekspor otomatis, ${new Date().toISOString().slice(0, 10)})`,
        '',
        `${rows.length} istilah dikonfirmasi. Sumber kerja: tabel \`kamus_terms\` — jangan edit berkas ini manual, ekspor ulang lewat \`/kamus\` (khusus leadership) begitu ada jawaban baru dikonfirmasi.`,
        ''
      ];
      for (const row of rows) {
        lines.push(`## ${row.term_key}`);
        if (row.entity) lines.push(`- Tabel: \`${row.entity}\`${row.field ? ` · Kolom: \`${row.field}\`` : ''}`);
        lines.push(`- Prioritas: ${row.priority} · Domain: ${row.domain}`);
        lines.push(`- Penjelasan: ${row.answer_plain ?? '-'}`);
        if (row.answer_pitfall) lines.push(`- Kesalahpahaman umum: ${row.answer_pitfall}`);
        if (row.answer_range) lines.push(`- Nilai wajar/mencurigakan: ${row.answer_range}`);
        lines.push(`- Dikonfirmasi: ${row.confirmed_at ?? '-'}`);
        lines.push('');
      }
      files[filename] = lines.join('\n');
    }

    return { status: 200, body: { files, totalConfirmed: terms?.length ?? 0 } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
