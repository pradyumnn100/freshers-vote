import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(req) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { candidateId, count } = await req.json().catch(() => ({}));
  const delta = Number.isFinite(count) ? Math.trunc(count) : 1;
  if (!candidateId) return NextResponse.json({ error: 'MISSING_CANDIDATE' }, { status: 400 });

  const { data: cand, error: gErr } = await supabaseAdmin
    .from('candidates')
    .select('manual_votes')
    .eq('id', candidateId)
    .single();
  if (gErr || !cand) return NextResponse.json({ error: 'CANDIDATE_NOT_FOUND' }, { status: 404 });

  const newVal = Math.max(0, (cand.manual_votes || 0) + delta);
  const { error: uErr } = await supabaseAdmin
    .from('candidates')
    .update({ manual_votes: newVal })
    .eq('id', candidateId);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({ event: 'manual_vote_adjust', detail: { candidateId, delta, newVal } });

  return NextResponse.json({ ok: true, manual_votes: newVal });
}
