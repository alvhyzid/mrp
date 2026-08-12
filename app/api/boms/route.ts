import { NextRequest, NextResponse } from 'next/server';
import { listBoms, createBom, updateBom } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listBoms(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createBom(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await updateBom(request);
  return NextResponse.json(result.body, { status: result.status });
}
