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
  const [voteMsg, setVoteMsg] = useState('');
  const [voteBusy, setVoteBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [resultsMsg, setResultsMsg] = useState('');
  const [resultsBusy, setResultsBusy] = useState(false);
  const [showDisplay, setShowDisplay] = useState(false);
  const [publicEnabled, setPublicEnabled] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  async function load(s) {
    try {
      const d = await call('/api/admin/candidates', {}, s);
      setCandidates(d.candidates);
      setUnlocked(true);
      loadResults(s);
      loadPublicStatus();
    }
    catch { setErr('Incorrect admin secret.'); }
  }

  async function loadResults(s) {
    setResultsBusy(true); setResultsMsg('');
    try {
      const d = await call('/api/admin/results', {}, s);
      setResults(d.results);
    } catch (e) { setResultsMsg(e.message); }
    setResultsBusy(false);
  }

  async function loadPublicStatus() {
    try {
      const res = await fetch('/api/results');
      const d = await res.json();
      setPublicEnabled(!!d.enabled);
    } catch { /* ignore — status just won't reflect until next load */ }
  }

  async function togglePublish() {
    setPublishBusy(true);
    try {
      const next = !publicEnabled;
      await call('/api/admin/toggle-public-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next }) }, secret);
      setPublicEnabled(next);
    } catch (e) { setResultsMsg(e.message); }
    setPublishBusy(false);
  }

    async function resetVotes() {
    const typed = window.prompt('This deletes ALL votes (real + manual) and lets everyone vote again.\n\nType RESET to confirm:');
    if (typed !== 'RESET') return;
    setResetBusy(true); setResultsMsg('');
    try {
      await call('/api/admin/reset-votes', { method: 'POST' }, secret);
      setPublicEnabled(false);
      await loadResults(secret);
      setResultsMsg('All votes reset to 0. Voters can vote again once you open voting.');
    } catch (e) { setResultsMsg(e.message); }
    setResetBusy(false);
  }
  
  async function addVote(candidateId, delta) {
    try {
      await call('/api/admin/add-vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateId, count: delta }) }, secret);
      await loadResults(secret);
    } catch (e) { setResultsMsg(e.message); }
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

  async function openVoting() {
    setVoteBusy(true); setVoteMsg('');
    try {
      const d = await call('/api/admin/open-voting', { method: 'POST' }, secret);
      const end = new Date(d.votingEnd);
      setVoteMsg(`Voting is open until ${end.toLocaleTimeString()}.`);
    } catch (e) { setVoteMsg(e.message); }
    setVoteBusy(false);
  }

  async function closeVoting() {
    setVoteBusy(true); setVoteMsg('');
    try {
      await call('/api/admin/close-voting', { method: 'POST' }, secret);
      setVoteMsg('Voting has been closed.');
    } catch (e) { setVoteMsg(e.message); }
    setVoteBusy(false);
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

      <div className="panel" style={{ maxWidth: 480, marginTop: 24, marginLeft: 0 }}>
        <h2 style={{ fontSize: '1.1rem' }}>Voting control</h2>
        <p className="status-line" style={{ marginTop: 0 }}>Opening starts a fixed 10-minute voting window. You can close it early anytime.</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button className="btn btn-primary" disabled={voteBusy} onClick={openVoting}>Open voting (10 min)</button>
          <button className="btn btn-ghost" disabled={voteBusy} onClick={closeVoting}>Close voting</button>
        </div>
        {voteMsg && <p className="hint" style={{ color: 'var(--sub)' }}>{voteMsg}</p>}
      </div>

      <div className="panel" style={{ maxWidth: 720, marginTop: 24, marginLeft: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.1rem' }}>Results</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" style={{ padding: '8px 16px' }} onClick={() => setShowDisplay(true)}>Preview display</button>
            <button className="btn btn-ghost" style={{ padding: '8px 16px' }} disabled={resultsBusy} onClick={() => loadResults(secret)}>{resultsBusy ? 'Refreshing…' : 'Refresh'}</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            className={publicEnabled ? 'btn btn-ghost' : 'btn btn-primary'}
            style={{ padding: '8px 16px' }}
            disabled={publishBusy}
            onClick={togglePublish}
          >
            {publishBusy ? 'Updating…' : publicEnabled ? 'Unpublish from website' : 'Publish to website'}
          </button>
          <span style={{ fontSize: 13, color: publicEnabled ? '#8ff0b0' : 'var(--sub)' }}>
            {publicEnabled ? 'Live — visible to everyone at /results' : 'Not public yet'}
          </span>
          {publicEnabled && <a href="/results" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--blue)' }}>Open public page →</a>}
                  <button className="btn btn-ghost" style={{ padding: '8px 16px', marginLeft: 'auto', color: '#ff8a8a' }} disabled={resetBusy} onClick={resetVotes}>
            {resetBusy ? 'Resetting…' : 'Reset all votes to 0'}
          </button>
            </div>
        {['mr', 'ms'].map(cat => (
          <div key={cat} style={{ marginTop: 18 }}>
            <div style={{ fontSize: '.85rem', color: 'var(--sub)', marginBottom: 6 }}>{cat === 'mr' ? 'Mr. Freshers' : 'Ms. Freshers'}</div>
            {results.filter(r => r.category === cat).sort((a, b) => b.total_votes - a.total_votes).map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ minWidth: 34, color: 'var(--sub)', fontSize: 13 }}>#{r.candidate_number}</span>
                <span style={{ flex: 1 }}>{r.name}{!r.active && <span style={{ color: 'var(--sub)' }}> (inactive)</span>}</span>
                <span style={{ color: 'var(--sub)', fontSize: 12 }}>{r.real_votes} real + {r.manual_votes} manual</span>
                <b style={{ minWidth: 30, textAlign: 'right' }}>{r.total_votes}</b>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => addVote(r.id, 1)}>+1</button>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => addVote(r.id, -1)}>-1</button>
              </div>
            ))}
          </div>
        ))}
        {resultsMsg && <p className="hint" style={{ color: 'var(--sub)' }}>{resultsMsg}</p>}
      </div>

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

      {showDisplay && (
        <div style={{
          position: 'fixed', inset: 0, background: '#05060cf5', zIndex: 100,
          overflowY: 'auto', padding: '50px 20px'
        }}>
          <button
            className="btn btn-ghost"
            style={{ position: 'fixed', top: 20, right: 20, zIndex: 101 }}
            onClick={() => setShowDisplay(false)}
          >
            Close
          </button>
          <div className="wrap">
            {['mr', 'ms'].map(cat => {
              const list = results
                .filter(r => r.category === cat && r.active)
                .sort((a, b) => b.total_votes - a.total_votes);
              if (!list.length) return null;
              return (
                <div key={cat} style={{ marginBottom: 48 }}>
                  <h1 style={{ fontSize: '1.8rem', textAlign: 'center' }}>
                    {cat === 'mr' ? 'Mr. Freshers' : 'Ms. Freshers'}
                  </h1>
                  <div className="grid" style={{ marginTop: 24 }}>
                    {list.map((r, i) => (
                      <div
                        key={r.id}
                        className="card"
                        style={i === 0 ? { borderColor: 'var(--gold)', boxShadow: '0 0 0 1px var(--gold)' } : undefined}
                      >
                        {i === 0 && <span className="num">Winner</span>}
                        {r.photo_url
                          ? <img src={r.photo_url} alt={r.name} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 14, marginBottom: 14 }} />
                          : <div className="avatar" style={{ background: '#ffffff12' }}>{r.name?.[0]}</div>}
                        <h3 style={{ textAlign: 'center' }}>{r.name}</h3>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
