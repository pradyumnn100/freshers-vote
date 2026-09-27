import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

function checkAuth(req) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET;
}

export async function GET(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('candidates').select('*').order('category').order('candidate_number');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ candidates: data });
}

export async function POST(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const body = await req.json();
  const { id, category, candidate_number, name, department, tagline, photo_url, active } = body;

  if (id) {
    const { error } = await supabaseAdmin.from('candidates')
      .update({ category, candidate_number, name, department, tagline, photo_url, active })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data, error } = await supabaseAdmin.from('candidates')
    .insert({ category, candidate_number, name, department, tagline, photo_url, active: active ?? true })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, candidate: data });
}

export async function DELETE(req) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const { id } = await req.json();
  // Soft delete: deactivate rather than remove, so past votes still reference a valid row.
  const { error } = await supabaseAdmin.from('candidates').update({ active: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
