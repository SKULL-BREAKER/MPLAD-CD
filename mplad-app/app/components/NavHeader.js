'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/',           label: 'Home',            icon: '' },
  { href: '/mp',         label: 'MP Workspace',    icon: '⚙️' },
  { href: '/authority',  label: 'Authority Board',  icon: '⚖️' },
  { href: '/officer',    label: 'Officer',          icon: '' },
  { href: '/assets',     label: 'Asset Register',  icon: '' },
  { href: '/public',     label: 'Public Portal',   icon: '' },
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

export default function NavHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <nav className="nav-header">
      <Link href="/" className="nav-brand">
        🇮🇳 MPLADS Portal
      </Link>

      <NavContent pathname={pathname} open={open} onClose={() => setOpen(false)} />

      <div className="nav-actions">
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
