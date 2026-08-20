import { NextRequest, NextResponse } from 'next/server';
import { updateKpiVisibility } from '@/features/kpi/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kpiRegistryId: string }> }) {
  const { kpiRegistryId } = await params;
  const result = await updateKpiVisibility(request, Number(kpiRegistryId));
  return NextResponse.json(result.body, { status: result.status });
}
