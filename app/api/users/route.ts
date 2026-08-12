import { NextRequest, NextResponse } from 'next/server';
import { listTeamMembers, updateTeamMember } from '@/features/team/server';

export async function GET(request: NextRequest) {
  const result = await listTeamMembers(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await updateTeamMember(request);
  return NextResponse.json(result.body, { status: result.status });
}
