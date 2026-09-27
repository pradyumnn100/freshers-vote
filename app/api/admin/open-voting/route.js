import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(req) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const start = new Date();
  const end = new Date(start.getTime() + 10 * 60 * 1000);
  await supabaseAdmin.from('event_settings')
    .update({ voting_start: start.toISOString(), voting_end: end.toISOString() })
    .eq('id', 1);
  await supabaseAdmin.from('audit_log').insert({ event: 'voting_opened', detail: { start, end } });
  return NextResponse.json({ ok: true, votingStart: start, votingEnd: end });
}
