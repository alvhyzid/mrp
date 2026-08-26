'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Button, FileUploaderButton, InlineNotification, Modal, SkeletonText, TextInput, Tile } from '@carbon/react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { Image as IkonGambar } from '@carbon/icons-react';
import { AreaNotifikasi, type Notifikasi } from '@/components/ui/notifikasi';

export default function CompanySettingsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  // POLA UNGGAH GAMBAR (CLAUDE.md): logo dipratinjau dulu, satu tombol simpan di luar kartu,
  // konfirmasi lewat modal, hasilnya lewat notifikasi. Sama persis dengan foto profil.
  const [pratinjauLogo, setPratinjauLogo] = useState<string | null>(null);
  const [logoGagalDimuat, setLogoGagalDimuat] = useState(false);
  const [namaAwal, setNamaAwal] = useState('');
  const [industriAwal, setIndustriAwal] = useState('');
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const beriTahu = useCallback((jenis: Notifikasi['jenis'], judul: string, rincian?: string) => {
    setNotifikasi((lama) => [...lama, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, jenis, judul, rincian }]);
  }, []);
  const tutupNotifikasi = useCallback((id: string) => setNotifikasi((lama) => lama.filter((n) => n.id !== id)), []);
  const [accessDenied, setAccessDenied] = useState(false);

  const [name, setName] = useState('');
  const [industryType, setIndustryType] = useState('');
  const [status, setStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoStatus, setLogoStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [logoMessage, setLogoMessage] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/company');
        return;
      }

      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const meData = await meResponse.json();

      if (!meResponse.ok || meData?.user?.role !== 'company_admin') {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }

      const companyResponse = await fetch('/api/company', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const companyData = await companyResponse.json();

      if (!companyResponse.ok) {
        setMessage(companyData.error || 'Gagal memuat data perusahaan.');
        setSaveStatus('error');
        setCheckingAccess(false);
        return;
      }

      setName(companyData.company.name || '');
      setNamaAwal(companyData.company.name || '');
      setIndustryType(companyData.company.industry_type || '');
      setIndustriAwal(companyData.company.industry_type || '');
      setStatus(companyData.company.status || '');
      setLogoUrl(companyData.company.logo_url || null);
      setCheckingAccess(false);
    };

    load();
  }, [router]);

  const adaPerubahan = name.trim() !== namaAwal.trim() || industryType.trim() !== industriAwal.trim() || logoFile !== null;

  const pilihLogo = (berkas: File | null) => {
    setPratinjauLogo((lama) => {
      if (lama) URL.revokeObjectURL(lama);
      return berkas ? URL.createObjectURL(berkas) : null;
    });
    setLogoFile(berkas);
  };

  const simpanPerusahaan = async () => {
    setMenyimpan(true);
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setMenyimpan(false);
      setKonfirmasi(false);
      beriTahu('error', 'Sesi Anda sudah tidak valid', 'Silakan masuk lagi.');
      return;
    }

    // URUTAN DISENGAJA: DATA DULU, LOGO KEMUDIAN — sama seperti halaman Profil. Bila datanya
    // ditolak, tidak ada berkas logo yang terlanjur lahir di penyimpanan.
    let dataTersimpan = false;
    if (name.trim() !== namaAwal.trim() || industryType.trim() !== industriAwal.trim()) {
      const res = await fetch('/api/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name, industry_type: industryType })
      });
      const data = await res.json();
      if (!res.ok) {
        setMenyimpan(false);
        setKonfirmasi(false);
        beriTahu('error', 'Gagal menyimpan data perusahaan', data.error || undefined);
        return;
      }
      dataTersimpan = true;
    }

    if (logoFile) {
      const formData = new FormData();
      formData.append('logo', logoFile);
      const res = await fetch('/api/company/logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        setMenyimpan(false);
        setKonfirmasi(false);
        beriTahu('error', dataTersimpan ? 'Data tersimpan, logo gagal diunggah' : 'Gagal mengunggah logo', data.error || undefined);
        return;
      }
      setLogoUrl(data.logo_url);
      setLogoGagalDimuat(false);
    }

    setNamaAwal(name.trim());
    setIndustriAwal(industryType.trim());
    pilihLogo(null);
    setMenyimpan(false);
    setKonfirmasi(false);
    beriTahu('success', 'Data perusahaan berhasil diubah', 'Perubahan Anda sudah tersimpan.');
  };

  if (checkingAccess) {
    return (
      <div className="halaman">
        <SkeletonText heading width="18rem" />
        <SkeletonText paragraph lineCount={3} />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <h1 className="halaman__judul">Data perusahaan</h1>
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="Halaman ini khusus Admin Perusahaan"
          subtitle="Akun Anda tidak punya izin mengubah data perusahaan."
        />
        <Button kind="tertiary" className="w-fit" onClick={() => router.push('/dashboard')}>
          Kembali ke Ringkasan
        </Button>
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Administration" },
          { label: "Company Data" }
        ]}
        judul="Data perusahaan"
        pengantar="Nama dan logo di sini muncul di dokumen yang tercetak — surat jalan, faktur, dan lampiran lain."
      />

      <Tile className="perusahaan-kartu">
        {/* POLA UNGGAH GAMBAR: logonya sendiri yang diklik, dipratinjau dulu, dan baru
            terkirim saat tombol simpan di luar kartu ditekan. */}
        <div className="perusahaan-logo">
          <FileUploaderButton
            accept={['image/png', 'image/jpeg', 'image/webp']}
            buttonKind="ghost"
            disableLabelChanges
            size="lg"
            multiple={false}
            onChange={(event) => {
              const berkas = (event.target as HTMLInputElement).files?.[0] ?? null;
              if (berkas) pilihLogo(berkas);
            }}
            labelText={
              <span className="perusahaan-logo__kotak">
                {pratinjauLogo ? (
                  <img src={pratinjauLogo} alt="Pratinjau logo yang baru dipilih" className="perusahaan-logo__gambar" />
                ) : logoUrl && !logoGagalDimuat ? (
                  <img src={logoUrl} alt="Logo perusahaan" className="perusahaan-logo__gambar" onError={() => setLogoGagalDimuat(true)} />
                ) : (
                  <IkonGambar size={40} aria-label="Belum ada logo" />
                )}
              </span>
            }
          />
          <span className="halaman__redup perusahaan-logo__keterangan">
            {pratinjauLogo ? 'Logo baru — belum tersimpan' : 'Klik untuk mengganti logo'}
          </span>
        </div>

        <div className="perusahaan-isian">
          <TextInput
            id="perusahaan-nama"
            size="lg"
            labelText="Nama perusahaan"
            helperText="Muncul di dokumen yang tercetak."
            value={name}
            onChange={(event) => setName(event.target.value)}
            invalid={name.trim() === ''}
            invalidText="Nama perusahaan tidak boleh kosong."
          />
          <TextInput
            id="perusahaan-industri"
            size="lg"
            labelText="Jenis industri"
            value={industryType}
            onChange={(event) => setIndustryType(event.target.value)}
          />
          {/* readOnly, BUKAN disabled: status langganan memang bukan untuk diisi di sini,
              bukan "sedang tidak bisa dipakai". */}
          <TextInput
            id="perusahaan-status"
            size="lg"
            labelText="Status langganan"
            readOnly
            value={status}
            helperText="Dikelola lewat penagihan, tidak bisa diubah dari sini."
          />
        </div>
      </Tile>

      <div>
        <Button className="w-fit" disabled={!adaPerubahan || menyimpan} onClick={() => setKonfirmasi(true)}>
          {menyimpan ? 'Menyimpan…' : 'Simpan perubahan'}
        </Button>
      </div>

      <Modal
        open={konfirmasi}
        size="sm"
        modalHeading="Simpan perubahan data perusahaan?"
        primaryButtonText={menyimpan ? 'Menyimpan…' : 'Simpan'}
        secondaryButtonText="Batal"
        primaryButtonDisabled={menyimpan}
        onRequestClose={() => (menyimpan ? null : setKonfirmasi(false))}
        onRequestSubmit={simpanPerusahaan}
        onSecondarySubmit={() => setKonfirmasi(false)}
      >
        <p>Nama dan logo ini akan dipakai di dokumen yang tercetak berikutnya. Dokumen yang sudah terbit TIDAK berubah.</p>
      </Modal>

      <AreaNotifikasi daftar={notifikasi} onTutup={tutupNotifikasi} />
    </div>
  );
}
