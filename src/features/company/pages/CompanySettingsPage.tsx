'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function CompanySettingsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
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
      setIndustryType(companyData.company.industry_type || '');
      setStatus(companyData.company.status || '');
      setLogoUrl(companyData.company.logo_url || null);
      setCheckingAccess(false);
    };

    load();
  }, [router]);

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    setLogoStatus('pending');
    setLogoMessage('');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setLogoStatus('error');
      setLogoMessage('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }

    const formData = new FormData();
    formData.append('logo', logoFile);

    const response = await fetch('/api/company/logo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData
    });
    const data = await response.json();

    if (!response.ok) {
      setLogoStatus('error');
      setLogoMessage(data.error || 'Gagal mengunggah logo.');
      return;
    }

    setLogoUrl(data.logo_url);
    setLogoFile(null);
    setLogoStatus('success');
    setLogoMessage('Logo berhasil diperbarui.');
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveStatus('pending');
    setMessage('');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setSaveStatus('error');
      setMessage('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }

    const response = await fetch('/api/company', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ name, industry_type: industryType })
    });
    const data = await response.json();

    if (!response.ok) {
      setSaveStatus('error');
      setMessage(data.error || 'Gagal menyimpan data perusahaan.');
      return;
    }

    setSaveStatus('success');
    setMessage('Data perusahaan berhasil diperbarui.');
  };

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="container max-w-2xl text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="container max-w-2xl">
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em] text-destructive">Akses Ditolak</CardDescription>
              <CardTitle className="text-2xl">Halaman ini khusus company_admin</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Akun Anda tidak memiliki izin untuk mengubah data perusahaan.</p>
              <Button onClick={() => router.push('/dashboard')} className="w-fit">
                Kembali ke Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-16">
      <div className="container flex max-w-2xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Pengaturan Perusahaan</CardDescription>
            <CardTitle className="text-2xl">Logo perusahaan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-none border border-[#e0e0e0] bg-muted">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo perusahaan" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-center text-xs text-muted-foreground">Belum ada logo</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                  className="text-sm text-foreground file:mr-3 file:h-8 file:rounded-none file:border-0 file:bg-[#0f62fe] file:px-3 file:text-xs file:font-medium file:text-white hover:file:bg-[#0043ce]"
                />
                <span className="text-xs text-muted-foreground">PNG, JPG, atau WEBP, maksimal 2MB.</span>
                <Button type="button" onClick={handleLogoUpload} disabled={!logoFile || logoStatus === 'pending'} className="w-fit">
                  {logoStatus === 'pending' ? 'Mengunggah...' : 'Upload Logo'}
                </Button>
              </div>
            </div>
            {logoMessage ? (
              <p className={`text-sm ${logoStatus === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>{logoMessage}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Pengaturan Perusahaan</CardDescription>
            <CardTitle className="text-2xl">Data perusahaan</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="grid gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Nama Perusahaan</span>
                <Input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Jenis Industri</span>
                <Input type="text" value={industryType} onChange={(event) => setIndustryType(event.target.value)} required />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Status Langganan</span>
                <Input type="text" value={status} disabled />
                <span className="text-xs text-muted-foreground">Status langganan dikelola lewat billing, tidak bisa diubah manual di sini.</span>
              </label>

              {message ? <p className={`text-sm ${saveStatus === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>{message}</p> : null}

              <Button type="submit" disabled={saveStatus === 'pending'} className="w-fit">
                {saveStatus === 'pending' ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
