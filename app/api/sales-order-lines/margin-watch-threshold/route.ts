import { NextRequest, NextResponse } from 'next/server';
import { updateMarginFloorThreshold } from '@/features/mrp/server';

export async function PATCH(request: NextRequest) {
  const result = await updateMarginFloorThreshold(request);
  return NextResponse.json(result.body, { status: result.status });
}
