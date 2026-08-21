import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Seed awal §2 rencana-kerja-master-dokumen.md -- konfigurasi PER TENANT (tabel
// document_types), jadi menambah/mengubah jenis nanti TIDAK membongkar apa pun.
// Jawaban pemilik produk untuk "daftar jenis dokumen" (§7.1) belum final -- ini
// default sementara, ditandai di HANDOFF.md untuk dikoreksi.
const DOCUMENT_TYPES: { code: string; name: string; owner_role: string | null; sensitivity_default: string; requires_expiry: boolean }[] = [
  { code: 'PO_KLIEN', name: 'PO Klien', owner_role: 'ppic', sensitivity_default: 'UMUM', requires_expiry: false },
  { code: 'POD', name: 'Bukti Pengiriman (POD)', owner_role: 'ppic', sensitivity_default: 'UMUM', requires_expiry: false },
  { code: 'SURAT_JALAN', name: 'Surat Jalan', owner_role: 'warehouse', sensitivity_default: 'UMUM', requires_expiry: false },
  { code: 'COA', name: 'COA Bahan (Vendor)', owner_role: 'purchasing', sensitivity_default: 'UMUM', requires_expiry: false },
  { code: 'SERTIFIKAT_HALAL', name: 'Sertifikat Halal Vendor', owner_role: 'purchasing', sensitivity_default: 'UMUM', requires_expiry: true },
  { code: 'SPEC_BAHAN', name: 'Spesifikasi Bahan', owner_role: 'purchasing', sensitivity_default: 'UMUM', requires_expiry: false },
  { code: 'KONTRAK', name: 'Kontrak', owner_role: 'hr', sensitivity_default: 'TERBATAS', requires_expiry: true },
  { code: 'SOP', name: 'SOP Terkendali', owner_role: 'production', sensitivity_default: 'DEPARTEMEN', requires_expiry: false },
  { code: 'LAINNYA', name: 'Lainnya', owner_role: null, sensitivity_default: 'UMUM', requires_expiry: false }
];

export async function seedDocumentTypes(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Hanya Admin Perusahaan atau General Manager yang dapat menjalankan seed jenis dokumen.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const rows = DOCUMENT_TYPES.map((t) => ({
      company_id: appUser.company_id,
      code: t.code,
      name: t.name,
      owner_role: t.owner_role,
      sensitivity_default: t.sensitivity_default,
      requires_expiry: t.requires_expiry,
      reminder_days_before: t.requires_expiry ? [90, 60, 30] : null
    }));

    const { data: inserted, error } = await adminClient.from('document_types').upsert(rows, { onConflict: 'company_id,code', ignoreDuplicates: true }).select('document_type_id');
    if (error) return { status: 500, body: { error: error.message } };

    return { status: 200, body: { inserted: inserted?.length ?? 0, skippedExisting: rows.length - (inserted?.length ?? 0) } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
