'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');

  const [name, setName] = useState('');
  const [nameStatus, setNameStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [nameMessage, setNameMessage] = useState('');

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [avatarMessage, setAvatarMessage] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [passwordMessage, setPasswordMessage] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!hasSupabaseConfig || !supabase) {
        router.replace('/login');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/profile');
        return;
      }

      const accessToken = sessionData.session.access_token;
      const response = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();

      if (!response.ok) {
        setNameMessage(data.error || 'Gagal memuat profil.');
        setNameStatus('error');
        setLoading(false);
        return;
      }

      setName(data.user.name || '');
      setEmail(data.user.email || '');
      setAvatarUrl(data.user.avatar_url || null);
      setLoading(false);
    };

    load();
  }, [router]);

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    setAvatarStatus('pending');
    setAvatarMessage('');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setAvatarStatus('error');
      setAvatarMessage('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', avatarFile);

    const response = await fetch('/api/profile/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData
    });
    const data = await response.json();

    if (!response.ok) {
      setAvatarStatus('error');
      setAvatarMessage(data.error || 'Gagal mengunggah foto.');
      return;
    }

    setAvatarUrl(data.avatar_url);
    setAvatarFile(null);
    setAvatarStatus('success');
    setAvatarMessage('Foto profil berhasil diperbarui.');
  };

  const handleSaveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameStatus('pending');
    setNameMessage('');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setNameStatus('error');
      setNameMessage('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }

    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ name })
    });
    const data = await response.json();

    if (!response.ok) {
      setNameStatus('error');
      setNameMessage(data.error || 'Gagal menyimpan nama.');
      return;
    }

    setNameStatus('success');
    setNameMessage('Nama berhasil diperbarui.');
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordStatus('pending');
    setPasswordMessage('');

    if (newPassword.length < 8) {
      setPasswordStatus('error');
      setPasswordMessage('Kata sandi baru minimal 8 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus('error');
      setPasswordMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    if (!supabase) {
      setPasswordStatus('error');
      setPasswordMessage('Supabase belum dikonfigurasi.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordStatus('error');
      setPasswordMessage(error.message);
      return;
    }

    setPasswordStatus('success');
    setPasswordMessage('Kata sandi berhasil diubah.');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="px-6 text-center text-sm text-muted-foreground">Memuat profil...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-16">
      <div className="flex w-full flex-col gap-6 px-6">
        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Profil Saya</CardDescription>
            <CardTitle className="text-2xl">Foto profil</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[#e0e0e0] bg-muted">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Foto profil" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-center text-xs text-muted-foreground">Belum ada foto</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                  className="text-sm text-foreground file:mr-3 file:h-8 file:rounded-none file:border-0 file:bg-[#0f62fe] file:px-3 file:text-xs file:font-medium file:text-white hover:file:bg-[#0043ce]"
                />
                <span className="text-xs text-muted-foreground">PNG, JPG, atau WEBP, maksimal 2MB.</span>
                <Button type="button" onClick={handleAvatarUpload} disabled={!avatarFile || avatarStatus === 'pending'} className="w-fit">
                  {avatarStatus === 'pending' ? 'Mengunggah...' : 'Upload Foto'}
                </Button>
              </div>
            </div>
            {avatarMessage ? (
              <p className={`text-sm ${avatarStatus === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>{avatarMessage}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Profil Saya</CardDescription>
            <CardTitle className="text-2xl">Data akun</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveName} className="grid gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Email</span>
                <Input type="email" value={email} disabled />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Nama</span>
                <Input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
              </label>

              {nameMessage ? (
                <p className={`text-sm ${nameStatus === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>{nameMessage}</p>
              ) : null}

              <Button type="submit" disabled={nameStatus === 'pending'} className="w-fit">
                {nameStatus === 'pending' ? 'Menyimpan...' : 'Simpan Nama'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Keamanan</CardDescription>
            <CardTitle className="text-2xl">Ganti kata sandi</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="grid gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Kata sandi baru</span>
                <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Konfirmasi kata sandi baru</span>
                <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
              </label>

              {passwordMessage ? (
                <p className={`text-sm ${passwordStatus === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>{passwordMessage}</p>
              ) : null}

              <Button type="submit" disabled={passwordStatus === 'pending'} className="w-fit">
                {passwordStatus === 'pending' ? 'Menyimpan...' : 'Ganti Kata Sandi'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
