import { NextRequest, NextResponse } from 'next/server';
import { listSystemAlerts, acknowledgeSystemAlert } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listSystemAlerts(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await acknowledgeSystemAlert(request);
  return NextResponse.json(result.body, { status: result.status });
}
