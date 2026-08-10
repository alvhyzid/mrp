import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6">
        <div className="rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Dashboard</p>
              <h1 className="text-3xl font-semibold text-slate-900">Selamat datang</h1>
              <p className="mt-2 text-slate-600">Halaman dashboard kosong ini memastikan login Supabase berfungsi dan terhubung ke aplikasi.</p>
            </div>
            <Link href="/" className="inline-flex items-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
