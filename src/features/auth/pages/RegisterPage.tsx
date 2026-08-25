'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, InlineNotification, PasswordInput, TextInput } from '@carbon/react';
import { ArrowRight } from '@carbon/icons-react';
import { LayarPublik } from '@/components/ui/layar-publik';

// Dimigrasikan ke Carbon pada 25 Agu 2026 (DS-02). Lihat catatan lengkapnya di LoginPage.tsx.
//
// Layar inilah yang diperiksa pemilik produk berdampingan dengan katalog Carbon resmi, dan
// yang melahirkan seluruh gelombang migrasi ini. Ia juga LANGKAH PERTAMA dari rantai "berdiri
// dari nol" — layar pertama yang dilihat tenant baru, dan kesan pertama produk yang dijual.

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, companyName })
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data?.error || 'Terjadi kesalahan saat mendaftar.');
      setLoading(false);
      return;
    }

    router.push('/login');
  };

  return (
    <LayarPublik
      judul="Daftar"
      pengantar="Buat akun untuk perusahaan Anda."
      aksi={
        <>
          <Button size="lg" kind="secondary" href="/login" as={Link}>
            Masuk
          </Button>
          <Button size="lg" type="submit" form="form-daftar" disabled={loading} renderIcon={ArrowRight}>
            {loading ? 'Memproses…' : 'Daftar'}
          </Button>
        </>
      }
    >
      {error && (
        <InlineNotification
          kind="error"
          title="Gagal mendaftar"
          subtitle={error}
          onCloseButtonClick={() => setError('')}
          lowContrast
          className="publik-pemberitahuan"
        />
      )}

      <form id="form-daftar" onSubmit={handleRegister} className="publik-form">
        <TextInput
          size="lg"
          id="nama"
          labelText="Nama Anda"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        <TextInput
          size="lg"
          id="nama-perusahaan"
          labelText="Nama perusahaan"
          helperText="Nama ini muncul di dokumen yang diterbitkan sistem, seperti surat jalan."
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          required
        />

        <TextInput
          size="lg"
          id="email"
          type="email"
          labelText="Email"
          helperText="Dipakai untuk masuk, dan untuk memulihkan akun bila kata sandi terlupa."
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <PasswordInput
          size="lg"
          id="kata-sandi"
          labelText="Kata sandi"
          showPasswordLabel="Tampilkan kata sandi"
          hidePasswordLabel="Sembunyikan kata sandi"
          helperText="Minimal 8 karakter."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

      </form>
    </LayarPublik>
  );
}
