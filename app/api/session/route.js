import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { readSessionToken, SESSION_COOKIE } from '../../../lib/session';

export async function GET() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = readSessionToken(token);

  const { data: settings } = await supabaseAdmin.from('event_settings').select('*').eq('id', 1).single();
  const { data: candidates } = await supabaseAdmin
    .from('candidates').select('id,category,candidate_number,name,department,tagline').eq('active', true);

  let hasVoted = false;
  if (session) {
    const { data: voter } = await supabaseAdmin.from('voters').select('has_voted').eq('id', session.voterId).maybeSingle();
    hasVoted = !!voter?.has_voted;
  }

  const now = Date.now();
  const start = settings?.voting_start ? new Date(settings.voting_start).getTime() : null;
  const end = settings?.voting_end ? new Date(settings.voting_end).getTime() : null;
  const votingOpen = !!(start && end && now >= start && now <= end);

  return NextResponse.json({
    authenticated: !!session,
    email: session?.email || null,
    hasVoted,
    votingOpen,
    serverNow: now,
    votingEnd: end,
    candidates: candidates || [],
  });
}
