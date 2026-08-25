'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, InlineNotification, PasswordInput, TextInput } from '@carbon/react';
import { ArrowRight } from '@carbon/icons-react';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { getDashboardRouteForRole } from '@/lib/roles';
import { LayarPublik } from '@/components/ui/layar-publik';

// Dimigrasikan ke Carbon pada 25 Agu 2026 (DS-02).
//
// Versi sebelumnya MENIRU Carbon dengan tangan: 10 warna heksadesimal ditulis langsung, tinggi
// field 48px, dan penanda fokus buatan sendiri. Nilainya sebagian besar benar — dan itulah yang
// membuatnya berbahaya. Yang meleset tidak terlihat sampai dibandingkan berdampingan dengan
// katalog Carbon: tombol dipaksa melebar penuh dengan teks di tengah (Carbon menaruh teks di
// KIRI dan lebarnya mengikuti isi), kartunya diberi bingkai (Tile Carbon tidak berbingkai), dan
// penanda fokusnya 3px hitam (Carbon 2px biru).
//
// Sekarang tidak ada satu pun angka atau warna yang ditulis di sini — seluruhnya dibawa
// komponen Carbon. Itu juga yang membuat layar ini ikut berubah sendiri saat temanya diganti.

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    if (!hasSupabaseConfig || !supabase) {
      setError('Supabase belum dikonfigurasi. Silakan periksa variabel lingkungan.');
      setLoading(false);
      return;
    }

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || 'Gagal melakukan login.');
      setLoading(false);
      return;
    }

    const session = data.session;
    if (!session) {
      setError('Gagal membuat sesi login.');
      setLoading(false);
      return;
    }

    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });

    if (setSessionError) {
      setError(setSessionError.message);
      setLoading(false);
      return;
    }

    // Redirect langsung ke dashboard department (kalau role user punya satu) — TANPA mampir
    // dulu ke /dashboard generik untuk fetch /api/me. Role sudah ada di data.user.tenant.role
    // dari respons /api/login barusan, jadi tidak perlu request tambahan. Ini menghilangkan 1
    // putaran /api/me penuh (auth.getUser + query users + query companies, ~550-900ms terukur)
    // yang sebelumnya terjadi 2x berturut-turut.
    const explicitRedirect = new URLSearchParams(window.location.search).get('redirectTo');
    const departmentRoute = getDashboardRouteForRole(data?.user?.tenant?.role);
    router.push(explicitRedirect || departmentRoute || '/dashboard');
  };

  return (
    <LayarPublik
      judul="Masuk"
      pengantar="Gunakan email dan kata sandi akun Anda."
      aksi={
        <>
          {/* Sekunder lebih dulu, utama paling kanan — aturan Carbon untuk aksi di dalam
              wadah berstruktur. Di layar sempit keduanya menumpuk dan "Masuk" jatuh ke bawah. */}
          <Button size="lg" kind="secondary" href="/register" as={Link}>
            Daftar
          </Button>
          <Button size="lg" type="submit" form="form-masuk" disabled={loading} renderIcon={ArrowRight}>
            {loading ? 'Memproses…' : 'Masuk'}
          </Button>
        </>
      }
    >
      {error && (
        <InlineNotification
          kind="error"
          title="Gagal masuk"
          subtitle={error}
          onCloseButtonClick={() => setError('')}
          lowContrast
          className="publik-pemberitahuan"
        />
      )}

      <form id="form-masuk" onSubmit={handleLogin} className="publik-form">
        <TextInput
          size="lg"
          id="email"
          type="email"
          labelText="Email"
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
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {/* "Lupa kata sandi?" SENGAJA tinggal di dalam formulir, bukan ikut ke kaki kartu.
            Anatomi login Carbon menempatkannya sebagai tautan pemulihan yang menempel pada
            field-nya, bukan sebagai aksi sejajar dengan Masuk. Bentuknya tombol ghost supaya
            area tekannya tetap 48px — tautan sebaris hanya 18px dan tidak bisa ditekan jari. */}
        <div className="publik-aksi publik-aksi--rapat">
          <Button size="lg" kind="ghost" href="/forgot-password" as={Link}>
            Lupa kata sandi?
          </Button>
        </div>
      </form>
    </LayarPublik>
  );
}
