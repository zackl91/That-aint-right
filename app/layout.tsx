import type { Metadata, Viewport } from 'next';
import './globals.css';
import { siteUrl } from '@/lib/share';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "That AIn't Right",
  openGraph: { images: [{ url: '/api/og', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', images: ['/api/og'] },
  description: 'One is real. One is AI. Pick the real one. Lose 100 points every time a computer fools you.',
  appleWebApp: { capable: true, title: "That AIn't Right", statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f3eee3',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@500;700&family=Work+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <div className="app">{children}</div>
      </body>
    </html>
  );
}
