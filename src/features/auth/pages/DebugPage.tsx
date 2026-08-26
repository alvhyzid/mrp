'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { InlineNotification, SkeletonText, StructuredListBody, StructuredListCell, StructuredListHead, StructuredListRow, StructuredListWrapper } from '@carbon/react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
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
      <div className="halaman">
        <SkeletonText heading width="16rem" />
        <SkeletonText paragraph lineCount={4} />
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Internal" },
          { label: "Debug Auth & RLS" }
        ]}
        judul="Debug auth &amp; RLS"
        pengantar={
          <>
            Halaman ini memperlihatkan APA YANG BENAR-BENAR BISA DIBACA sesi login Anda setelah
          disaring Row-Level Security — bukan apa yang seharusnya bisa dibaca menurut peran.{' '}
          {getFieldLabel('company_id')} sesi ini: <strong>{companyId === null ? '—' : companyId}</strong>.
          </>
        }
      />

      {error ? <InlineNotification kind="error" lowContrast title="Gagal membaca" subtitle={error} hideCloseButton /> : null}

      {/* StructuredList, BUKAN DataTable: ini daftar BUKTI yang dibaca sekali, bukan data
          yang diurutkan, disaring, atau ditindaklanjuti. Memakai DataTable akan membawa
          toolbar, pengurutan, dan pembagian halaman yang tidak satu pun berguna di sini. */}
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
