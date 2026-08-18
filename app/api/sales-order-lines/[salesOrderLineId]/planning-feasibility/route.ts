import { NextRequest, NextResponse } from 'next/server';
import { getPlanningFeasibility } from '@/features/mrp/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ salesOrderLineId: string }> }) {
  const { salesOrderLineId } = await params;
  const parsed = Number(salesOrderLineId);
  if (!Number.isInteger(parsed)) {
    return NextResponse.json({ error: 'ID baris sales order tidak valid.' }, { status: 400 });
  }
  const result = await getPlanningFeasibility(request, parsed);
  return NextResponse.json(result.body, { status: result.status });
}
