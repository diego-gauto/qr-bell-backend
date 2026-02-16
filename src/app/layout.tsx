import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'QR Bell',
    template: '%s | QR Bell'
  },
  description: 'QR Bell smart doorbell PWA',
  manifest: '/manifest.json',
  themeColor: '#2563eb'
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
