import { NextRequest, NextResponse } from 'next/server';
import { listProductionDisruptions, createProductionDisruption, resolveProductionDisruption } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listProductionDisruptions(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createProductionDisruption(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await resolveProductionDisruption(request);
  return NextResponse.json(result.body, { status: result.status });
}
