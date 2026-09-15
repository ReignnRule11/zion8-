import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Zion8 — Digital Memory & Operating System for Churches',
    template: '%s | Zion8',
  },
  description:
    'Zion8 is an AI-powered digital memory platform that preserves institutional knowledge while managing church operations.',
};

export const viewport: Viewport = {
  themeColor: '#020617',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
