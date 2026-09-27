import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(req) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  await supabaseAdmin.from('event_settings').update({ voting_end: new Date().toISOString() }).eq('id', 1);
  await supabaseAdmin.from('audit_log').insert({ event: 'voting_closed_manually' });
  return NextResponse.json({ ok: true });
}
