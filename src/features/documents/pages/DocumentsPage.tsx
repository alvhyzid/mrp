'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import {
  Button,
  ComposedModal,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  FileUploaderButton,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Pagination,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  TextInput
} from '@carbon/react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { Add } from '@carbon/icons-react';
import { isCompanyLeadership } from '@/lib/roles';
import { formatNumberId } from '@/lib/currency';
import { DEPARTMENT_LABELS } from '@/lib/glossary';

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
const SENSITIVITY_LABELS: Record<string, string> = { UMUM: 'Umum', DEPARTEMEN: 'Departemen', TERBATAS: 'Terbatas' };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${formatNumberId(bytes, 0)} B`;
  if (bytes < 1024 * 1024) return `${formatNumberId(bytes / 1024, 0)} KB`;
  return `${formatNumberId(bytes / 1024 / 1024, 1)} MB`;
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
  const [cari, setCari] = useState('');
  // Pembagian halaman — bagian dari cetakan halaman data, dan halaman ini melewatkannya.
  // Ditemukan 26 Agu 2026 saat pemilik produk membandingkan dua halaman berdampingan.
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(15);
  const [uploadOpen, setUploadOpen] = useState(false);
  // Isian modal unggah dulu memakai <select> dan <input> mentah yang dibaca FormData saat
  // submit. Kontrol Carbon TIDAK menaruh nilainya di FormData, jadi nilainya disimpan di sini
  // dan diteruskan lewat input tersembunyi -- lapisan servernya sama sekali tidak berubah.
  const [berkasTerpilih, setBerkasTerpilih] = useState('');
  const [jenisTerpilih, setJenisTerpilih] = useState('');
  const [sensitivitasTerpilih, setSensitivitasTerpilih] = useState('UMUM');
  const [departemenTerpilih, setDepartemenTerpilih] = useState('');
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
      <div className="halaman">
        <SkeletonText heading width="18rem" />
        <DataTableSkeleton columnCount={8} rowCount={6} showHeader={false} showToolbar={false} />
      </div>
    );
  }

  // Pencarian judul/nomor dokumen. Toolbar Carbon menyediakan kotaknya; menyaringnya
  // tetap tugas halaman.
  const dokumenTerlihat = cari.trim()
    ? documents.filter((d) => `${d.title} ${d.doc_number ?? ''}`.toLowerCase().includes(cari.trim().toLowerCase()))
    : documents;

  const kolom = [
    { key: 'judul', header: 'Judul' },
    { key: 'jenis', header: 'Jenis' },
    { key: 'departemen', header: 'Departemen' },
    { key: 'sensitivitas', header: 'Sensitivitas' },
    { key: 'status', header: 'Status' },
    { key: 'ukuran', header: 'Ukuran' },
    { key: 'diunggah', header: 'Diunggah' },
    { key: 'aksi', header: 'Aksi' }
  ];
  // Baris memuat NILAI YANG DITAMPILKAN, bukan objek mentah: Carbon mengurutkan berdasarkan
  // nilai di baris, jadi baris berisi enum mentah akan mengurut "TERBATAS" padahal layar
  // menampilkan "Terbatas".
  const barisTabel = dokumenTerlihat
    .slice((halaman - 1) * perHalaman, halaman * perHalaman)
    .map((d) => ({
    id: String(d.document_id),
    judul: `${d.title}${d.doc_number ? ` (${d.doc_number})` : ''}`,
    jenis: documentTypes.find((t) => t.code === d.doc_type)?.name ?? d.doc_type,
    departemen: d.department ? DEPARTMENT_LABELS[d.department] ?? d.department : '',
    sensitivitas: SENSITIVITY_LABELS[d.sensitivity] ?? d.sensitivity,
    status: STATUS_LABELS[d.status] ?? d.status,
    ukuran: d.size_bytes,
    diunggah: d.uploaded_at,
    aksi: ''
  }));

  // Warna Tag mengikuti ARTI, bukan selera: merah = terbatas, biru = terbatas departemen,
  // abu = boleh dilihat siapa saja.
  const warnaSensitivitas: Record<string, 'red' | 'blue' | 'gray'> = {
    TERBATAS: 'red',
    DEPARTEMEN: 'blue',
    UMUM: 'gray'
  };

  const isiSel = (doc: DocumentRow, key: string) => {
    if (key === 'judul')
      return (
        <span>
          {doc.title}
          {doc.doc_number ? <span className="halaman__redup"> ({doc.doc_number})</span> : null}
        </span>
      );
    if (key === 'jenis') return documentTypes.find((t) => t.code === doc.doc_type)?.name ?? doc.doc_type;
    if (key === 'departemen') return doc.department ? DEPARTMENT_LABELS[doc.department] ?? doc.department : <span className="halaman__redup">—</span>;
    if (key === 'sensitivitas')
      return <Tag type={warnaSensitivitas[doc.sensitivity] ?? 'gray'}>{SENSITIVITY_LABELS[doc.sensitivity] ?? doc.sensitivity}</Tag>;
    if (key === 'status') return STATUS_LABELS[doc.status] ?? doc.status;
    if (key === 'ukuran') return formatBytes(doc.size_bytes);
    if (key === 'diunggah') return new Date(doc.uploaded_at).toLocaleDateString('id-ID');
    return (
      <Button size="sm" kind="tertiary" onClick={() => openViewer(doc)}>
        {doc.mime_type === 'application/pdf' || doc.mime_type.startsWith('image/') ? 'Lihat' : 'Unduh'}
      </Button>
    );
  };

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Administration' }, { label: 'Documents' }]}
        judul="Master dokumen"
        pengantar={
          loading
            ? 'Memuat…'
            : `${dokumenTerlihat.length} dokumen${cari.trim() ? ` cocok dengan pencarian "${cari.trim()}"` : ' terlihat untuk Anda'} — PO klien, bukti terima, surat jalan, COA, sertifikat, spesifikasi, kontrak, SOP.`
        }
      />

      {error ? <InlineNotification kind="error" lowContrast title="Gagal" subtitle={error} onClose={() => { setError(''); return true; }} /> : null}

      {documentTypes.length === 0 && isCompanyLeadership(role) ? (
        <div className="dokumen-belum-ada-jenis">
          {/* InlineNotification Carbon TIDAK punya prop `actions` (diperiksa di paket
              terpasang); ActionableNotification punya, tapi ia dirancang untuk pesan yang
              MEMBUTUHKAN tindakan segera. Di sini tombolnya cukup berdiri di bawah pesannya. */}
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title="Belum ada jenis dokumen"
            subtitle={seedMessage || 'Jenis dokumen awal perlu dibuat sekali sebelum dokumen bisa diunggah.'}
          />
          <Button size="sm" kind="tertiary" disabled={seeding} onClick={handleSeedDocumentTypes}>
            {seeding ? 'Menjalankan…' : 'Buat jenis dokumen awal'}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <DataTableSkeleton columnCount={8} rowCount={6} showHeader={false} />
      ) : (
        <DataTable rows={barisTabel} headers={kolom}>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
            <TableContainer>
              <TableToolbar>
                <TableToolbarContent>
                  {/* MELIPAT, bukan selalu terbuka — bawaan Carbon, `persistent` tidak dipakai. */}
                  <TableToolbarSearch
                    placeholder="Cari judul atau nomor dokumen…"
                    labelText="Cari dokumen"
                    onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => setCari(typeof e === 'string' ? '' : e.target.value)}
                  />
                  {/* SARINGAN: label disembunyikan secara visual, TAPI TETAP ADA untuk pembaca
                      layar. titleText kosong tetap merender elemen labelnya dan mendorong
                      kotaknya turun -- pelajaran yang sudah dicatat di Master Item. */}
                  <Dropdown
                    id="saring-jenis"
                    className="halaman__saring"
                    size="lg"
                    titleText="Jenis dokumen"
                    hideLabel
                    label="Semua jenis"
                    items={['', ...documentTypes.map((t) => t.code)]}
                    selectedItem={filterDocType}
                    itemToString={(item: string) => (item === '' ? 'Semua jenis' : documentTypes.find((t) => t.code === item)?.name ?? item)}
                    onChange={({ selectedItem }: { selectedItem: string | null }) => setFilterDocType(selectedItem ?? '')}
                  />
                  <Dropdown
                    id="saring-departemen"
                    className="halaman__saring"
                    size="lg"
                    titleText="Departemen"
                    hideLabel
                    label="Semua departemen"
                    items={['', ...DEPARTMENTS]}
                    selectedItem={filterDepartment}
                    itemToString={(item: string) => (item === '' ? 'Semua departemen' : DEPARTMENT_LABELS[item] ?? item)}
                    onChange={({ selectedItem }: { selectedItem: string | null }) => setFilterDepartment(selectedItem ?? '')}
                  />
                  <Dropdown
                    id="saring-status"
                    className="halaman__saring"
                    size="lg"
                    titleText="Status"
                    hideLabel
                    label="Semua status"
                    items={['', ...Object.keys(STATUS_LABELS)]}
                    selectedItem={filterStatus}
                    itemToString={(item: string) => (item === '' ? 'Semua status' : STATUS_LABELS[item] ?? item)}
                    onChange={({ selectedItem }: { selectedItem: string | null }) => setFilterStatus(selectedItem ?? '')}
                  />
                  <Button size="lg" renderIcon={Add} onClick={() => setUploadOpen(true)}>
                    Unggah dokumen
                  </Button>
                </TableToolbarContent>
              </TableToolbar>
              <Table {...getTableProps()} size="lg" className="tabel-responsif--lebar">
                <TableHead>
                  <TableRow>
                    {headers.map((header: any) => {
                      const { key, ...sisa } = getHeaderProps({ header });
                      return (
                        <TableHeader key={key} {...sisa} isSortable={header.key !== 'aksi'}>
                          {header.header}
                        </TableHeader>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={headers.length}>
                        {cari.trim()
                          ? `Tidak ada dokumen yang cocok dengan "${cari.trim()}".`
                          : 'Belum ada dokumen yang bisa Anda lihat.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row: any) => {
                      const doc = documents.find((d) => String(d.document_id) === row.id)!;
                      const { key, ...sisa } = getRowProps({ row });
                      return (
                        <TableRow key={key} {...sisa}>
                          {row.cells.map((cell: any) => (
                            <TableCell key={cell.id} data-label={cell.info.header}>{isiSel(doc, cell.info.header)}</TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <Pagination
                page={halaman}
                pageSize={perHalaman}
                pageSizes={[15, 30, 50]}
                totalItems={dokumenTerlihat.length}
                onChange={({ page, pageSize }: { page: number; pageSize: number }) => {
                  setHalaman(page);
                  setPerHalaman(pageSize);
                }}
                itemsPerPageText="Baris per halaman"
                backwardText="Halaman sebelumnya"
                forwardText="Halaman berikutnya"
                itemRangeText={(mulai: number, akhir: number, total: number) => `${mulai}–${akhir} dari ${total} dokumen`}
                pageRangeText={(_kini: number, total: number) => `dari ${total} halaman`}
                pageNumberText="Nomor halaman"
              />
            </TableContainer>
          )}
        </DataTable>
      )}

      <ComposedModal open={uploadOpen} onClose={() => { setUploadOpen(false); return true; }} size="md">
        <ModalHeader title="Unggah dokumen" label="Master dokumen" />
        <ModalBody hasForm>
          <form id="form-unggah-dokumen" className="dokumen-form" onSubmit={(e) => { e.preventDefault(); handleUpload(e.currentTarget); }}>
            {/* Berkas dipilih lewat FileUploaderButton Carbon, bukan <input type="file"> mentah
                (aturan Pola Unggah Gambar). Input aslinya tetap ada di dalam komponen Carbon
                dengan name="file", jadi FormData tetap membacanya seperti sebelumnya. */}
            <div className="dokumen-berkas">
              <span className="dokumen-berkas__label">Berkas</span>
              <FileUploaderButton
                name="file"
                buttonKind="tertiary"
                size="lg"
                labelText={berkasTerpilih || 'Pilih berkas'}
                disableLabelChanges
                accept={['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.xlsx', '.docx']}
                onChange={(e) => setBerkasTerpilih((e.target as HTMLInputElement).files?.[0]?.name ?? '')}
              />
              <span className="dokumen-berkas__bantuan">PDF, PNG, JPG, WEBP, XLSX, atau DOCX. Maksimal 20MB.</span>
            </div>

            <Dropdown
              id="unggah-jenis"
              size="lg"
              titleText="Jenis dokumen"
              label="Pilih jenis dokumen"
              items={documentTypes.map((t) => t.code)}
              selectedItem={jenisTerpilih}
              itemToString={(item: string) => documentTypes.find((t) => t.code === item)?.name ?? item}
              onChange={({ selectedItem }: { selectedItem: string | null }) => setJenisTerpilih(selectedItem ?? '')}
            />
            {/* pengawas-elemen:mulai — <input type="hidden"> DISENGAJA: kontrol Carbon tidak
                menaruh nilainya di FormData, sedangkan form ini dibaca lewat FormData saat
                submit. Ini JEMBATAN nilai, bukan field yang dilihat pengguna — komponen
                bersama justru salah di sini karena ia merender kontrol yang terlihat. */}
            <input type="hidden" name="doc_type" value={jenisTerpilih} />
            {/* pengawas-elemen:selesai */}

            <TextInput id="unggah-judul" name="title" size="lg" labelText="Judul" required />
            <TextInput id="unggah-nomor" name="doc_number" size="lg" labelText="Nomor dokumen" helperText="Boleh dikosongkan." />

            <div className="dokumen-sejajar">
              <Dropdown
                id="unggah-sensitivitas"
                size="lg"
                titleText="Sensitivitas"
                label="Pilih sensitivitas"
                items={['UMUM', 'DEPARTEMEN', 'TERBATAS']}
                selectedItem={sensitivitasTerpilih}
                itemToString={(item: string) => SENSITIVITY_LABELS[item] ?? item}
                onChange={({ selectedItem }: { selectedItem: string | null }) => setSensitivitasTerpilih(selectedItem ?? 'UMUM')}
              />
              {/* pengawas-elemen:mulai — <input type="hidden"> DISENGAJA: kontrol Carbon tidak
                  menaruh nilainya di FormData, sedangkan form ini dibaca lewat FormData saat
                  submit. Ini JEMBATAN nilai, bukan field yang dilihat pengguna — komponen
                  bersama justru salah di sini karena ia merender kontrol yang terlihat. */}
              <input type="hidden" name="sensitivity" value={sensitivitasTerpilih} />
              {/* pengawas-elemen:selesai */}
              <Dropdown
                id="unggah-departemen"
                size="lg"
                titleText="Departemen"
                label="Pilih departemen"
                helperText={sensitivitasTerpilih === 'UMUM' ? 'Tidak perlu diisi untuk dokumen Umum.' : 'Wajib diisi karena dokumen ini tidak Umum.'}
                items={['', ...DEPARTMENTS]}
                selectedItem={departemenTerpilih}
                itemToString={(item: string) => (item === '' ? '—' : DEPARTMENT_LABELS[item] ?? item)}
                onChange={({ selectedItem }: { selectedItem: string | null }) => setDepartemenTerpilih(selectedItem ?? '')}
              />
              {/* pengawas-elemen:mulai — <input type="hidden"> DISENGAJA: kontrol Carbon tidak
                  menaruh nilainya di FormData, sedangkan form ini dibaca lewat FormData saat
                  submit. Ini JEMBATAN nilai, bukan field yang dilihat pengguna — komponen
                  bersama justru salah di sini karena ia merender kontrol yang terlihat. */}
              <input type="hidden" name="department" value={departemenTerpilih} />
              {/* pengawas-elemen:selesai */}
            </div>

            <div className="dokumen-sejajar">
              <TextInput id="unggah-terbit" name="issued_date" type="date" size="lg" labelText="Tanggal terbit" helperText="Boleh dikosongkan." />
              <TextInput id="unggah-kedaluwarsa" name="expiry_date" type="date" size="lg" labelText="Tanggal kedaluwarsa" helperText="Boleh dikosongkan." />
            </div>

            {uploadError ? <InlineNotification kind="error" lowContrast title={uploadError} hideCloseButton /> : null}
          </form>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setUploadOpen(false)}>
            Batal
          </Button>
          <Button kind="primary" type="submit" form="form-unggah-dokumen" disabled={uploading}>
            {uploading ? 'Mengunggah…' : 'Unggah'}
          </Button>
        </ModalFooter>
      </ComposedModal>

      {/* TETAP lg, dan ini pengecualian yang beralasan — bukan sisa yang belum disapu.
          Aturan "lg hanya untuk komponen kompleks" justru terpenuhi di sini: isinya PDF atau
          gambar berukuran penuh, bukan formulir. Mengecilkannya ke md berarti memaksa orang
          membaca dokumen di kanvas yang lebih sempit tanpa alasan. */}
      <ComposedModal open={viewerOpen} onClose={() => { setViewerOpen(false); return true; }} size="lg">
        <ModalHeader title={viewerData?.title ?? 'Dokumen'} label="Master dokumen" />
        <ModalBody>
          {viewerData?.mime === 'application/pdf' ? (
            <iframe src={viewerData.url} className="dokumen-pratinjau" title={viewerData.title} />
          ) : viewerData ? (
            <img src={viewerData.url} alt={viewerData.title} className="dokumen-pratinjau dokumen-pratinjau--gambar" />
          ) : null}
          <p className="halaman__redup">Tautan berlaku sementara (2 menit) — tutup dan buka lagi bila kedaluwarsa.</p>
        </ModalBody>
      </ComposedModal>
    </div>
  );
}
