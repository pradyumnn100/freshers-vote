import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(req) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get('file');
  if (!file) return NextResponse.json({ error: 'NO_FILE' }, { status: 400 });

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage.from('candidate-photos')
    .upload(path, bytes, { contentType: file.type || 'image/jpeg', upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabaseAdmin.storage.from('candidate-photos').getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
