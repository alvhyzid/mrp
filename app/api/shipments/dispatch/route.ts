import { NextRequest, NextResponse } from 'next/server';
import { processShipmentDispatch } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await processShipmentDispatch(request);
  return NextResponse.json(result.body, { status: result.status });
}
