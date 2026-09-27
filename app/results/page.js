'use client';
import { useEffect, useState } from 'react';

export default function ResultsPage() {
  const [state, setState] = useState('loading'); // loading | disabled | ready
  const [results, setResults] = useState([]);

  async function load() {
    try {
      const res = await fetch('/api/results');
      const data = await res.json();
      if (!data.enabled) { setState('disabled'); return; }
      setResults(data.results || []);
      setState('ready');
    } catch {
      setState('disabled');
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // keep it live if the admin publishes mid-view
    return () => clearInterval(t);
  }, []);

  if (state === 'loading') return null;

  if (state === 'disabled') return (
    <div className="wrap" style={{ paddingTop: 130, textAlign: 'center' }}>
      <h1>Results aren&apos;t out yet</h1>
      <p style={{ color: 'var(--sub)' }}>Check back once they&apos;ve been announced.</p>
    </div>
  );

  return (
    <div className="wrap" style={{ paddingTop: 70, paddingBottom: 80 }}>
      <div className="hero" style={{ padding: '0 0 30px' }}>
        <h1>Mr. & Ms. Freshers 2026</h1>
        <p className="sub">Results</p>
      </div>
      {['mr', 'ms'].map(cat => {
        const list = results.filter(r => r.category === cat);
        if (!list.length) return null;
        return (
          <div key={cat} style={{ marginBottom: 48 }}>
            <h2 style={{ textAlign: 'center', fontSize: '1.4rem', color: 'var(--sub)' }}>
              {cat === 'mr' ? 'Mr. Freshers' : 'Ms. Freshers'}
            </h2>
            <div className="grid" style={{ marginTop: 20 }}>
              {list.map(r => (
                <div
                  key={r.id}
                  className="card"
                  style={r.isWinner ? { borderColor: 'var(--gold)', boxShadow: '0 0 0 1px var(--gold)' } : undefined}
                >
                  {r.isWinner && <span className="num">Winner</span>}
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
  );
}
