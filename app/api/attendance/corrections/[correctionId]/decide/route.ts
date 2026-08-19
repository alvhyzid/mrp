import { NextRequest, NextResponse } from 'next/server';
import { decideAttendanceCorrection } from '@/features/attendance/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ correctionId: string }> }) {
  const { correctionId } = await params;
  const body = await request.json();
  const result = await decideAttendanceCorrection(request, Number(correctionId), body.approve === true);
  return NextResponse.json(result.body, { status: result.status });
}
