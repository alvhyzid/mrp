import { NextRequest, NextResponse } from 'next/server';
import { updateShipmentStatus } from '@/features/mrp/server';

export async function PATCH(request: NextRequest) {
  const result = await updateShipmentStatus(request);
  return NextResponse.json(result.body, { status: result.status });
}
