'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, InlineNotification, TextInput } from '@carbon/react';
import { ArrowRight } from '@carbon/icons-react';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { LayarPublik } from '@/components/ui/layar-publik';

// Dimigrasikan ke Carbon pada 25 Agu 2026 (DS-02).
//
// Layar ini termasuk yang paling jauh menyimpang sebelum migrasi: ia sama sekali tidak meniru
// Carbon, melainkan memakai palet Tailwind (slate/emerald/rose) dan sudut membulat 24px — dua
// sistem visual yang berbeda dari layar masuk yang bersebelahan dengannya dalam satu alur.
// Orang yang lupa kata sandinya berpindah dari layar Carbon ke layar bergaya lain, lalu kembali
// lagi. Perpindahan itulah yang membuat produk terasa dirakit dari potongan.

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('pending');
    setMessage('');

    if (!hasSupabaseConfig || !supabase) {
      setStatus('error');
      setMessage('Supabase belum dikonfigurasi.');
      return;
    }

    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`
    });

    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }

    setStatus('success');
    setMessage(
      'Kalau email tersebut terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim. Silakan periksa kotak masuk Anda.'
    );
  };

  return (
    <LayarPublik
      judul="Lupa kata sandi"
      pengantar="Masukkan email Anda, kami kirim tautan untuk mengatur ulang kata sandi."
    >
      {message && (
        <InlineNotification
          kind={status === 'success' ? 'success' : 'error'}
          title={status === 'success' ? 'Tautan dikirim' : 'Gagal mengirim'}
          subtitle={message}
          onCloseButtonClick={() => setMessage('')}
          lowContrast
          className="publik-pemberitahuan"
        />
      )}

      <form onSubmit={handleSubmit} className="publik-form">
        <TextInput
          size="lg"
          id="email"
          type="email"
          labelText="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <div className="publik-aksi">
          <Button size="lg" type="submit" disabled={status === 'pending'} renderIcon={ArrowRight}>
            {status === 'pending' ? 'Mengirim…' : 'Kirim tautan'}
          </Button>
        </div>
      </form>

      <p className="publik-kaki">Ingat kata sandinya?</p>
      <div className="publik-aksi publik-aksi--rapat">
        <Button size="lg" kind="ghost" href="/login" as={Link}>
          Masuk
        </Button>
      </div>
    </LayarPublik>
  );
}
