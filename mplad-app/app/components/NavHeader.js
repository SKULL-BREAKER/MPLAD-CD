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
      <button onClick={() => setOpen(!open)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative' }}>
        <span style={{ fontSize: '1.2rem' }}>🔔</span>
        {alerts.length > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--danger)', color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
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
