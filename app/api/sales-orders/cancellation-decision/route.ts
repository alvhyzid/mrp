import { NextRequest, NextResponse } from 'next/server';
import { putuskanPembatalan } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await putuskanPembatalan(request);
  return NextResponse.json(result.body, { status: result.status });
}
