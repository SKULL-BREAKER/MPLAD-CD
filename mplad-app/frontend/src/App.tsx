import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Overview from './pages/Overview';
import District from './pages/District';
import Work from './pages/Work';
import NotFound from './pages/NotFound';
import { useEffect, useState } from 'react';
import './App.css';

function GlobalToast() {
  const [toast, setToast] = useState<{message: string, type: string} | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      setToast(customEvent.detail);
      setTimeout(() => setToast(null), 5000);
    };
    window.addEventListener('api-toast', handler);
    return () => window.removeEventListener('api-toast', handler);
  }, []);

  if (!toast) return null;

  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-sans)',
        fontSize: '13px',
        fontWeight: 500,
        background: toast.type === 'error'
          ? 'rgba(220,38,38,0.15)'
          : 'var(--surface-3)',
        border: toast.type === 'error'
          ? '1px solid rgba(220,38,38,0.35)'
          : '1px solid var(--border-2)',
        color: toast.type === 'error' ? '#fca5a5' : 'var(--text-primary)',
        boxShadow: 'var(--shadow-clay)',
        animation: 'none',
      }}>
        <span>{toast.message}</span>
        <button
          onClick={() => setToast(null)}
          style={{ opacity: 0.6, cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', lineHeight: 1 }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div style={{ minHeight: '100vh', background: 'var(--surface-base)', display: 'flex', flexDirection: 'column' }}>

        <header className="glass" style={{ position: 'sticky', top: 0, zIndex: 100, padding: '0 24px' }}>
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '60px',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 700,
                  fontSize: '17px',
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}>
                  PRAHARI
                </span>
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 400,
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                }}>
                  MPLADS Implementation Monitor
                </span>
              </div>
              <p style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                color: 'var(--text-dim)',
                margin: 0,
                lineHeight: 1,
              }}>
                Every flag carries evidence.
              </p>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: '28px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/district/:id" element={<District />} />
            <Route path="/work/:id" element={<Work />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <footer style={{
          borderTop: '1px solid var(--border-1)',
          padding: '16px 24px',
          textAlign: 'center',
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          color: 'var(--text-dim)',
        }}>
          Accuracy measured on labeled test data.
        </footer>

        <GlobalToast />
      </div>
    </Router>
  );
}

export default App;
