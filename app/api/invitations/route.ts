import { NextRequest, NextResponse } from 'next/server';
import { inviteTeamMember } from '@/features/team/server';

export async function POST(request: NextRequest) {
  const result = await inviteTeamMember(request);
  return NextResponse.json(result.body, { status: result.status });
}
