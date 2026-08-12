import { NextRequest, NextResponse } from 'next/server';
import { listProductionPlants } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listProductionPlants(request);
  return NextResponse.json(result.body, { status: result.status });
}
