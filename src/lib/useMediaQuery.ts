'use client';

import { useCallback, useSyncExternalStore } from 'react';

// SATU-SATUNYA kait media query di aplikasi ini (DS-21, 27 Agu 2026).
//
// ============================================================================
// KENAPA DITULIS SENDIRI, PADAHAL CARBON PUNYA
// ============================================================================
// @carbon/react memang membawa useMatchMedia, TAPI ia TIDAK diekspor publik — ia hidup di
// node_modules/@carbon/react/lib/internal/useMatchMedia.js. Mengimpor dari lib/internal
// berarti bergantung pada bagian yang sengaja tidak dijanjikan stabil, dan ia bisa hilang
// di versi mana pun tanpa disebut catatan rilis.
//
// ============================================================================
// KENAPA useSyncExternalStore, BUKAN useState + useEffect
// ============================================================================
// Versi pertama kait ini memakai useState + useEffect dan MENAMBAH SATU MASALAH LINT baru:
// `react-hooks/set-state-in-effect`. Peringatannya benar, bukan kebisingan — memanggil
// setState langsung di badan effect memicu render berantai.
//
// useSyncExternalStore adalah API yang memang disediakan React untuk berlangganan sumber
// di luar React, dan ia menyelesaikan TIGA hal sekaligus yang sebelumnya ditambal manual:
//   1. Nilai render pertama sudah benar — tidak ada kedipan tata letak saat modal dibuka.
//   2. Render di server punya jalurnya sendiri lewat argumen potret server.
//   3. Tidak ada setState di effect sama sekali, jadi tidak ada render berantai.
//
// ============================================================================
// YANG DITANGANI DAN YANG TIDAK
// ============================================================================
// DITANGANI: render di server, peramban tanpa matchMedia, perubahan ukuran setelah render,
// pembersihan pendengar, dan perubahan string kueri (kedua callback ber-dependensi kueri).
// TIDAK DITANGANI: kueri yang dibangun ulang setiap render tanpa dimemo akan melanggan
// ulang setiap render. Pemanggilnya bertanggung jawab menjaga string kuerinya stabil —
// PenandaLangkah menurunkannya dari jumlah langkah, yang praktis tidak berubah.
export function useMediaQuery(kueri: string, bawaanSaatServer = false): boolean {
  const berlangganan = useCallback(
    (beriTahu: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {};
      }
      const daftar = window.matchMedia(kueri);
      daftar.addEventListener('change', beriTahu);
      return () => daftar.removeEventListener('change', beriTahu);
    },
    [kueri]
  );

  const potretKlien = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return bawaanSaatServer;
    }
    return window.matchMedia(kueri).matches;
  }, [kueri, bawaanSaatServer]);

  const potretServer = useCallback(() => bawaanSaatServer, [bawaanSaatServer]);

  return useSyncExternalStore(berlangganan, potretKlien, potretServer);
}
