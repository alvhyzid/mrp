'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COMPANY_ROLES, INVITABLE_ROLES } from '@/lib/roles';

const inviteRoles = INVITABLE_ROLES;
const memberRoles = COMPANY_ROLES;

type Member = {
  user_id: number;
  name: string;
  email: string;
  role: string;
  status: string;
};

const statusBadgeVariant: Record<string, 'success' | 'critical' | 'warning'> = {
  active: 'success',
  suspended: 'critical',
  invited: 'warning'
};

export default function TeamManagePage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [membersError, setMembersError] = useState('');
  const [membersLoading, setMembersLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(inviteRoles[0]);
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [inviteMessage, setInviteMessage] = useState('');

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

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    await loadMembers();
  };

  const columns = useMemo<ColumnDef<Member>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Nama',
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.name || <span className="text-muted-foreground">(belum diisi)</span>}</span>
        )
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.email}
            {row.original.user_id === currentUserId ? <span className="ml-2 text-xs">(Anda)</span> : null}
          </span>
        )
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => {
          const member = row.original;
          const isSelf = member.user_id === currentUserId;
          const isSaving = savingUserId === member.user_id;
          return (
            <Select
              value={member.role}
              disabled={isSelf || isSaving}
              onValueChange={(value) => handleUpdateMember(member.user_id, { role: value })}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {memberRoles.map((roleOption) => (
                  <SelectItem key={roleOption} value={roleOption}>
                    {roleOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant[row.original.status] ?? 'info'}>{row.original.status}</Badge>
        )
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => {
          const member = row.original;
          const isSelf = member.user_id === currentUserId;
          const isSaving = savingUserId === member.user_id;

          if (isSelf) {
            return <span className="text-xs text-muted-foreground">-</span>;
          }

          if (member.status === 'suspended') {
            return (
              <Button size="sm" variant="default" disabled={isSaving} onClick={() => handleUpdateMember(member.user_id, { status: 'active' })}>
                Aktifkan
              </Button>
            );
          }

          return (
            <Button size="sm" variant="destructive" disabled={isSaving} onClick={() => handleUpdateMember(member.user_id, { status: 'suspended' })}>
              Nonaktifkan
            </Button>
          );
        }
      }
    ],
    [currentUserId, savingUserId]
  );

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="px-6 text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="max-w-3xl px-6">
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em] text-destructive">Akses Ditolak</CardDescription>
              <CardTitle className="text-2xl">Halaman ini khusus company_admin</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Akun Anda tidak memiliki izin untuk mengelola tim perusahaan.</p>
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
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="flex w-full flex-col gap-6 px-6">
        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Kelola Tim</CardDescription>
            <CardTitle className="text-2xl">Anggota tim perusahaan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {membersError ? <p className="text-sm text-destructive">{membersError}</p> : null}
            {membersLoading ? (
              <p className="text-sm text-muted-foreground">Memuat anggota...</p>
            ) : (
              <DataTable columns={columns} data={members} emptyMessage="Belum ada anggota tim." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Undang Tim</CardDescription>
            <CardTitle className="text-xl">Undang anggota baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Email anggota</span>
                <Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Role</span>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {inviteRoles.map((roleOption) => (
                      <SelectItem key={roleOption} value={roleOption}>
                        {roleOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <Button type="submit" disabled={inviteStatus === 'pending'}>
                {inviteStatus === 'pending' ? 'Mengirim...' : 'Kirim Undangan'}
              </Button>

              {inviteMessage ? (
                <p className={`sm:col-span-3 text-sm ${inviteStatus === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>
                  {inviteMessage}
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
