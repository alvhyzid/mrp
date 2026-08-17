import { NextRequest, NextResponse } from 'next/server';
import { listShipments, createShipment } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listShipments(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createShipment(request);
  return NextResponse.json(result.body, { status: result.status });
}
