'use client';
import { useEffect, useState } from 'react';

async function call(path, opts, secret) {
  const res = await fetch(path, { ...opts, headers: { ...(opts?.headers || {}), 'x-admin-secret': secret } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'ERROR');
  return data;
}

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ category: 'mr', candidate_number: '', name: '', department: '', tagline: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load(s) {
    try { const d = await call('/api/admin/candidates', {}, s); setCandidates(d.candidates); setUnlocked(true); }
    catch { setErr('Incorrect admin secret.'); }
  }

  async function addCandidate(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      let photo_url = null;
      if (file) {
        const fd = new FormData(); fd.append('file', file);
        const up = await call('/api/admin/upload-photo', { method: 'POST', body: fd }, secret);
        photo_url = up.url;
      }
      await call('/api/admin/candidates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, photo_url }) }, secret);
      setForm({ category: form.category, candidate_number: '', name: '', department: '', tagline: '' });
      setFile(null);
      await load(secret);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  async function deactivate(id) {
    await call('/api/admin/candidates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }, secret);
    load(secret);
  }

  if (!unlocked) return (
    <div className="wrap" style={{ paddingTop: 110 }}>
      <div className="panel">
        <h2>Admin sign-in</h2>
        <input className="input" type="password" placeholder="Admin secret" value={secret} onChange={e => setSecret(e.target.value)} />
        {err && <p className="hint">{err}</p>}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={() => load(secret)}>Enter</button>
      </div>
    </div>
  );

  return (
    <div className="wrap" style={{ paddingTop: 60, paddingBottom: 60 }}>
      <h1 style={{ fontSize: '1.8rem' }}>Candidate management</h1>

      <form onSubmit={addCandidate} className="panel" style={{ maxWidth: 480, marginTop: 24, marginLeft: 0 }}>
        <h2 style={{ fontSize: '1.1rem' }}>Add candidate</h2>
        <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
          <option value="mr">Mr. Freshers</option>
          <option value="ms">Ms. Freshers</option>
        </select>
        <input className="input" placeholder="Candidate number (e.g. 07)" value={form.candidate_number} onChange={e => setForm({ ...form, candidate_number: e.target.value })} required />
        <input className="input" placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <input className="input" placeholder="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required />
        <input className="input" placeholder="Tagline" value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} />
        <input className="input" type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
        {err && <p className="hint">{err}</p>}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={busy}>{busy ? 'Saving…' : 'Add candidate'}</button>
      </form>

      <div style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: '1.1rem' }}>Current candidates</h2>
        <div className="grid" style={{ marginTop: 16 }}>
          {candidates.map(c => (
            <div key={c.id} className="card" style={{ opacity: c.active ? 1 : 0.4 }}>
              {c.photo_url
                ? <img src={c.photo_url} alt={c.name} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 14, marginBottom: 14 }} />
                : <div className="avatar" style={{ background: '#ffffff12' }}>{c.name?.[0]}</div>}
              <span className="num">#{c.candidate_number} · {c.category.toUpperCase()}</span>
              <h3>{c.name}</h3>
              <div className="dept">{c.department}</div>
              <div className="tag">&ldquo;{c.tagline}&rdquo;</div>
              <button className="vote-btn" onClick={() => deactivate(c.id)}>{c.active ? 'Deactivate' : 'Inactive'}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
