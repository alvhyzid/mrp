import { NextRequest, NextResponse } from 'next/server';
import { getKamusTermSampleValues } from '@/features/kamus/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ kamusTermId: string }> }) {
  const { kamusTermId } = await params;
  const result = await getKamusTermSampleValues(request, Number(kamusTermId));
  return NextResponse.json(result.body, { status: result.status });
}
