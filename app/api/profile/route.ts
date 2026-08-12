import { NextRequest, NextResponse } from 'next/server';
import { getProfile, updateProfile } from '@/features/auth/server';

export async function GET(request: NextRequest) {
  const result = await getProfile(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await updateProfile(request);
  return NextResponse.json(result.body, { status: result.status });
}
