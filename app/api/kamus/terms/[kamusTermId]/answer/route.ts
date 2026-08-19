import { NextRequest, NextResponse } from 'next/server';
import { answerKamusTerm } from '@/features/kamus/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kamusTermId: string }> }) {
  const { kamusTermId } = await params;
  const result = await answerKamusTerm(request, Number(kamusTermId));
  return NextResponse.json(result.body, { status: result.status });
}
