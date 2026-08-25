'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { ArrowRight } from '@carbon/icons-react';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { LayarPublik } from '@/components/ui/layar-publik';

type InviteAcceptPageProps = {
  token: string | null;
};

// Dimigrasikan ke Carbon pada 25 Agu 2026 (DS-02).
//
// Keadaan "sedang memproses" memakai InlineLoading Carbon, yang membawa peran ARIA dan
// pengumuman untuk pembaca layar secara bawaan. Versi sebelumnya hanya menampilkan paragraf
// "Memproses undangan..." — terlihat sama bagi yang bisa melihat layar, dan tidak diumumkan
// sama sekali bagi yang tidak.

export default function InviteAcceptPage({ token }: InviteAcceptPageProps) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const acceptInvite = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Token undangan tidak ditemukan di alamat halaman ini.');
        return;
      }

      if (!hasSupabaseConfig || !supabase) {
        setStatus('error');
        setMessage('Supabase belum dikonfigurasi.');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        router.push(`/login?redirectTo=/invite/accept?token=${encodeURIComponent(token)}`);
        return;
      }

      setStatus('pending');
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();
      if (!response.ok) {
        setStatus('error');
        setMessage(data.error || 'Gagal menerima undangan.');
        return;
      }

      setStatus('success');
      setMessage('Undangan berhasil diterima. Anda sekarang menjadi bagian dari perusahaan ini.');
    };

    acceptInvite();
  }, [router, token]);

  return (
    <LayarPublik judul="Terima undangan perusahaan">
      {(status === 'idle' || status === 'pending') && (
        <InlineLoading
          description={status === 'idle' ? 'Memeriksa token undangan…' : 'Memproses undangan…'}
        />
      )}

      {status === 'success' && (
        <InlineNotification
          kind="success"
          title="Undangan diterima"
          subtitle={message}
          hideCloseButton
          lowContrast
          className="publik-pemberitahuan"
        />
      )}

      {status === 'error' && (
        <InlineNotification
          kind="error"
          title="Gagal menerima undangan"
          subtitle={message}
          hideCloseButton
          lowContrast
          className="publik-pemberitahuan"
        />
      )}

      {status === 'success' && (
        <div className="publik-aksi">
          <Button size="lg" onClick={() => router.push('/dashboard')} renderIcon={ArrowRight}>
            Masuk ke dasbor
          </Button>
        </div>
      )}
    </LayarPublik>
  );
}
