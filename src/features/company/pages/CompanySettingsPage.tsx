'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';

export default function CompanySettingsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [name, setName] = useState('');
  const [industryType, setIndustryType] = useState('');
  const [status, setStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

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
      setCheckingAccess(false);
    };

    load();
  }, [router]);

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
      <main className="min-h-screen bg-slate-50 py-16">
        <div className="mx-auto max-w-2xl px-6">
          <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200 text-center text-slate-600">Memuat...</div>
        </div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
          <p className="text-sm uppercase tracking-[0.2em] text-rose-500">Akses Ditolak</p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">Halaman ini khusus company_admin</h1>
          <p className="mt-4 text-slate-600">Akun Anda tidak memiliki izin untuk mengubah data perusahaan.</p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-16">
      <div className="mx-auto max-w-2xl px-6">
        <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Pengaturan Perusahaan</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Data perusahaan</h1>

          <form onSubmit={handleSave} className="mt-6 grid gap-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Nama Perusahaan</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Jenis Industri</span>
              <input
                type="text"
                value={industryType}
                onChange={(event) => setIndustryType(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Status Langganan</span>
              <input
                type="text"
                value={status}
                disabled
                className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500"
              />
              <span className="mt-1 block text-xs text-slate-400">Status langganan dikelola lewat billing, tidak bisa diubah manual di sini.</span>
            </label>

            {message ? (
              <p className={`text-sm ${saveStatus === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{message}</p>
            ) : null}

            <button
              type="submit"
              disabled={saveStatus === 'pending'}
              className="inline-flex justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saveStatus === 'pending' ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
