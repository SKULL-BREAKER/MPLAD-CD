import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import NavHeader from './components/NavHeader';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata = {
  title: 'MPLADS Portal — Canonical Logic Architecture',
  description: 'MPLADS: Transparent, authority-separated management of constituency works, entitlements, proposals, geo-tagged evidence and immutable audit.',
  themeColor: '#0A0F1E',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <NavHeader />
        {children}
      </body>
    </html>
  );
}
