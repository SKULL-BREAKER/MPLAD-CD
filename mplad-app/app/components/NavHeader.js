'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

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
  const { status } = useSession();
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [viewedIds, setViewedIds] = useState(new Set());
  const [pinnedIds, setPinnedIds] = useState(new Set());
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Load state from localStorage on mount
    try {
      const storedViewed = localStorage.getItem('mplads_viewed_alerts');
      const storedPinned = localStorage.getItem('mplads_pinned_alerts');
      if (storedViewed) setViewedIds(new Set(JSON.parse(storedViewed)));
      if (storedPinned) setPinnedIds(new Set(JSON.parse(storedPinned)));
    } catch (e) {
      console.error(e);
    }

    if (status === 'authenticated') {
      fetch('/api/alerts').then(r => r.json()).then(d => {
        if(d.ok) setAlerts(d.alerts || []);
      }).catch(e => console.error('Failed to fetch alerts:', e));
    }
  }, [status]);

  const handleOpen = () => {
    const newOpen = !open;
    setOpen(newOpen);
    if (newOpen) {
      // Mark all current alerts as viewed when opened
      const newViewed = new Set(viewedIds);
      alerts.forEach(a => newViewed.add(a.id));
      setViewedIds(newViewed);
      localStorage.setItem('mplads_viewed_alerts', JSON.stringify([...newViewed]));
    }
  };

  const togglePin = (id) => {
    const newPinned = new Set(pinnedIds);
    if (newPinned.has(id)) newPinned.delete(id);
    else newPinned.add(id);
    setPinnedIds(newPinned);
    localStorage.setItem('mplads_pinned_alerts', JSON.stringify([...newPinned]));
  };

  const dismiss = async (id) => {
    setAlerts(alerts.filter(a => a.id !== id));
    fetch('/api/alerts', { method: 'POST', body: JSON.stringify({ id }) }).catch(e => console.error('Failed to dismiss alert:', e));
  };

  // Sort alerts: Pinned first, then newest
  const sortedAlerts = [...alerts].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id);
    const bPinned = pinnedIds.has(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0; // maintain relative order for others
  });

  const unreadCount = alerts.filter(a => !viewedIds.has(a.id)).length;

  return (
    <div style={{ position: 'relative', marginRight: 16 }}>
      <button onClick={handleOpen} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FDFBF7', transition: 'all 0.2s' }}>
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {isClient && unreadCount > 0 && (
          <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--danger)', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: '2px solid #2A3A31' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      
      {open && (
        <div className="notifications-dropdown-menu">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Notifications
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setOpen(false)}>Close</span>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {sortedAlerts.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No new alerts.</div>
            ) : (
              sortedAlerts.map(a => (
                <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 4, background: pinnedIds.has(a.id) ? 'rgba(255, 255, 255, 0.03)' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: a.severity === 'CRITICAL' ? 'var(--danger)' : 'var(--accent)' }}>
                      {pinnedIds.has(a.id) && '📌 '}{a.type || 'ALERT'}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => togglePin(a.id)} style={{ background: 'none', border: 'none', color: pinnedIds.has(a.id) ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }} title={pinnedIds.has(a.id) ? "Unpin" : "Pin"}>
                        {pinnedIds.has(a.id) ? '★' : '☆'}
                      </button>
                      <button onClick={() => dismiss(a.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }} title="Dismiss">×</button>
                    </div>
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
