import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Solamentis — AI Creative Studio', template: '%s · Solamentis' },
  description: 'A provider-independent AI creative studio for generating, editing, and exporting production-ready visual assets.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
