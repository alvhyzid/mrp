import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MRP SaaS',
  description: 'Fondasi platform MRP multi-tenant untuk manufaktur.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
