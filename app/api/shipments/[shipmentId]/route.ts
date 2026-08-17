import { NextRequest, NextResponse } from 'next/server';
import { getShipmentDetail } from '@/features/mrp/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ shipmentId: string }> }) {
  const { shipmentId } = await params;
  const parsed = Number(shipmentId);
  if (!Number.isInteger(parsed)) {
    return NextResponse.json({ error: 'ID pengiriman tidak valid.' }, { status: 400 });
  }
  const result = await getShipmentDetail(request, parsed);
  return NextResponse.json(result.body, { status: result.status });
}
