'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { getFieldLabel, getRoleLabel, getEntityLabel, COMMON_STATUS_LABELS } from '@/lib/glossary';

function parseJwt(token: string) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))));
  } catch {
    return null;
  }
}

export default function DebugPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | number | null>(null);
  const [companyRows, setCompanyRows] = useState<any[]>([]);
  const [userRows, setUserRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setError('Supabase belum dikonfigurasi. Silakan periksa variabel lingkungan.');
        setLoading(false);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) {
        router.replace('/login');
        return;
      }

      const accessToken = sessionData.session.access_token;
      const tokenClaims = parseJwt(accessToken);
      const currentCompanyId = tokenClaims?.company_id ?? null;
      setCompanyId(currentCompanyId);

      const [{ data: companies, error: companiesError }, { data: users, error: usersError }] = await Promise.all([
        supabase.from('companies').select('*'),
        supabase.from('users').select('user_id, company_id, name, email, role, status')
      ]);

      if (companiesError) {
        setError(`Gagal memuat companies: ${companiesError.message}`);
      } else {
        setCompanyRows(companies || []);
      }

      if (usersError) {
        setError((prev) => (prev ? `${prev} | Gagal memuat users: ${usersError.message}` : `Gagal memuat users: ${usersError.message}`));
      } else {
        setUserRows(users || []);
      }

      setLoading(false);
    };

    loadData();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200 text-center text-slate-600">Memuat debug...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6">
        <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Debug</p>
              <h1 className="text-3xl font-semibold text-slate-900">Debug Auth & RLS</h1>
              <p className="mt-2 text-slate-600">
                {getFieldLabel('company_id')} dari sesi login Anda: <span className="font-semibold text-slate-900">{companyId === null ? '-' : companyId}</span>
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl bg-rose-50 p-6 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>
        ) : null}

        <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">{getEntityLabel('companies')} yang berhasil diambil</h2>
          <p className="mt-2 text-sm text-slate-600">Hanya baris yang terbatas oleh RLS sesuai sesi login Anda.</p>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-900">{getFieldLabel('company_id')}</th>
                  <th className="px-4 py-3 font-medium text-slate-900">{getFieldLabel('name')}</th>
                  <th className="px-4 py-3 font-medium text-slate-900">{getFieldLabel('industry_type')}</th>
                  <th className="px-4 py-3 font-medium text-slate-900">{getFieldLabel('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companyRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-5 text-slate-500">Tidak ada baris perusahaan yang bisa dibaca.</td>
                  </tr>
                ) : (
                  companyRows.map((row) => (
                    <tr key={row.company_id}>
                      <td className="px-4 py-4 font-medium text-slate-900">{row.company_id}</td>
                      <td className="px-4 py-4">{row.name}</td>
                      <td className="px-4 py-4">{row.industry_type}</td>
                      <td className="px-4 py-4">{COMMON_STATUS_LABELS[row.status] ?? row.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">{getEntityLabel('users')} yang berhasil diambil</h2>
          <p className="mt-2 text-sm text-slate-600">Hanya baris yang terbatas oleh RLS sesuai sesi login Anda.</p>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-900">{getFieldLabel('user_id')}</th>
                  <th className="px-4 py-3 font-medium text-slate-900">{getFieldLabel('company_id')}</th>
                  <th className="px-4 py-3 font-medium text-slate-900">{getFieldLabel('name')}</th>
                  <th className="px-4 py-3 font-medium text-slate-900">{getFieldLabel('email')}</th>
                  <th className="px-4 py-3 font-medium text-slate-900">{getFieldLabel('role')}</th>
                  <th className="px-4 py-3 font-medium text-slate-900">{getFieldLabel('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-5 text-slate-500">Tidak ada baris pengguna yang bisa dibaca.</td>
                  </tr>
                ) : (
                  userRows.map((row) => (
                    <tr key={row.user_id}>
                      <td className="px-4 py-4 font-medium text-slate-900">{row.user_id}</td>
                      <td className="px-4 py-4">{row.company_id === null ? '-' : row.company_id}</td>
                      <td className="px-4 py-4">{row.name}</td>
                      <td className="px-4 py-4">{row.email}</td>
                      <td className="px-4 py-4">{getRoleLabel(row.role)}</td>
                      <td className="px-4 py-4">{COMMON_STATUS_LABELS[row.status] ?? row.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
