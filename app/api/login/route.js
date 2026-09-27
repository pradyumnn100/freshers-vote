import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_S } from '../../../lib/session';

// No OTP anymore. Eligibility is decided entirely by whether this email
// exists in the `voters` table — which is populated once from email.txt
// via `node scripts/import-voters.js email.txt` (see README).
//
// Trade-off, stated plainly: whoever types a listed email first gets that
// slot. Nothing here confirms the person typing it actually owns that
// inbox — there is no proof of possession, just list membership.
export async function POST(req) {
  const { email } = await req.json();
  const normalized = (email || '').trim().toLowerCase();

  if (!normalized) {
    return NextResponse.json({ error: 'MISSING_EMAIL' }, { status: 400 });
  }

  const { data: voter } = await supabaseAdmin
    .from('voters').select('*').eq('email', normalized).maybeSingle();

  if (!voter) {
    return NextResponse.json({ error: 'NOT_ELIGIBLE' }, { status: 403 });
  }

  if (voter.has_voted) {
    return NextResponse.json({ error: 'ALREADY_VOTED' }, { status: 403 });
  }

  if (!voter.email_verified) {
    await supabaseAdmin.from('voters')
      .update({ email_verified: true, last_login: new Date().toISOString() })
      .eq('id', voter.id);
  } else {
    await supabaseAdmin.from('voters')
      .update({ last_login: new Date().toISOString() })
      .eq('id', voter.id);
  }

  const token = createSessionToken(voter.id, normalized);
  const res = NextResponse.json({ ok: true, hasVoted: voter.has_voted });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
