'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { getDashboardRouteForRole } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

// Halaman ini awalnya jadi eksperimen terisolasi gaya Carbon Design System
// (IBM) sebelum diperluas company-wide di Tahap 3 — className hex eksplisit
// di sini sekarang KEBETULAN sama dengan token dasar src/components/ui/ &
// app/globals.css (sumbernya sama: @carbon/themes, @carbon/layout,
// @carbon/type, @carbon/colors via unpkg), sengaja dibiarkan sebagai
// override eksplisit di sini karena sebelumnya sudah direview & disetujui
// apa adanya. Font IBM Plex Sans sekarang dimuat sekali di app/layout.tsx.

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
    <main className="min-h-screen bg-white py-16">
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
