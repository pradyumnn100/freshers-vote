import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(req) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { data: candidates, error: cErr } = await supabaseAdmin
    .from('candidates')
    .select('id, category, candidate_number, name, department, photo_url, active, manual_votes')
    .order('category', { ascending: true })
    .order('candidate_number', { ascending: true });
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const { data: votes, error: vErr } = await supabaseAdmin
    .from('votes')
    .select('candidate_id');
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  const realCounts = {};
  for (const v of votes) realCounts[v.candidate_id] = (realCounts[v.candidate_id] || 0) + 1;

  const results = candidates.map(c => {
    const real_votes = realCounts[c.id] || 0;
    const manual_votes = c.manual_votes || 0;
    return { ...c, real_votes, manual_votes, total_votes: real_votes + manual_votes };
  });

  return NextResponse.json({ results });
}
