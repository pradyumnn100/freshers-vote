'use client';
import { useEffect, useRef, useState } from 'react';

async function api(path, body) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'ERROR'), { code: data.error });
  return data;
}

function initials(name) { return name.split(' ').map(w => w[0]).join('').slice(0, 2); }
const colors = ['#8b6bff', '#4aa4ff', '#e7827e', '#e7c77e', '#6bd4c0', '#a882ff'];

export default function Page() {
  const [view, setView] = useState('loading');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [tab, setTab] = useState('mr');
  const [selMr, setSelMr] = useState(null);
  const [selMs, setSelMs] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [locStatus, setLocStatus] = useState('');
  const [locOk, setLocOk] = useState(false);
  const coordsRef = useRef(null);

  async function refreshSession() {
    const s = await api('/api/session');
    setCandidates(s.candidates);
    if (s.hasVoted) { setView('voted'); return; }
    if (!s.votingOpen) { setView(s.authenticated ? 'closed' : 'login'); return; }
    if (!s.authenticated) { setView('login'); return; }
    setRemaining(Math.max(0, Math.round((s.votingEnd - s.serverNow) / 1000)));
    setView(locOk ? 'app' : 'location');
  }

  useEffect(() => { refreshSession().catch(() => setView('login')); }, []); // eslint-disable-line

  useEffect(() => {
    if (remaining === null || view !== 'app') return;
    if (remaining <= 0) { setView('closed'); return; }
    const t = setInterval(() => setRemaining(r => {
      if (r <= 1) { clearInterval(t); setView('closed'); return 0; }
      return r - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [view]); // eslint-disable-line

  async function login() {
    setErr('');
    try { await api('/api/login', { email }); await refreshSession(); }
    catch (e) {
      setErr({
        NOT_ELIGIBLE: "This email isn't on the eligible voters list.",
        ALREADY_VOTED: 'This account has already voted.',
      }[e.code] || 'Could not verify — try again.');
    }
  }
  function verifyLocation() {
    setLocStatus('Checking your location…');
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude, accuracy } = pos.coords;
      coordsRef.current = { lat: latitude, lng: longitude, accuracy };
      if (accuracy > 50) { setLocStatus(`Accuracy too low (±${Math.round(accuracy)} m). Move to open ground and retry.`); return; }
      setLocStatus('Location captured — verifying with the server on submit.');
      setLocOk(true);
      setView('app');
    }, () => setLocStatus('Location permission denied or unavailable.'), { enableHighAccuracy: true, timeout: 10000 });
  }
  function toggle(c) {
    if (tab === 'mr') setSelMr(s => s === c.id ? null : c.id);
    else setSelMs(s => s === c.id ? null : c.id);
  }
  async function submitVote() {
    setErr('');
    try {
      const coords = coordsRef.current || {};
      await api('/api/vote', { mrCandidateId: selMr, msCandidateId: selMs, lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy });
      setView('confirm');
    } catch (e) {
      setErr({
        VOTING_CLOSED: 'Voting closed while you were reviewing.',
        OUTSIDE_GEOFENCE: "You're outside the voting area — move closer and retry.",
        LOCATION_ACCURACY_TOO_LOW: 'GPS accuracy too low — try again in open ground.',
        ALREADY_VOTED: 'This account has already voted.',
      }[e.code] || 'Could not submit — try again.');
    }
  }

  const mrList = candidates.filter(c => c.category === 'mr');
  const msList = candidates.filter(c => c.category === 'ms');
  const nameOf = id => candidates.find(c => c.id === id)?.name;

  if (view === 'loading') return null;

  if (view === 'login') return (
    <div className="wrap" style={{ paddingTop: 110 }}>
      <div className="panel">
        <h2>Welcome, IITR</h2>
        <p style={{ color: 'var(--sub)', marginTop: 8 }}>Enter your IIT Roorkee email to enter the voting portal.</p>
        <input className="input" placeholder="yourname@cs.iitr.ac.in" value={email} onChange={e => setEmail(e.target.value)} />
        {err && <p className="hint">{err}</p>}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={login}>Enter voting portal →</button>
      </div>
    </div>
  );

  if (view === 'closed') return <div className="wrap" style={{ paddingTop: 130, textAlign: 'center' }}><h1>Voting closed</h1><p style={{ color: 'var(--sub)' }}>This voting session isn't currently open.</p></div>;
  if (view === 'voted') return <div className="wrap" style={{ paddingTop: 130, textAlign: 'center' }}><h1>Already voted</h1><p style={{ color: 'var(--sub)' }}>Your vote has already been submitted for this session.</p></div>;

  if (view === 'location') return (
    <div className="wrap" style={{ paddingTop: 110 }}>
      <div className="panel" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.4rem' }}>📍</div>
        <h2 style={{ marginTop: 12 }}>Location verification</h2>
        <p style={{ color: 'var(--sub)' }}>You must be physically present at the voting centre to vote.</p>
        <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={verifyLocation}>Verify my location</button>
        {locStatus && <p className="status-line">{locStatus}</p>}
      </div>
    </div>
  );

  if (view === 'confirm') return (
    <div className="wrap" style={{ paddingTop: 90, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'linear-gradient(135deg,var(--violet),var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', margin: '0 auto 22px' }}>✓</div>
      <h1>Vote submitted!</h1>
      <div className="result-row"><span>Mr. Freshers</span><span>{nameOf(selMr)}</span></div>
      <div className="result-row"><span>Ms. Freshers</span><span>{nameOf(selMs)}</span></div>
      <p style={{ color: 'var(--sub)', marginTop: 20 }}>Thank you for making your voice count.</p>
    </div>
  );

  // main app
  return (
    <div>
      <div className="timerbadge">Closes in <span className="n">{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</span></div>
      <div className="hero wrap">
        <span className="pill"><span className="dot" /> Voting is live</span>
        <h1>Mr. & Ms. Freshers 2026</h1>
        <p className="sub">Your vote. Their moment.</p>
      </div>
      <div className="wrap" style={{ paddingBottom: 140 }}>
        {!reviewing && <>
          <div className="tabs">
            <button className={`tab ${tab === 'mr' ? 'active' : ''}`} onClick={() => setTab('mr')}>Mr. Freshers</button>
            <button className={`tab ${tab === 'ms' ? 'active' : ''}`} onClick={() => setTab('ms')}>Ms. Freshers</button>
          </div>
          <div className="grid">
            {(tab === 'mr' ? mrList : msList).map((c, i) => {
              const sel = (tab === 'mr' ? selMr : selMs) === c.id;
              return (
                <div key={c.id} className={`card ${sel ? 'selected' : ''}`} onClick={() => toggle(c)}>
                  <span className="num">#{c.candidate_number}</span>
                  <div className="avatar" style={{ background: colors[i % colors.length] + '66' }}>{initials(c.name)}</div>
                  <h3>{c.name}</h3>
                  <div className="dept">{c.department}</div>
                  <div className="tag">&ldquo;{c.tagline}&rdquo;</div>
                  <button className="vote-btn">{sel ? 'Selected' : 'Vote for ' + c.name.split(' ')[0]}</button>
                </div>
              );
            })}
          </div>
        </>}
        {reviewing && (
          <div className="panel" style={{ maxWidth: 520 }}>
            <h2>Review your vote</h2>
            <div className="result-row"><span>Mr. Freshers</span><span>{nameOf(selMr) || '—'}</span></div>
            <div className="result-row"><span>Ms. Freshers</span><span>{nameOf(selMs) || '—'}</span></div>
            {err && <p className="hint">{err}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={submitVote}>Confirm & submit my vote</button>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => setReviewing(false)}>Back to candidates</button>
          </div>
        )}
      </div>
      {!reviewing && (
        <div id="summaryBar">
          <div style={{ fontSize: 13.5, color: 'var(--sub)' }}>Mr: <b style={{ color: 'var(--ink)' }}>{nameOf(selMr) || 'Not selected'}</b></div>
          <div style={{ fontSize: 13.5, color: 'var(--sub)' }}>Ms: <b style={{ color: 'var(--ink)' }}>{nameOf(selMs) || 'Not selected'}</b></div>
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }} disabled={!selMr || !selMs} onClick={() => setReviewing(true)}>Submit my vote</button>
        </div>
      )}
    </div>
  );
}
