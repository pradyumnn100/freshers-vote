import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Public endpoint — no admin secret required. Only exposes name + photo,
// never vote counts, and only when an admin has published results.
export async function GET() {
  const { data: settings } = await supabaseAdmin
    .from('event_settings').select('public_results_enabled').eq('id', 1).single();

  if (!settings?.public_results_enabled) {
    return NextResponse.json({ enabled: false, results: [] });
  }

  const { data: candidates, error: cErr } = await supabaseAdmin
    .from('candidates')
    .select('id, category, name, photo_url, active, manual_votes')
    .eq('active', true);
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const { data: votes, error: vErr } = await supabaseAdmin
    .from('votes')
    .select('candidate_id');
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  const realCounts = {};
  for (const v of votes) realCounts[v.candidate_id] = (realCounts[v.candidate_id] || 0) + 1;

  const results = candidates
    .map(c => ({
      id: c.id,
      category: c.category,
      name: c.name,
      photo_url: c.photo_url,
      total_votes: (realCounts[c.id] || 0) + (c.manual_votes || 0),
    }));

  // Rank within each category separately, then strip the counts before sending —
  // the client only ever gets name, photo, and a winner flag, never numbers.
  const output = [];
  for (const cat of ['mr', 'ms']) {
    const ranked = results.filter(r => r.category === cat).sort((a, b) => b.total_votes - a.total_votes);
    ranked.forEach((r, i) => output.push({ id: r.id, category: r.category, name: r.name, photo_url: r.photo_url, isWinner: i === 0 }));
  }

  return NextResponse.json({ enabled: true, results: output });
}
