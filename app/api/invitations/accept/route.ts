import { NextRequest, NextResponse } from 'next/server';
import { acceptInvitation } from '@/features/auth/server';

export async function POST(request: NextRequest) {
  const result = await acceptInvitation(request);
  return NextResponse.json(result.body, { status: result.status });
}
