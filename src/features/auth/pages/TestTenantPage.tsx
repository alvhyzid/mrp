'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  InlineNotification,
  SkeletonText,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper
} from '@carbon/react';
import { getFieldLabel, getRoleLabel, getEntityLabel, COMMON_STATUS_LABELS } from '@/lib/glossary';

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
      <div className="halaman">
        <SkeletonText heading width="16rem" />
        <SkeletonText paragraph lineCount={4} />
      </div>
    );
  }

  return (
    <div className="halaman">
      <Breadcrumb noTrailingSlash className="halaman__remah">
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <span className="cds--link halaman__remah-mati">Internal</span>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Test Tenant</BreadcrumbItem>
      </Breadcrumb>

      <div>
        <h1 className="halaman__judul">Data login saat ini</h1>
        <p className="halaman__pengantar">
          Masuk sebagai <strong>{userEmail ?? 'tidak diketahui'}</strong>, {getFieldLabel('company_id')}{' '}
          <strong>{companyId === null ? '—' : companyId}</strong>. Daftar di bawah memperlihatkan apa yang
          BENAR-BENAR bisa dibaca sesi ini setelah disaring Row-Level Security.
        </p>
      </div>

      {/* AKSI MERUSAK DIPISAH DAN BERJAUHAN dari aksi biasa (aturan modal butir 9): "Keluar"
          mengakhiri sesi, dan tidak boleh berdempetan dengan tautan navigasi biasa. */}
      <div className="tenant-aksi">
        <Button kind="tertiary" onClick={() => router.push('/dashboard')}>
          Ke Ringkasan
        </Button>
        <Button kind="danger--tertiary" className="tenant-aksi__keluar" onClick={handleSignOut}>
          Keluar
        </Button>
      </div>

      {error ? <InlineNotification kind="error" lowContrast title="Gagal membaca" subtitle={error} hideCloseButton /> : null}

      {/* StructuredList, BUKAN DataTable: ini daftar BUKTI yang dibaca sekali, bukan data yang
          diurutkan atau ditindaklanjuti. */}
      <section>
        <h2 className="halaman__subjudul">{getEntityLabel('companies')} yang berhasil dibaca</h2>
        <StructuredListWrapper isCondensed>
          <StructuredListHead>
            <StructuredListRow head>
              <StructuredListCell head>{getFieldLabel('company_id')}</StructuredListCell>
              <StructuredListCell head>{getFieldLabel('name')}</StructuredListCell>
              <StructuredListCell head>{getFieldLabel('industry_type')}</StructuredListCell>
              <StructuredListCell head>{getFieldLabel('status')}</StructuredListCell>
            </StructuredListRow>
          </StructuredListHead>
          <StructuredListBody>
            {companyRows.length === 0 ? (
              <StructuredListRow>
                <StructuredListCell>Tidak ada baris perusahaan yang bisa dibaca.</StructuredListCell>
              </StructuredListRow>
            ) : (
              companyRows.map((row) => (
                <StructuredListRow key={row.company_id}>
                  <StructuredListCell>{row.company_id}</StructuredListCell>
                  <StructuredListCell>{row.name}</StructuredListCell>
                  <StructuredListCell>{row.industry_type}</StructuredListCell>
                  <StructuredListCell>{COMMON_STATUS_LABELS[row.status] ?? row.status}</StructuredListCell>
                </StructuredListRow>
              ))
            )}
          </StructuredListBody>
        </StructuredListWrapper>
      </section>

      <section>
        <h2 className="halaman__subjudul">{getEntityLabel('users')} yang berhasil dibaca</h2>
        <StructuredListWrapper isCondensed>
          <StructuredListHead>
            <StructuredListRow head>
              <StructuredListCell head>{getFieldLabel('user_id')}</StructuredListCell>
              <StructuredListCell head>{getFieldLabel('company_id')}</StructuredListCell>
              <StructuredListCell head>{getFieldLabel('name')}</StructuredListCell>
              <StructuredListCell head>{getFieldLabel('email')}</StructuredListCell>
              <StructuredListCell head>{getFieldLabel('role')}</StructuredListCell>
              <StructuredListCell head>{getFieldLabel('status')}</StructuredListCell>
            </StructuredListRow>
          </StructuredListHead>
          <StructuredListBody>
            {userRows.length === 0 ? (
              <StructuredListRow>
                <StructuredListCell>Tidak ada baris pengguna yang bisa dibaca.</StructuredListCell>
              </StructuredListRow>
            ) : (
              userRows.map((row) => (
                <StructuredListRow key={row.user_id}>
                  <StructuredListCell>{row.user_id}</StructuredListCell>
                  <StructuredListCell>{row.company_id === null ? '—' : row.company_id}</StructuredListCell>
                  <StructuredListCell>{row.name}</StructuredListCell>
                  <StructuredListCell>{row.email}</StructuredListCell>
                  <StructuredListCell>{getRoleLabel(row.role)}</StructuredListCell>
                  <StructuredListCell>{COMMON_STATUS_LABELS[row.status] ?? row.status}</StructuredListCell>
                </StructuredListRow>
              ))
            )}
          </StructuredListBody>
        </StructuredListWrapper>
      </section>
    </div>
  );
}
