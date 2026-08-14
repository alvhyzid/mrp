import { NextRequest, NextResponse } from 'next/server';
import { getWorkCenterCapacity, updateWorkCenterCapacity } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await getWorkCenterCapacity(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await updateWorkCenterCapacity(request);
  return NextResponse.json(result.body, { status: result.status });
}
