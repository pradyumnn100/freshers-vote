import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { readSessionToken, SESSION_COOKIE } from '../../../lib/session';

export async function POST(req) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = readSessionToken(token);
  if (!session) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });

  const { mrCandidateId, msCandidateId, lat, lng, accuracy } = await req.json();
  if (!mrCandidateId || !msCandidateId || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('cast_vote', {
    p_voter_id: session.voterId,
    p_mr_candidate_id: mrCandidateId,
    p_ms_candidate_id: msCandidateId,
    p_lat: lat,
    p_lng: lng,
    p_accuracy: accuracy ?? 9999,
  });

  if (error) {
    const code = error.message?.includes('VOTING_CLOSED') ? 'VOTING_CLOSED'
      : error.message?.includes('OUTSIDE_GEOFENCE') ? 'OUTSIDE_GEOFENCE'
      : error.message?.includes('LOCATION_ACCURACY_TOO_LOW') ? 'LOCATION_ACCURACY_TOO_LOW'
      : error.message?.includes('ALREADY_VOTED') ? 'ALREADY_VOTED'
      : error.message?.includes('NOT_AUTHENTICATED') ? 'NOT_AUTHENTICATED'
      : error.message?.includes('INVALID_MR_CANDIDATE') ? 'INVALID_MR_CANDIDATE'
      : error.message?.includes('INVALID_MS_CANDIDATE') ? 'INVALID_MS_CANDIDATE'
      : 'SERVER_ERROR';
    return NextResponse.json({ error: code }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...data });
}
