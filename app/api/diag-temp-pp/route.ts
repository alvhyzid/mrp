import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// DIAGNOSTIK SEMENTARA (23 Agu 2026, insiden PP) -- DIHAPUS segera setelah dipakai.
// TIDAK PERNAH mengembalikan nilai kunci apa pun, hanya GENERASI-nya + hasil query.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const gen = (v: string) => (v.startsWith('sb_publishable_') ? 'BARU-publishable' : v.startsWith('sb_secret_') ? 'BARU-secret' : v.startsWith('eyJ') ? 'LAMA-legacy-JWT' : v ? 'lain' : 'KOSONG');

  let usersCount: number | string = 'belum dicoba';
  let usersErr = '';
  try {
    const admin = createClient(url, svc, { auth: { persistSession: false } });
    const { count, error } = await admin.from('users').select('*', { count: 'exact', head: true });
    usersCount = count ?? 'null';
    if (error) usersErr = error.message;
  } catch (e) {
    usersErr = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    projectRef: url.replace('https://', '').split('.')[0],
    anonGen: gen(anon),
    serviceGen: gen(svc),
    usersCount,
    usersErr
  });
}
