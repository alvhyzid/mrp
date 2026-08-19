import { NextRequest, NextResponse } from 'next/server';
import { confirmKamusTerm } from '@/features/kamus/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kamusTermId: string }> }) {
  const { kamusTermId } = await params;
  const result = await confirmKamusTerm(request, Number(kamusTermId));
  return NextResponse.json(result.body, { status: result.status });
}
