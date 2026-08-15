import { NextRequest, NextResponse } from 'next/server';
import { listRoutings, createRouting, updateRouting } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listRoutings(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createRouting(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await updateRouting(request);
  return NextResponse.json(result.body, { status: result.status });
}
