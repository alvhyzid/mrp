import { NextRequest, NextResponse } from 'next/server';
import { listShipments, createShipmentWithSignature } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listShipments(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createShipmentWithSignature(request);
  return NextResponse.json(result.body, { status: result.status });
}
