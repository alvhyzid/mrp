import { NextRequest, NextResponse } from 'next/server';
import { refreshLowStockAlerts } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await refreshLowStockAlerts(request);
  return NextResponse.json(result.body, { status: result.status });
}
