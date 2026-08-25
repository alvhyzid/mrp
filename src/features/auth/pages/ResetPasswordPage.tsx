'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, InlineNotification, PasswordInput, SkeletonText } from '@carbon/react';
import { ArrowRight } from '@carbon/icons-react';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { LayarPublik } from '@/components/ui/layar-publik';

// Dimigrasikan ke Carbon pada 25 Agu 2026 (DS-02).
//
// Keadaan MEMUAT sekarang memakai SkeletonText Carbon, bukan tulisan "Memeriksa tautan
// reset...". Alasannya bukan gaya: skeleton menempati ruang yang sama dengan isi yang akan
// muncul, jadi halaman tidak melompat saat pemeriksaannya selesai. Kalimat satu baris selalu
// melompat, dan lompatan itu paling terasa justru di layar yang dibuka orang dalam keadaan
// panik karena tidak bisa masuk.

export default function ResetPasswordPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setCheckingSession(false);
      return;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setSessionReady(true);
        setCheckingSession(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setSessionReady(true);
      }
      setCheckingSession(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('pending');
    setMessage('');

    if (newPassword.length < 8) {
      setStatus('error');
      setMessage('Kata sandi baru minimal 8 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    if (!supabase) {
      setStatus('error');
      setMessage('Supabase belum dikonfigurasi.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }

    setStatus('success');
    setMessage('Kata sandi berhasil diatur ulang.');
  };

  if (checkingSession) {
    return (
      <LayarPublik judul="Atur ulang kata sandi">
        <SkeletonText paragraph lineCount={4} />
      </LayarPublik>
    );
  }

  if (!sessionReady) {
    return (
      <LayarPublik
        judul="Tautan sudah tidak berlaku"
        aksi={
          <Button size="lg" onClick={() => router.push('/forgot-password')} renderIcon={ArrowRight}>
            Minta tautan baru
          </Button>
        }
      >
        <InlineNotification
          kind="error"
          title="Tautan tidak berlaku"
          subtitle="Tautan atur ulang kata sandi hanya berlaku sekali dan punya batas waktu. Silakan minta tautan baru."
          hideCloseButton
          lowContrast
          className="publik-pemberitahuan"
        />
      </LayarPublik>
    );
  }

  return (
    <LayarPublik
      judul="Atur ulang kata sandi"
      pengantar="Masukkan kata sandi baru untuk akun Anda."
      aksi={
        status === 'success' ? (
          <Button size="lg" type="button" onClick={() => router.push('/dashboard')} renderIcon={ArrowRight}>
            Lanjut ke dasbor
          </Button>
        ) : (
          <Button size="lg" type="submit" form="form-sandi-baru" disabled={status === 'pending'} renderIcon={ArrowRight}>
            {status === 'pending' ? 'Menyimpan…' : 'Simpan kata sandi baru'}
          </Button>
        )
      }
    >
      {message && (
        <InlineNotification
          kind={status === 'success' ? 'success' : 'error'}
          title={status === 'success' ? 'Tersimpan' : 'Gagal menyimpan'}
          subtitle={message}
          onCloseButtonClick={() => setMessage('')}
          lowContrast
          className="publik-pemberitahuan"
        />
      )}

      <form id="form-sandi-baru" onSubmit={handleSubmit} className="publik-form">
        <PasswordInput
          size="lg"
          id="kata-sandi-baru"
          labelText="Kata sandi baru"
          showPasswordLabel="Tampilkan kata sandi"
          hidePasswordLabel="Sembunyikan kata sandi"
          helperText="Minimal 8 karakter."
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />

        <PasswordInput
          size="lg"
          id="konfirmasi-kata-sandi"
          labelText="Ulangi kata sandi baru"
          showPasswordLabel="Tampilkan kata sandi"
          hidePasswordLabel="Sembunyikan kata sandi"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />

      </form>
    </LayarPublik>
  );
}
