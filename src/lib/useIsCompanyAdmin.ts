'use client';

import { useEffect, useState } from 'react';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';

// Sesi 6 (21 Agu 2026, 6.4) — dipakai ProvenanceInfoButton utk memutuskan
// apakah "Detail Teknis" (identifier tabel/kolom mentah) boleh ditampilkan --
// HANYA company_admin. Mandiri (tidak butuh prop role dari tiap halaman
// pemanggil) supaya ~15 halaman yang sudah memakai ProvenanceInfoButton tidak
// perlu diubah satu per satu -- cukup 1 panggilan /api/me, DI-CACHE modul
// (bukan per-instance) supaya banyak tombol Asal-Usul di 1 halaman yang sama
// tidak memicu banyak panggilan network berulang.
let cachedIsAdmin: boolean | null = null;
let inFlight: Promise<boolean> | null = null;

async function fetchIsCompanyAdmin(): Promise<boolean> {
  if (cachedIsAdmin !== null) return cachedIsAdmin;
  if (inFlight) return inFlight;
  if (!hasSupabaseConfig || !supabase) return false;

  inFlight = (async () => {
    try {
      const { data } = await supabase!.auth.getSession();
      const accessToken = data?.session?.access_token;
      if (!accessToken) return false;
      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return false;
      const body = await res.json();
      const isAdmin = body?.user?.role === 'company_admin';
      cachedIsAdmin = isAdmin;
      return isAdmin;
    } catch {
      return false;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function useIsCompanyAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(cachedIsAdmin ?? false);

  useEffect(() => {
    let cancelled = false;
    fetchIsCompanyAdmin().then((result) => {
      if (!cancelled) setIsAdmin(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}
