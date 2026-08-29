import { NextRequest, NextResponse } from 'next/server';
import { ajukanPembatalan } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await ajukanPembatalan(request);
  return NextResponse.json(result.body, { status: result.status });
}
