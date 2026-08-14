import { NextRequest, NextResponse } from 'next/server';
import { uploadAvatar } from '@/features/auth/server';

export async function POST(request: NextRequest) {
  const result = await uploadAvatar(request);
  return NextResponse.json(result.body, { status: result.status });
}
