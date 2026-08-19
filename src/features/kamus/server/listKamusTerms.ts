import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Antrean Kamus -- SEMUA role internal perusahaan boleh baca (prinsip inti:
// distribusikan pertanyaan ke siapa saja yang tahu, bukan dikunci 1 role).
// Contoh nilai nyata (3 baris per term FIELD) diambil best-effort -- kolom
// bermuatan gaji SUDAH DIKECUALIKAN TOTAL sejak baris backlog dibuat (lihat
// generateKamusBacklog.ts), jadi tidak mungkin nyasar ke sini.
export async function listKamusTerms(
  request: NextRequest,
  filters: { status?: string; priority?: number; domain?: string; assignedToRole?: string }
): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    let query = adminClient.from('kamus_terms').select('*').eq('company_id', appUser.company_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.domain) query = query.eq('domain', filters.domain);
    if (filters.assignedToRole) query = query.eq('assigned_to_role', filters.assignedToRole);
    query = query.order('priority', { ascending: true }).order('term_key', { ascending: true });

    const { data: terms, error } = await query;
    if (error) return { status: 500, body: { error: error.message } };

    return { status: 200, body: { terms: terms ?? [] } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

// Contoh 3 nilai nyata utk 1 term FIELD -- endpoint TERPISAH (dipanggil saat
// kartu pertanyaan dibuka, bukan sekaligus semua) supaya tidak membebani
// query daftar. Best-effort: kalau tabelnya tidak punya company_id langsung
// (mis. bom_lines, terikat lewat boms), gagal senyap -> "belum ada contoh".
export async function getKamusTermSampleValues(request: NextRequest, kamusTermId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }
    const adminClient = getAdminClient();

    const { data: term, error: termError } = await adminClient
      .from('kamus_terms')
      .select('scope, entity, field, company_id')
      .eq('kamus_term_id', kamusTermId)
      .maybeSingle();
    if (termError) return { status: 500, body: { error: termError.message } };
    if (!term || term.company_id !== appUser.company_id) return { status: 404, body: { error: 'Istilah tidak ditemukan.' } };
    if (term.scope !== 'FIELD' || !term.entity || !term.field) {
      return { status: 200, body: { samples: [] } };
    }

    const { data: samples, error: sampleError } = await adminClient
      .from(term.entity)
      .select(term.field)
      .eq('company_id', appUser.company_id)
      .not(term.field, 'is', null)
      .limit(3);

    if (sampleError) {
      // Tabel tanpa company_id langsung, atau kolom tidak bisa di-select apa
      // adanya -- bukan error fatal, cuma berarti belum ada contoh otomatis.
      return { status: 200, body: { samples: [], note: 'Belum ada contoh otomatis untuk tabel ini (kemungkinan tidak punya company_id langsung).' } };
    }

    return { status: 200, body: { samples: samples ?? [] } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
