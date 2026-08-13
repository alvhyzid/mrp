'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IBM_Plex_Sans } from 'next/font/google';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { getDashboardRouteForRole } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

// Eksperimen terisolasi: gaya visual Carbon Design System (IBM) diterapkan
// HANYA di halaman /login dan /register lewat className override di sini —
// src/components/ui/{button,input,card}.tsx SENGAJA tidak disentuh sama
// sekali (twMerge di cn() membuat override className di titik pemakaian ini
// aman, tanpa mengubah tampilan komponen di halaman lain). Nilai warna,
// spacing, dan tipografi diambil langsung dari source resmi Carbon
// (@carbon/themes, @carbon/layout, @carbon/type, @carbon/colors via unpkg),
// bukan tebakan — lihat catatan token di bawah.
const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] });

// Token Carbon yang dipakai (white theme, sumber: unpkg @carbon/themes,
// @carbon/layout, @carbon/type, @carbon/colors):
// - interactive/focus/link-primary (Blue 60): #0f62fe
// - button-primary hover (Blue 70): #0043ce
// - button-primary active (Blue 80): #002d9c
// - text-primary: #161616, text-secondary: #525252
// - border-strong-01: #8d8d8d, border-subtle-01: #c6c6c6, layerAccent01: #e0e0e0
// - field-01 (input bg): #f4f4f4
// - support-error: #da1e28
// - spacing-05=1rem, spacing-07=2rem, spacing-09=3rem (field/button height)
// - label-01/helper-text-01: 12px/1.333, body-compact-01: 14px/1.286

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
      headers: {
        'Content-Type': 'application/json'
      },
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

    // Redirect langsung ke dashboard department (kalau role user punya satu) —
    // TANPA mampir dulu ke /dashboard generik untuk fetch /api/me. Role sudah
    // ada di data.user.tenant.role dari respons /api/login barusan, jadi tidak
    // perlu request tambahan. Ini menghilangkan 1 putaran /api/me penuh
    // (auth.getUser + query users + query companies, ~550-900ms terukur) yang
    // sebelumnya terjadi 2x berturut-turut (sekali di /dashboard, sekali lagi
    // di halaman department) — sekarang cukup sekali, dan cuma kalau memang
    // dituju ke halaman umum /dashboard.
    const explicitRedirect = new URLSearchParams(window.location.search).get('redirectTo');
    const departmentRoute = getDashboardRouteForRole(data?.user?.tenant?.role);
    router.push(explicitRedirect || departmentRoute || '/dashboard');
  };

  return (
    <main className={`${ibmPlexSans.className} min-h-screen bg-white py-16`}>
      <div className="mx-auto max-w-md px-4">
        <Card className="rounded-none border border-[#e0e0e0] bg-white p-8 shadow-none">
          <CardContent className="flex flex-col gap-6 p-0">
            <div>
              <h1 className="text-[1.75rem] font-semibold leading-[1.286] text-[#161616]">Masuk</h1>
              <p className="mt-2 text-sm leading-[1.429] text-[#525252]">Gunakan email dan kata sandi akun Anda.</p>
            </div>

            <form onSubmit={handleLogin} className="grid gap-5">
              <label className="block">
                <span className="mb-2 block text-xs leading-[1.333] text-[#525252]">Email</span>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 rounded-none border-0 border-b border-[#8d8d8d] bg-[#f4f4f4] px-4 text-sm text-[#161616] shadow-none focus-visible:border-transparent focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0f62fe] focus-visible:ring-0"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs leading-[1.333] text-[#525252]">Kata Sandi</span>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 rounded-none border-0 border-b border-[#8d8d8d] bg-[#f4f4f4] px-4 text-sm text-[#161616] shadow-none focus-visible:border-transparent focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0f62fe] focus-visible:ring-0"
                  required
                />
              </label>

              <a href="/forgot-password" className="text-right text-sm leading-[1.429] text-[#0f62fe] hover:underline">
                Lupa kata sandi?
              </a>

              {error ? <p className="text-sm leading-[1.429] text-[#da1e28]">{error}</p> : null}

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-none bg-[#0f62fe] text-sm font-normal text-white shadow-none hover:bg-[#0043ce] active:bg-[#002d9c] disabled:bg-[#c6c6c6] disabled:text-[#8d8d8d]"
              >
                {loading ? 'Memproses...' : 'Masuk'}
              </Button>
            </form>

            <p className="text-center text-sm leading-[1.429] text-[#525252]">
              Belum punya akun? <a href="/register" className="text-[#0f62fe] hover:underline">Daftar</a>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
