import { NextRequest, NextResponse } from 'next/server';
import { setWorkOrderStatus } from '@/features/mrp/server';

export async function PATCH(request: NextRequest) {
  const result = await setWorkOrderStatus(request);
  return NextResponse.json(result.body, { status: result.status });
}
