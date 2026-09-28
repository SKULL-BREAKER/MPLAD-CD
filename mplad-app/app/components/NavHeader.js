'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/',           label: 'Home',            icon: '' },
  { href: '/mp',         label: 'MP Workspace',    icon: '' },
  { href: '/authority',  label: 'Authority Board',  icon: '' },
  { href: '/officer',    label: 'Officer',          icon: '' },
  { href: '/assets',     label: 'Asset Register',  icon: '' },
  { href: '/public',     label: 'Public Portal',   icon: '' },
  { href: '/monitor',    label: 'AI Monitor',      icon: '' },
  { href: '/fraud',      label: 'Fraud Investigator', icon: '' },
];

function NavContent({ pathname, open, onClose }) {
  return (
    <ul className={`nav-links${open ? ' nav-open' : ''}`}>
      {NAV_LINKS.map(({ href, label, icon }) => (
        <li key={href}>
          <Link
            href={href}
            className={pathname === href ? 'nav-active' : ''}
            onClick={onClose}
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NotificationsDropdown() {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/alerts').then(r => r.json()).then(d => {
      if(d.ok) setAlerts(d.alerts || []);
    });
  }, []);

  const dismiss = async (id) => {
    setAlerts(alerts.filter(a => a.id !== id));
    await fetch('/api/alerts', { method: 'POST', body: JSON.stringify({ id }) });
  };

  return (
    <div style={{ position: 'relative', marginRight: 16 }}>
      <button onClick={() => setOpen(!open)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FDFBF7', transition: 'all 0.2s' }}>
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {alerts.length > 0 && (
          <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--danger)', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: '2px solid #2A3A31' }}>
            {alerts.length > 9 ? '9+' : alerts.length}
          </span>
        )}
      </button>
      
      {open && (
        <div style={{ position: 'absolute', top: 40, right: 0, width: 320, background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', zIndex: 9999, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Notifications
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setOpen(false)}>Close</span>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {alerts.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No new alerts.</div>
            ) : (
              alerts.map(a => (
                <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: a.severity === 'CRITICAL' ? 'var(--danger)' : 'var(--accent)' }}>{a.type || 'ALERT'}</span>
                    <button onClick={() => dismiss(a.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>×</button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>{a.title}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Work ID: {a.work_id}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NavHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <nav className="nav-header">
      <Link href="/" className="nav-brand">
         MPLADS Portal
      </Link>

      <NavContent pathname={pathname} open={open} onClose={() => setOpen(false)} />

      <div className="nav-actions">
        <NotificationsDropdown />
        {/* Desktop: MoSPI label */}
        <div aria-hidden="true" className="nav-mosp-desktop">
          MoSPI · Govt. of India
        </div>

        {/* Mobile hamburger */}
        <button
          className={`nav-toggle ${open ? 'is-active' : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </button>
      </div>
    </nav>
  );
}
