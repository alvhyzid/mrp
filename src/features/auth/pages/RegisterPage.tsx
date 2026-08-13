'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

// Lihat catatan di LoginPage.tsx: className hex eksplisit di sini kebetulan
// sama dengan token dasar Carbon di src/components/ui/ & app/globals.css
// sejak Tahap 3. Font IBM Plex Sans dimuat sekali di app/layout.tsx.

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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        email,
        password,
        companyName
      })
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data?.error || 'Terjadi kesalahan saat mendaftar.');
      setLoading(false);
      return;
    }

    router.push('/login');
  };

  const carbonInputClass =
    'h-12 rounded-none border-0 border-b border-[#8d8d8d] bg-[#f4f4f4] px-4 text-sm text-[#161616] shadow-none focus-visible:border-transparent focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0f62fe] focus-visible:ring-0';

  return (
    <main className="min-h-screen bg-white py-16">
      <div className="mx-auto max-w-md px-4">
        <Card className="rounded-none border border-[#e0e0e0] bg-white p-8 shadow-none">
          <CardContent className="flex flex-col gap-6 p-0">
            <div>
              <h1 className="text-[1.75rem] font-semibold leading-[1.286] text-[#161616]">Daftar</h1>
              <p className="mt-2 text-sm leading-[1.429] text-[#525252]">Buat akun untuk perusahaan Anda.</p>
            </div>

            <form onSubmit={handleRegister} className="grid gap-5">
              <label className="block">
                <span className="mb-2 block text-xs leading-[1.333] text-[#525252]">Nama</span>
                <Input type="text" value={name} onChange={(event) => setName(event.target.value)} className={carbonInputClass} required />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs leading-[1.333] text-[#525252]">Nama Perusahaan</span>
                <Input
                  type="text"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  className={carbonInputClass}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs leading-[1.333] text-[#525252]">Email</span>
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={carbonInputClass} required />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs leading-[1.333] text-[#525252]">Kata Sandi</span>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={carbonInputClass}
                  required
                />
              </label>

              {error ? <p className="text-sm leading-[1.429] text-[#da1e28]">{error}</p> : null}

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-none bg-[#0f62fe] text-sm font-normal text-white shadow-none hover:bg-[#0043ce] active:bg-[#002d9c] disabled:bg-[#c6c6c6] disabled:text-[#8d8d8d]"
              >
                {loading ? 'Memproses...' : 'Daftar'}
              </Button>
            </form>

            <p className="text-center text-sm leading-[1.429] text-[#525252]">
              Sudah punya akun? <a href="/login" className="text-[#0f62fe] hover:underline">Masuk</a>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
