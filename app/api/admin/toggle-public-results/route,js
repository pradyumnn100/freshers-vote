import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(req) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const { enabled } = await req.json();
  await supabaseAdmin.from('event_settings').update({ public_results_enabled: !!enabled }).eq('id', 1);
  await supabaseAdmin.from('audit_log').insert({ event: enabled ? 'results_published' : 'results_unpublished' });
  return NextResponse.json({ ok: true, enabled: !!enabled });
}
