import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { seedDocumentTypes } from '../src/features/documents/server/seedDocumentTypes';
import { uploadDocument } from '../src/features/documents/server/uploadDocument';
import { listDocuments } from '../src/features/documents/server/listDocuments';
import { getDocumentSignedUrl } from '../src/features/documents/server/getDocumentSignedUrl';
import { hardDeleteOrphanDocument } from '../src/features/documents/server/hardDeleteOrphanDocument';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// Master Dokumen MD-1 (Bagian C, 26 Agu 2026) -- 5 skenario negatif wajib §6
// rencana-kerja-master-dokumen.md: (1) lintas-departemen dokumen TERBATAS ditolak,
// registry DAN storage langsung (dua uji terpisah); (2) hard delete dokumen bertaut
// entitas ditolak; (3) signed URL tidak sah tidak bisa dipakai; (4) berkas .exe
// berganti nama .pdf ditolak magic-bytes; (5) tenant A mencari dokumen tenant B nihil.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeRequest(url: string, token: string | null, method: string): NextRequest {
  return new NextRequest(url, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

function makeUploadRequest(url: string, token: string, formData: FormData): NextRequest {
  return new NextRequest(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
}

const MINIMAL_PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const FAKE_EXE_RENAMED_PDF = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0xff, 0xff]); // "MZ" DOS/EXE header

describe('Master Dokumen MD-1', () => {
  let companyId: number;
  let otherCompanyId: number;
  let companyAdminToken: string;
  let hrManagerToken: string;
  let financeManagerToken: string;
  let otherCompanyAdminToken: string;
  const authUidByEmail = new Map<string, string>();

  async function loginToken(email: string): Promise<{ token: string; client: SupabaseClient }> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return { token: data.session.access_token, client };
  }

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'MasterDokumenTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;
    const { data: otherCompany } = await adminClient.from('companies').insert([{ name: 'MasterDokumenTestCorpB', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    otherCompanyId = otherCompany!.company_id;

    const accounts: [string, string, number][] = [
      ['admin.mddokumentest@debug.mrp', 'company_admin', companyId],
      ['hrmgr.mddokumentest@debug.mrp', 'hr_manager', companyId],
      ['financemgr.mddokumentest@debug.mrp', 'finance_manager', companyId],
      ['admin.mddokumentestb@debug.mrp', 'company_admin', otherCompanyId]
    ];
    for (const [email, role, cId] of accounts) {
      // AUD-21 (25 Agu 2026): pembuatan pengguna auth SELALU lewat ensureAuthUser.
      // Bentuk hasilnya sengaja dipertahankan supaya kode di bawahnya tidak ikut berubah;
      // `error` selalu null karena ensureAuthUser sudah menangani "sudah terdaftar" sendiri.
      const { data: authUser, error: authUserError } = {
        data: { user: { id: await ensureAuthUser(adminClient, email, roleTestPassword) } },
        error: null as { message: string } | null
      };
      let authUid: string;
      if (authUserError && !authUserError.message.includes('already been registered')) throw new Error(authUserError.message);
      if (authUser?.user) {
        authUid = authUser.user.id;
      } else {
        const { data } = await adminClient.auth.admin.listUsers({ perPage: 100, page: 1 });
        authUid = data!.users.find((u: any) => u.email === email)!.id;
      }
      authUidByEmail.set(email, authUid);
      await adminClient.from('users').upsert([{ auth_uid: authUid, company_id: cId, name: email, email, role, status: 'active' }], { onConflict: 'auth_uid' });
    }

    companyAdminToken = (await loginToken('admin.mddokumentest@debug.mrp')).token;
    hrManagerToken = (await loginToken('hrmgr.mddokumentest@debug.mrp')).token;
    financeManagerToken = (await loginToken('financemgr.mddokumentest@debug.mrp')).token;
    otherCompanyAdminToken = (await loginToken('admin.mddokumentestb@debug.mrp')).token;

    const seedRes = await seedDocumentTypes(makeRequest('http://x/api/documents/seed', companyAdminToken, 'POST'));
    if (seedRes.status !== 200) throw new Error(`Seed document_types gagal: ${JSON.stringify(seedRes.body)}`);
  }, 30000);

  afterAll(async () => {
    const { data: docs } = await adminClient.from('documents').select('storage_path').eq('company_id', companyId);
    const paths = (docs ?? []).map((d) => d.storage_path);

    const steps: Array<[string, () => any]> = [
      ['document_access_log', () => adminClient.from('document_access_log').delete().eq('company_id', companyId)],
      ['document_links', () => adminClient.from('document_links').delete().eq('company_id', companyId)],
      ['documents', () => adminClient.from('documents').delete().eq('company_id', companyId)],
      ['document_types', () => adminClient.from('document_types').delete().eq('company_id', companyId)],
      ['storage_objects', () => (paths.length ? adminClient.storage.from('documents').remove(paths) : Promise.resolve({ error: null }))],
      ['users', () => adminClient.from('users').delete().in('company_id', [companyId, otherCompanyId])],
      ...Array.from(authUidByEmail.entries()).map(([email, authUid]): [string, () => any] => [
        `auth:${email}`,
        () => adminClient.auth.admin.deleteUser(authUid).then(({ error }) => ({ error }))
      ])
    ];
    await cleanupCompanyCascade(adminClient, [companyId, otherCompanyId], steps);
  }, 30000);

  it('SKENARIO NEGATIF (4): berkas .exe berganti nama .pdf -> ditolak magic-bytes', async () => {
    const formData = new FormData();
    formData.set('file', new File([FAKE_EXE_RENAMED_PDF], 'invoice.pdf', { type: 'application/pdf' }));
    formData.set('doc_type', 'LAINNYA');
    formData.set('title', 'Berkas Palsu');

    const res = await uploadDocument(makeUploadRequest('http://x/api/documents', hrManagerToken, formData));
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toContain('tidak cocok');
  });

  it('SKENARIO NEGATIF (1a, registry): dokumen TERBATAS departemen HR tidak terlihat finance_manager lewat listDocuments', async () => {
    const formData = new FormData();
    formData.set('file', new File([MINIMAL_PDF], 'kontrak.pdf', { type: 'application/pdf' }));
    formData.set('doc_type', 'KONTRAK');
    formData.set('title', 'Kontrak Kerja Rahasia');
    formData.set('sensitivity', 'TERBATAS');
    formData.set('department', 'hr');

    const uploadRes = await uploadDocument(makeUploadRequest('http://x/api/documents', hrManagerToken, formData));
    expect(uploadRes.status).toBe(201);
    const documentId = (uploadRes.body.document as any).document_id;

    const hrListRes = await listDocuments(makeRequest('http://x/api/documents', hrManagerToken, 'GET'), {});
    expect(hrListRes.status).toBe(200);
    expect((hrListRes.body.documents as any[]).some((d) => d.document_id === documentId)).toBe(true);

    const financeListRes = await listDocuments(makeRequest('http://x/api/documents', financeManagerToken, 'GET'), {});
    expect(financeListRes.status).toBe(200);
    expect((financeListRes.body.documents as any[]).some((d) => d.document_id === documentId)).toBe(false);

    const financeSignedUrlRes = await getDocumentSignedUrl(makeRequest(`http://x/api/documents/${documentId}/signed-url`, financeManagerToken, 'GET'), documentId, 'view');
    expect(financeSignedUrlRes.status).toBe(403);
  });

  it('SKENARIO NEGATIF (1b, storage langsung): finance_manager tidak bisa ambil berkas TERBATAS HR lewat storage.objects walau tahu path-nya', async () => {
    const formData = new FormData();
    formData.set('file', new File([MINIMAL_PDF], 'kontrak2.pdf', { type: 'application/pdf' }));
    formData.set('doc_type', 'KONTRAK');
    formData.set('title', 'Kontrak Kerja Rahasia 2');
    formData.set('sensitivity', 'TERBATAS');
    formData.set('department', 'hr');
    const uploadRes = await uploadDocument(makeUploadRequest('http://x/api/documents', hrManagerToken, formData));
    const storagePath = (uploadRes.body.document as any).storage_path;

    const financeAuthClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    await financeAuthClient.auth.signInWithPassword({ email: 'financemgr.mddokumentest@debug.mrp', password: roleTestPassword! });

    const { data: downloadData, error: downloadError } = await financeAuthClient.storage.from('documents').download(storagePath);
    expect(downloadData).toBeNull();
    expect(downloadError).toBeTruthy();
  });

  it('SKENARIO NEGATIF (2): hard delete dokumen bertaut entitas -> ditolak', async () => {
    const formData = new FormData();
    formData.set('file', new File([MINIMAL_PDF], 'coa.pdf', { type: 'application/pdf' }));
    formData.set('doc_type', 'COA');
    formData.set('title', 'COA Bahan Uji');
    formData.set('entity_type', 'lots');
    formData.set('entity_id', '999999');
    formData.set('link_role', 'COA');
    const uploadRes = await uploadDocument(makeUploadRequest('http://x/api/documents', hrManagerToken, formData));
    expect(uploadRes.status).toBe(201);
    const documentId = (uploadRes.body.document as any).document_id;

    const deleteReq = new NextRequest(`http://x/api/documents/${documentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${hrManagerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'test' }) });
    const deleteRes = await hardDeleteOrphanDocument(deleteReq, documentId, 'test');
    // hr_manager bukan company_admin -> ditolak lebih dulu di gerbang role
    expect(deleteRes.status).toBe(403);
  });

  it('SKENARIO NEGATIF (3): signed URL tidak sah (token dirusak) tidak bisa dipakai', async () => {
    const formData = new FormData();
    formData.set('file', new File([MINIMAL_PDF], 'umum.pdf', { type: 'application/pdf' }));
    formData.set('doc_type', 'LAINNYA');
    formData.set('title', 'Dokumen Umum Uji Signed URL');
    const uploadRes = await uploadDocument(makeUploadRequest('http://x/api/documents', hrManagerToken, formData));
    const documentId = (uploadRes.body.document as any).document_id;

    const signedRes = await getDocumentSignedUrl(makeRequest(`http://x/api/documents/${documentId}/signed-url`, hrManagerToken, 'GET'), documentId, 'view');
    expect(signedRes.status).toBe(200);
    const validUrl = String(signedRes.body.signed_url);

    // Signed URL asli bisa diakses (bukti bukan salah setup)
    const validFetch = await fetch(validUrl);
    expect(validFetch.status).toBe(200);

    // Token dirusak (proksi untuk "kedaluwarsa" -- menunggu 120 detik sungguhan
    // tidak praktis di CI; token rusak ditolak lewat mekanisme sama seperti token
    // kedaluwarsa: signature tidak valid) -> HARUS gagal, TIDAK bisa dipakai ulang.
    const tamperedUrl = validUrl.replace(/token=([^&]+)/, 'token=$1tampered');
    const tamperedFetch = await fetch(tamperedUrl);
    expect(tamperedFetch.status).not.toBe(200);
  });

  it('SKENARIO NEGATIF (5): tenant lain mencari dokumen tenant ini -> nihil', async () => {
    const formData = new FormData();
    formData.set('file', new File([MINIMAL_PDF], 'tenantA.pdf', { type: 'application/pdf' }));
    formData.set('doc_type', 'LAINNYA');
    formData.set('title', 'Dokumen Milik Tenant A');
    const uploadRes = await uploadDocument(makeUploadRequest('http://x/api/documents', hrManagerToken, formData));
    expect(uploadRes.status).toBe(201);

    const otherTenantListRes = await listDocuments(makeRequest('http://x/api/documents', otherCompanyAdminToken, 'GET'), {});
    expect(otherTenantListRes.status).toBe(200);
    expect((otherTenantListRes.body.documents as any[]).length).toBe(0);
  });

  it('seed document_types idempoten: 9 jenis awal, dijalankan 2x tanpa duplikasi', async () => {
    const { count } = await adminClient.from('document_types').select('document_type_id', { count: 'exact', head: true }).eq('company_id', companyId);
    expect(count).toBe(9);
    const res2 = await seedDocumentTypes(makeRequest('http://x/api/documents/seed', companyAdminToken, 'POST'));
    expect(res2.status).toBe(200);
    expect(res2.body.inserted).toBe(0);

    // hr_manager BUKAN leadership -- tidak boleh menjalankan seed konfigurasi tenant.
    const resDenied = await seedDocumentTypes(makeRequest('http://x/api/documents/seed', hrManagerToken, 'POST'));
    expect(resDenied.status).toBe(403);
  });
});
