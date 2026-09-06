import type { Metadata } from 'next';
import './globals.css';
import { NavigationProgress } from '@/components/navigation-progress';

export const metadata: Metadata = {
  title: { default: 'Solamentis — AI Creative Studio', template: '%s · Solamentis' },
  description: 'A provider-independent AI creative studio for generating, editing, and exporting production-ready visual assets.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><NavigationProgress />{children}</body></html>;
}
