'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(false);
  }, [pathname]);

  useEffect(() => {
    const start = () => setActive(true);
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor || anchor.hasAttribute('download') || anchor.target === '_blank') return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const url = new URL(href, window.location.href);
      if (url.origin === window.location.origin && url.pathname !== window.location.pathname) start();
    };
    const onSubmit = (event: Event) => {
      if ((event.target as HTMLFormElement | null)?.method?.toLowerCase() !== 'dialog') start();
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    window.addEventListener('beforeunload', start);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      window.removeEventListener('beforeunload', start);
    };
  }, []);

  if (!active) return null;
  return <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-0.5 overflow-hidden bg-blue-100"><div className="solamentis-navigation-progress h-full w-1/3 rounded-full bg-blue-500" /></div>;
}
