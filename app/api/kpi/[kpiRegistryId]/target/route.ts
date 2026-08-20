import { NextRequest, NextResponse } from 'next/server';
import { updateKpiTarget } from '@/features/kpi/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kpiRegistryId: string }> }) {
  const { kpiRegistryId } = await params;
  const result = await updateKpiTarget(request, Number(kpiRegistryId));
  return NextResponse.json(result.body, { status: result.status });
}
