import { NextRequest, NextResponse } from 'next/server';
import { registerCompanyAdmin } from '@/features/auth/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const origin = new URL(request.url).origin;
  const result = await registerCompanyAdmin({ ...body, origin });
  return NextResponse.json(result.body, { status: result.status });
}
