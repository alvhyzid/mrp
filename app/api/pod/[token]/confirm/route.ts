import { NextRequest, NextResponse } from 'next/server';
import { confirmDelivery } from '@/features/mrp/server';

// Route PUBLIK — sengaja TIDAK memeriksa Authorization header sama sekali.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await confirmDelivery(request, token);
  return NextResponse.json(result.body, { status: result.status });
}
