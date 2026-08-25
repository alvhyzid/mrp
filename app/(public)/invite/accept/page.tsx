import InviteAcceptPage from '@/features/auth/pages/InviteAcceptPage';

type InviteAcceptRouteProps = {
  searchParams?: Promise<{ token?: string | string[] }>;
};

export default async function InviteAcceptRoute({ searchParams }: InviteAcceptRouteProps) {
  const params = searchParams ? await searchParams : undefined;
  const rawToken = params?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken ?? null;
  return <InviteAcceptPage token={token} />;
}
