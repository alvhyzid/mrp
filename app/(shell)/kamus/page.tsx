import { Suspense } from 'react';
import KamusPage from '@/features/kamus/pages/KamusPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <KamusPage />
    </Suspense>
  );
}
