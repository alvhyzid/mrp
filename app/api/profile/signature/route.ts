import { NextRequest, NextResponse } from 'next/server';
import { uploadSignature } from '@/features/auth/server';

export async function POST(request: NextRequest) {
  const result = await uploadSignature(request);
  return NextResponse.json(result.body, { status: result.status });
}
