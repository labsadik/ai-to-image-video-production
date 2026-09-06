'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) node.dataset.revealed = 'true';
    }), { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`marketing-reveal ${className}`} style={{ ['--reveal-delay' as string]: `${delay}ms` }}>{children}</div>;
}

export function HeroOrbit() {
  return <div className="hero-orbit" aria-hidden="true">
    <div className="hero-orbit__glow" />
    <div className="hero-orbit__ring hero-orbit__ring--one" />
    <div className="hero-orbit__ring hero-orbit__ring--two" />
    <div className="hero-orbit__core"><span>AI</span></div>
    <div className="hero-orbit__node hero-orbit__node--one" />
    <div className="hero-orbit__node hero-orbit__node--two" />
    <div className="hero-orbit__node hero-orbit__node--three" />
  </div>;
}
