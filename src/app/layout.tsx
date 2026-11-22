import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'AI pilled · Find your people',
  description: 'A little help. A good conversation. Meet the people building alongside you.',
  robots: { index: false, follow: false }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f5f4ee' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
