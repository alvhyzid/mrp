'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isCompanyLeadership } from '@/lib/roles';

type DocumentType = { document_type_id: number; code: string; name: string };

type DocumentRow = {
  document_id: number;
  doc_type: string;
  title: string;
  doc_number: string | null;
  status: string;
  sensitivity: string;
  department: string | null;
  mime_type: string;
  size_bytes: number;
  issued_date: string | null;
  expiry_date: string | null;
  uploaded_at: string;
};

const DEPARTMENTS = ['production', 'ppic', 'finance', 'purchasing', 'warehouse', 'hr', 'management', 'fat', 'rnd'];
const STATUS_LABELS: Record<string, string> = { AKTIF: 'Aktif', KEDALUWARSA: 'Kedaluwarsa', DIARSIP: 'Diarsip', DIGANTI: 'Diganti' };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Master Dokumen MD-1 -- daftar+filter, unggah (lewat uploadDocument.ts terpusat),
// viewer inline PDF/gambar (§4: "dilihat langsung di browser tanpa mengunduh").
// Office (xlsx/docx) v1 = unduh saja, sesuai keputusan pemilik produk.
export default function DocumentsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterDocType, setFilterDocType] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerData, setViewerData] = useState<{ url: string; mime: string; title: string } | null>(null);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadDocuments = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (filterDocType) params.set('doc_type', filterDocType);
    if (filterDepartment) params.set('department', filterDepartment);
    if (filterStatus) params.set('status', filterStatus);
    const response = await fetch(`/api/documents?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || 'Gagal memuat daftar dokumen.');
      setLoading(false);
      return;
    }
    setDocuments(body.documents || []);
    setError('');
    setLoading(false);
  }, [getAccessToken, filterDocType, filterDepartment, filterStatus]);

  const loadDocumentTypes = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const response = await fetch('/api/documents/types', { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json();
    if (response.ok) setDocumentTypes(body.document_types || []);
  }, [getAccessToken]);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/documents');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      setRole(meData?.user?.role ?? null);
      setCheckingAccess(false);
      await Promise.all([loadDocuments(), loadDocumentTypes()]);
    };
    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleSeedDocumentTypes = async () => {
    setSeeding(true);
    setSeedMessage('');
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setSeeding(false);
      return;
    }
    const response = await fetch('/api/documents/seed', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json();
    setSeeding(false);
    if (!response.ok) {
      setSeedMessage(body.error || 'Gagal seed jenis dokumen.');
      return;
    }
    setSeedMessage(`${body.inserted} jenis dokumen baru ditambahkan.`);
    await loadDocumentTypes();
  };

  useEffect(() => {
    if (!checkingAccess) loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDocType, filterDepartment, filterStatus]);

  const handleUpload = async (formEl: HTMLFormElement) => {
    setUploading(true);
    setUploadError('');
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setUploading(false);
      return;
    }
    const formData = new FormData(formEl);
    const response = await fetch('/api/documents', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: formData });
    const body = await response.json();
    setUploading(false);
    if (!response.ok) {
      setUploadError(body.error || 'Gagal mengunggah dokumen.');
      return;
    }
    setUploadOpen(false);
    formEl.reset();
    await loadDocuments();
  };

  const openViewer = async (doc: DocumentRow) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const canInlinePreview = doc.mime_type === 'application/pdf' || doc.mime_type.startsWith('image/');
    const action = canInlinePreview ? 'view' : 'download';
    const response = await fetch(`/api/documents/${doc.document_id}/signed-url?action=${action}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || 'Gagal membuka dokumen.');
      return;
    }
    if (!canInlinePreview) {
      window.open(body.signed_url, '_blank');
      return;
    }
    setViewerData({ url: body.signed_url, mime: doc.mime_type, title: doc.title });
    setViewerOpen(true);
  };

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="px-6 text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="flex w-full flex-col gap-6 px-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Registry</p>
            <h1 className="text-2xl font-semibold text-foreground">Master Dokumen</h1>
            <p className="mt-1 text-sm text-muted-foreground">Satu tempat untuk semua berkas masuk/keluar sistem -- PO klien, POD, surat jalan, COA, sertifikat, spesifikasi, kontrak, SOP.</p>
          </div>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            Unggah Dokumen
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {documentTypes.length === 0 && isCompanyLeadership(role) ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">Belum Ada Jenis Dokumen</CardDescription>
              <CardTitle className="text-lg">Seed jenis dokumen awal untuk memulai</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button size="sm" className="w-fit" disabled={seeding} onClick={handleSeedDocumentTypes}>
                {seeding ? 'Menjalankan...' : 'Seed Jenis Dokumen'}
              </Button>
              {seedMessage ? <p className="text-xs text-muted-foreground">{seedMessage}</p> : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="flex flex-wrap gap-3 pt-6">
            <Select value={filterDocType || 'ALL'} onValueChange={(v) => setFilterDocType(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Jenis Dokumen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Jenis</SelectItem>
                {documentTypes.map((t) => (
                  <SelectItem key={t.document_type_id} value={t.code}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterDepartment || 'ALL'} onValueChange={(v) => setFilterDepartment(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Departemen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Departemen</SelectItem>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus || 'ALL'} onValueChange={(v) => setFilterStatus(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat dokumen...</p>
        ) : documents.length === 0 ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">Kosong</CardDescription>
              <CardTitle className="text-lg">Belum ada dokumen yang bisa Anda lihat</CardTitle>
            </CardHeader>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Judul</th>
                  <th className="px-3 py-2 text-left">Jenis</th>
                  <th className="px-3 py-2 text-left">Departemen</th>
                  <th className="px-3 py-2 text-left">Sensitivitas</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Ukuran</th>
                  <th className="px-3 py-2 text-left">Diunggah</th>
                  <th className="px-3 py-2 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {documents.map((doc) => (
                  <tr key={doc.document_id}>
                    <td className="px-3 py-1.5">
                      {doc.title}
                      {doc.doc_number ? <span className="text-muted-foreground"> ({doc.doc_number})</span> : null}
                    </td>
                    <td className="px-3 py-1.5">{doc.doc_type}</td>
                    <td className="px-3 py-1.5">{doc.department ?? '-'}</td>
                    <td className="px-3 py-1.5">
                      <Badge variant={doc.sensitivity === 'TERBATAS' ? 'destructive' : doc.sensitivity === 'DEPARTEMEN' ? 'secondary' : 'outline'}>{doc.sensitivity}</Badge>
                    </td>
                    <td className="px-3 py-1.5">{STATUS_LABELS[doc.status] ?? doc.status}</td>
                    <td className="px-3 py-1.5">{formatBytes(doc.size_bytes)}</td>
                    <td className="px-3 py-1.5">{new Date(doc.uploaded_at).toLocaleDateString('id-ID')}</td>
                    <td className="px-3 py-1.5">
                      <Button size="sm" variant="outline" onClick={() => openViewer(doc)}>
                        {doc.mime_type === 'application/pdf' || doc.mime_type.startsWith('image/') ? 'Lihat' : 'Unduh'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Unggah Dokumen</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleUpload(e.currentTarget);
              }}
            >
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Berkas (PDF/PNG/JPG/WEBP/XLSX/DOCX, maks 20MB)</label>
                <input type="file" name="file" required className="w-full text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Jenis Dokumen</label>
                <select name="doc_type" className="h-9 w-full rounded-md border px-2 text-sm" required defaultValue="">
                  <option value="" disabled>
                    Pilih jenis dokumen
                  </option>
                  {documentTypes.map((t) => (
                    <option key={t.document_type_id} value={t.code}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Judul</label>
                <Input name="title" required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Nomor Dokumen (opsional)</label>
                <Input name="doc_number" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Sensitivitas</label>
                  <select name="sensitivity" className="h-9 w-full rounded-md border px-2 text-sm" defaultValue="UMUM">
                    <option value="UMUM">Umum</option>
                    <option value="DEPARTEMEN">Departemen</option>
                    <option value="TERBATAS">Terbatas</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Departemen (wajib kalau bukan Umum)</label>
                  <select name="department" className="h-9 w-full rounded-md border px-2 text-sm" defaultValue="">
                    <option value="">-</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Tanggal Terbit (opsional)</label>
                  <Input type="date" name="issued_date" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Tanggal Kedaluwarsa (opsional)</label>
                  <Input type="date" name="expiry_date" />
                </div>
              </div>
              {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Mengunggah...' : 'Unggah'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{viewerData?.title}</DialogTitle>
            </DialogHeader>
            {viewerData?.mime === 'application/pdf' ? (
              <iframe src={viewerData.url} className="h-[70vh] w-full rounded-md border" title={viewerData.title} />
            ) : viewerData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewerData.url} alt={viewerData.title} className="max-h-[70vh] w-full rounded-md border object-contain" />
            ) : null}
            <p className="text-xs text-muted-foreground">Tautan berlaku sementara (2 menit) -- tutup dan buka lagi kalau kedaluwarsa.</p>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
