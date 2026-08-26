'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  ComposedModal,
  DataTable,
  DataTableSkeleton,
  Dropdown,
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
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { COMPANY_ROLES, INVITABLE_ROLES } from '@/lib/roles';
import { getRoleLabel } from '@/lib/glossary';

const inviteRoles = INVITABLE_ROLES;
const memberRoles = COMPANY_ROLES;

type Member = {
  user_id: number;
  name: string;
  email: string;
  role: string;
  status: string;
};

// Warna Tag Carbon mengikuti ARTI: hijau = berjalan, merah = dicabut, biru = menunggu.
const tagPeranStatus: Record<string, 'green' | 'red' | 'blue'> = {
  active: 'green',
  suspended: 'red',
  invited: 'blue'
};
const statusLabels: Record<string, string> = {
  active: 'Aktif',
  suspended: 'Ditangguhkan',
  invited: 'Diundang'
};

export default function TeamManagePage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [membersError, setMembersError] = useState('');
  const [cari, setCari] = useState('');
  // Pembagian halaman — bagian dari cetakan halaman data yang halaman ini lewatkan.
  // Ditemukan 26 Agu 2026 lewat perbandingan berdampingan oleh pemilik produk.
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(15);
  const [membersLoading, setMembersLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(inviteRoles[0]);
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [inviteMessage, setInviteMessage] = useState('');
  // FASE 3 (Carbon "DataTable with toolbar") — form undangan pindah dari Card inline
  // ke modal toolbar. Validasi/handleInvite TIDAK diubah, cuma wadahnya.
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadMembers = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    setMembersLoading(true);
    const response = await fetch('/api/users', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();

    if (!response.ok) {
      setMembersError(data.error || 'Gagal memuat daftar tim.');
      setMembersLoading(false);
      return;
    }

    setMembers(data.members || []);
    setCurrentUserId(data.currentUserId ?? null);
    setMembersError('');
    setMembersLoading(false);
  }, [getAccessToken]);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/team');
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

      setCheckingAccess(false);
      await loadMembers();
    };

    checkAccessAndLoad();
  }, [router, loadMembers]);

  const handleUpdateMember = async (userId: number, payload: { role?: string; status?: string }) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    setSavingUserId(userId);
    const response = await fetch('/api/users', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ user_id: userId, ...payload })
    });
    const data = await response.json();
    setSavingUserId(null);

    if (!response.ok) {
      setMembersError(data.error || 'Gagal menyimpan perubahan.');
      return;
    }

    setMembersError('');
    await loadMembers();
  };

  const handleInvite = async () => {
    setInviteStatus('pending');
    setInviteMessage('');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setInviteStatus('error');
      setInviteMessage('Silakan login ulang sebelum mengundang anggota tim.');
      return;
    }

    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole })
    });

    const data = await response.json();
    if (!response.ok) {
      setInviteStatus('error');
      setInviteMessage(data.error || 'Gagal mengundang anggota.');
      return;
    }

    setInviteStatus('success');
    setInviteMessage('Undangan berhasil dikirim. Email anggota telah diundang.');
    setInviteEmail('');
    setIsInviteModalOpen(false);
    await loadMembers();
  };

  if (checkingAccess) {
    return (
      <div className="halaman">
        <SkeletonText heading width="18rem" />
        <DataTableSkeleton columnCount={5} rowCount={5} showHeader={false} showToolbar={false} />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <h1 className="halaman__judul">Kelola tim</h1>
        <InlineNotification
          kind="error"
          lowContrast
          title="Halaman ini khusus Admin Perusahaan"
          subtitle="Akun Anda tidak punya izin mengelola tim perusahaan."
          hideCloseButton
        />
        <Button kind="tertiary" className="w-fit" onClick={() => router.push('/dashboard')}>
          Kembali ke Ringkasan
        </Button>
      </div>
    );
  }

  const anggotaTerlihat = cari.trim()
    ? members.filter((m) => `${m.name ?? ''} ${m.email}`.toLowerCase().includes(cari.trim().toLowerCase()))
    : members;

  // Baris memuat NILAI YANG DITAMPILKAN: mengurut kolom Peran harus mengurut "Manajer Gudang",
  // bukan slug `warehouse_manager` yang tidak pernah dilihat siapa pun.
  const barisTabel = anggotaTerlihat
    .slice((halaman - 1) * perHalaman, halaman * perHalaman)
    .map((m) => ({
    id: String(m.user_id),
    name: m.name || '',
    email: m.email,
    role: getRoleLabel(m.role),
    status: m.status === 'active' ? 'Aktif' : 'Nonaktif',
    aksi: ''
  }));
  const kolom = [
    { key: 'name', header: 'Nama' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Peran' },
    { key: 'status', header: 'Status' },
    { key: 'aksi', header: 'Aksi' }
  ];

  const isiSel = (member: Member, key: string) => {
    const isSelf = member.user_id === currentUserId;
    const isSaving = savingUserId === member.user_id;

    if (key === 'name') return member.name || <span className="halaman__redup">(belum diisi)</span>;
    if (key === 'email')
      return (
        <span>
          {member.email}
          {isSelf ? <span className="halaman__redup"> (Anda)</span> : null}
        </span>
      );
    if (key === 'role')
      return (
        <Dropdown
          id={`peran-${member.user_id}`}
          size="sm"
          titleText="Peran"
          hideLabel
          label="Peran"
          disabled={isSelf || isSaving}
          items={memberRoles as unknown as string[]}
          selectedItem={member.role}
          itemToString={(item: string) => getRoleLabel(item)}
          onChange={({ selectedItem }: { selectedItem: string | null }) => {
            if (selectedItem && selectedItem !== member.role) handleUpdateMember(member.user_id, { role: selectedItem });
          }}
        />
      );
    if (key === 'status')
      return <Tag type={tagPeranStatus[member.status] ?? 'gray'}>{statusLabels[member.status] ?? member.status}</Tag>;

    // Aksi. Diri sendiri TIDAK bisa dinonaktifkan sendiri -- pengaman yang sudah ada, dan
    // sengaja dipertahankan apa adanya: migrasi ini mengganti komponen, bukan aturan.
    if (isSelf) return <span className="halaman__redup">—</span>;
    if (member.status === 'suspended')
      return (
        <Button size="sm" kind="tertiary" disabled={isSaving} onClick={() => handleUpdateMember(member.user_id, { status: 'active' })}>
          Aktifkan
        </Button>
      );
    return (
      <Button size="sm" kind="danger--tertiary" disabled={isSaving} onClick={() => handleUpdateMember(member.user_id, { status: 'suspended' })}>
        Nonaktifkan
      </Button>
    );
  };

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Administration' }, { label: 'Team & Invitations' }]}
        judul="Anggota tim perusahaan"
        pengantar={`${membersLoading ? '…' : anggotaTerlihat.length} anggota${cari.trim() ? ` cocok dengan pencarian "${cari.trim()}"` : ' terdaftar'} — peran menentukan apa yang bisa dibuka seseorang; menonaktifkan mencabut aksesnya tanpa menghapus jejaknya.`}
      />

      {membersError ? (
        <InlineNotification kind="error" lowContrast title="Gagal" subtitle={membersError} onClose={() => { setMembersError(''); return true; }} />
      ) : null}

      {membersLoading ? (
        <DataTableSkeleton columnCount={5} rowCount={5} showHeader={false} />
      ) : (
        <DataTable rows={barisTabel} headers={kolom}>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
            <TableContainer>
              <TableToolbar>
                <TableToolbarContent>
                  {/* MELIPAT, bukan selalu terbuka — bawaan Carbon, `persistent` tidak dipakai. */}
                  <TableToolbarSearch
                    placeholder="Cari nama atau email…"
                    labelText="Cari anggota"
                    onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => setCari(typeof e === 'string' ? '' : e.target.value)}
                  />
                  <Button size="lg" renderIcon={Add} onClick={() => setIsInviteModalOpen(true)}>
                    Undang anggota
                  </Button>
                </TableToolbarContent>
              </TableToolbar>
              <Table {...getTableProps()} size="lg" className="tabel-responsif">
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
                        {cari.trim() ? `Tidak ada anggota yang cocok dengan "${cari.trim()}".` : 'Belum ada anggota tim.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row: any) => {
                      const member = anggotaTerlihat.find((m) => String(m.user_id) === row.id)!;
                      const { key, ...sisa } = getRowProps({ row });
                      return (
                        <TableRow key={key} {...sisa}>
                          {row.cells.map((cell: any) => (
                            <TableCell key={cell.id} data-label={cell.info.header}>{isiSel(member, cell.info.header)}</TableCell>
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
                totalItems={anggotaTerlihat.length}
                onChange={({ page, pageSize }: { page: number; pageSize: number }) => {
                  setHalaman(page);
                  setPerHalaman(pageSize);
                }}
                itemsPerPageText="Baris per halaman"
                backwardText="Halaman sebelumnya"
                forwardText="Halaman berikutnya"
                itemRangeText={(mulai: number, akhir: number, total: number) => `${mulai}–${akhir} dari ${total} anggota`}
                pageRangeText={(_kini: number, total: number) => `dari ${total} halaman`}
                pageNumberText="Nomor halaman"
              />
            </TableContainer>
          )}
        </DataTable>
      )}

      <ComposedModal open={isInviteModalOpen} onClose={() => { setIsInviteModalOpen(false); setInviteMessage(''); setInviteStatus('idle'); return true; }} size="sm">
        <ModalHeader title="Undang anggota baru" label="Kelola tim" />
        <ModalBody hasForm>
          <div className="flex flex-col gap-5">
            <TextInput
              id="undang-email"
              size="lg"
              type="email"
              labelText="Email anggota"
              helperText="Undangan dikirim ke alamat ini."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Dropdown
              id="undang-peran"
              size="lg"
              titleText="Peran"
              label="Pilih peran"
              items={inviteRoles as unknown as string[]}
              selectedItem={inviteRole}
              itemToString={(item: string) => getRoleLabel(item)}
              onChange={({ selectedItem }: { selectedItem: string | null }) => selectedItem && setInviteRole(selectedItem)}
            />
            {inviteMessage ? (
              <InlineNotification kind={inviteStatus === 'success' ? 'success' : 'error'} lowContrast title={inviteMessage} hideCloseButton />
            ) : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setIsInviteModalOpen(false)}>
            Batal
          </Button>
          <Button kind="primary" disabled={inviteStatus === 'pending' || !inviteEmail.trim()} onClick={() => handleInvite()}>
            {inviteStatus === 'pending' ? 'Mengirim…' : 'Kirim undangan'}
          </Button>
        </ModalFooter>
      </ComposedModal>
    </div>
  );
}
