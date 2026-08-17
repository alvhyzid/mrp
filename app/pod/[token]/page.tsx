import PodConfirmationPage from '@/features/mrp/pages/PodConfirmationPage';

// PUBLIK, TANPA login — TIDAK di dalam grup route (shell), TIDAK ada middleware auth
// di proyek ini yang bisa menyaring route ini juga (dicek: tidak ada middleware.ts).
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PodConfirmationPage token={token} />;
}
