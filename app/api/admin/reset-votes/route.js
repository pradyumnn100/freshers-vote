import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

const ANY_ID = '00000000-0000-0000-0000-000000000000'; // supabase needs a filter on bulk update/delete

export async function POST(req) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Record what is being wiped, so there is a trace if the reset was a mistake.
  const { count: realVotes } = await supabaseAdmin.from('votes').select('id', { count: 'exact', head: true });
  const { data: manual } = await supabaseAdmin.from('candidates').select('manual_votes');
  const manualVotes = (manual || []).reduce((sum, c) => sum + (c.manual_votes || 0), 0);
  await supabaseAdmin.from('audit_log').insert({ event: 'votes_reset', detail: { realVotes, manualVotes } });

  // 1. Delete every real vote
  const { error: vErr } = await supabaseAdmin.from('votes').delete().neq('id', ANY_ID);
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  // 2. Zero the manual +1/-1 adjustments
  const { error: cErr } = await supabaseAdmin.from('candidates').update({ manual_votes: 0 }).neq('id', ANY_ID);
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  // 3. Let everyone vote again (cast_vote blocks anyone with has_voted = true)
  const { error: hErr } = await supabaseAdmin.from('voters').update({ has_voted: false }).neq('id', ANY_ID);
  if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

  // 4. Take results off the public page so half-empty numbers never show
  await supabaseAdmin.from('event_settings').update({ public_results_enabled: false }).eq('id', 1);

  return NextResponse.json({ ok: true, realVotes, manualVotes });
}
