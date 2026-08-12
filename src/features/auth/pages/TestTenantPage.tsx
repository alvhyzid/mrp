'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';

export default function TestTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userRows, setUserRows] = useState<any[]>([]);
  const [companyRows, setCompanyRows] = useState<any[]>([]);

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

      setUserEmail(sessionData.session.user.email ?? null);

      const [{ data: companies, error: companiesError }, { data: users, error: usersError }, { data: currentUser, error: currentUserError }] = await Promise.all([
        supabase.from('companies').select('*'),
        supabase.from('users').select('user_id, company_id, name, email, role, status'),
        supabase.from('users').select('company_id').eq('auth_uid', sessionData.session.user.id).maybeSingle()
      ]);

      if (companiesError) {
        setError(`Gagal memuat companies: ${companiesError.message}`);
      } else {
        setCompanyRows(companies || []);
      }

      if (usersError) {
        setError((prev) => prev ? `${prev} | Gagal memuat users: ${usersError.message}` : `Gagal memuat users: ${usersError.message}`);
      } else {
        setUserRows(users || []);
      }

      if (currentUserError) {
        setError((prev) => prev ? `${prev} | Gagal memuat informasi user saat ini: ${currentUserError.message}` : `Gagal memuat informasi user saat ini: ${currentUserError.message}`);
      } else {
        setCompanyId(currentUser?.company_id ?? null);
      }

      setLoading(false);
    };

    loadData();
  }, [router]);

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200 text-center text-slate-600">Memuat data tenant...</div>
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
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Debug Tenant</p>
              <h1 className="text-3xl font-semibold text-slate-900">Data login saat ini</h1>
              <p className="mt-2 text-slate-600">
                Nama: <span className="font-semibold text-slate-900">{userEmail ?? 'Tidak diketahui'}</span>
              </p>
              <p className="text-slate-600">
                company_id: <span className="font-semibold text-slate-900">{companyId === null ? 'null' : companyId}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Keluar
              </button>
              <a href="/dashboard" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
                Dashboard
              </a>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl bg-rose-50 p-6 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>
        ) : null}

        <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">Companies yang berhasil di-query</h2>
          <p className="mt-2 text-sm text-slate-600">Hanya baris yang terbatas oleh RLS sesuai sesi login Anda.</p>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-900">company_id</th>
                  <th className="px-4 py-3 font-medium text-slate-900">name</th>
                  <th className="px-4 py-3 font-medium text-slate-900">industry_type</th>
                  <th className="px-4 py-3 font-medium text-slate-900">status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companyRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-5 text-slate-500">Tidak ada baris companies yang bisa dibaca.</td>
                  </tr>
                ) : (
                  companyRows.map((row) => (
                    <tr key={row.company_id}>
                      <td className="px-4 py-4 font-medium text-slate-900">{row.company_id}</td>
                      <td className="px-4 py-4">{row.name}</td>
                      <td className="px-4 py-4">{row.industry_type}</td>
                      <td className="px-4 py-4">{row.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">Users yang berhasil di-query</h2>
          <p className="mt-2 text-sm text-slate-600">Hanya baris yang terbatas oleh RLS sesuai sesi login Anda.</p>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-900">user_id</th>
                  <th className="px-4 py-3 font-medium text-slate-900">company_id</th>
                  <th className="px-4 py-3 font-medium text-slate-900">name</th>
                  <th className="px-4 py-3 font-medium text-slate-900">email</th>
                  <th className="px-4 py-3 font-medium text-slate-900">role</th>
                  <th className="px-4 py-3 font-medium text-slate-900">status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-5 text-slate-500">Tidak ada baris users yang bisa dibaca.</td>
                  </tr>
                ) : (
                  userRows.map((row) => (
                    <tr key={row.user_id}>
                      <td className="px-4 py-4 font-medium text-slate-900">{row.user_id}</td>
                      <td className="px-4 py-4">{row.company_id === null ? 'null' : row.company_id}</td>
                      <td className="px-4 py-4">{row.name}</td>
                      <td className="px-4 py-4">{row.email}</td>
                      <td className="px-4 py-4">{row.role}</td>
                      <td className="px-4 py-4">{row.status}</td>
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
