import { NextRequest, NextResponse } from 'next/server';
import { reopenWorkOrder } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await reopenWorkOrder(request);
  return NextResponse.json(result.body, { status: result.status });
}
