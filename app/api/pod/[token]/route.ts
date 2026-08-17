import { NextRequest, NextResponse } from 'next/server';
import { getShipmentByPodToken } from '@/features/mrp/server';

// Route PUBLIK — sengaja TIDAK memeriksa Authorization header sama sekali.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getShipmentByPodToken(token);
  return NextResponse.json(result.body, { status: result.status });
}
