'use client';
import { useState, useEffect } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import '../app/globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const NAV_LINKS = [
  { href: '/',           label: 'Home',            icon: '' },
  { href: '/mp',         label: 'MP Workspace',    icon: '️' },
  { href: '/authority',  label: 'Authority Board',  icon: '️' },
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
      <li>
        <Link
          href="/monitor"
          className={`nav-special-link nav-monitor ${pathname === '/monitor' ? 'nav-active' : ''}`}
          onClick={onClose}
        >
          <span className="nav-icon-wrapper">
            <span className="pulse-indicator pulse-success" />
            
          </span>
          AI Monitor
        </Link>
      </li>
      <li>
        <Link
          href="/fraud"
          className={`nav-special-link nav-fraud ${pathname === '/fraud' ? 'nav-active' : ''}`}
          onClick={onClose}
        >
          <span className="nav-icon-wrapper">
            <span className="pulse-indicator pulse-danger" />
            
          </span>
          Fraud Investigator
        </Link>
      </li>
    </ul>
  );
}

function NavHeader() {
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

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <title>MPLADS Portal — Canonical Logic Architecture</title>
        <meta name="description" content="MPLADS: Transparent, authority-separated management of constituency works, entitlements, proposals, geo-tagged evidence and immutable audit." />
        <meta name="theme-color" content="#0A0F1E" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          /* Inline styles removed; relying entirely on globals.css */
        `}</style>
      </head>
      <body>
        <NavHeader />
        {children}
      </body>
    </html>
  );
}
