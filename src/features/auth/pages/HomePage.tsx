import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full rounded-3xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
          <h1 className="text-4xl font-semibold text-slate-900">MRP SaaS</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Fondasi platform MRP multi-tenant untuk manufaktur. Login dulu untuk melanjutkan.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link href="/login" className="inline-flex items-center justify-center rounded-none bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
              Masuk
            </Link>
            <Link href="/register" className="inline-flex items-center justify-center rounded-none border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
              Daftar
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
