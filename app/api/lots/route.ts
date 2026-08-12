import { NextRequest, NextResponse } from 'next/server';
import { listLots } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listLots(request);
  return NextResponse.json(result.body, { status: result.status });
}
