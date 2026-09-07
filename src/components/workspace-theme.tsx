'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type WorkspaceTheme = 'obsidian' | 'aurora' | 'paper' | 'midnight' | 'sakura' | 'solar' | 'glass';
type ThemePlan = 'free' | 'pro' | 'business';
type WorkspaceThemeOption = { id: WorkspaceTheme; name: string; description: string; swatches: string[]; minPlan: ThemePlan };

const STORAGE_KEY = 'solamentis-workspace-theme';
const PLAN_RANK: Record<ThemePlan, number> = { free: 0, pro: 1, business: 2 };

const themes: WorkspaceThemeOption[] = [
  { id: 'obsidian', name: 'Obsidian', description: 'Crisp monochrome with electric blue accents.', swatches: ['#0b1020', '#f8fafc', '#3b82f6'], minPlan: 'free' },
  { id: 'aurora', name: 'Aurora', description: 'Deep indigo surfaces with cyan and violet energy.', swatches: ['#11142e', '#f5f7ff', '#22d3ee'], minPlan: 'free' },
  { id: 'paper', name: 'Paper', description: 'Warm editorial surfaces with ink and copper accents.', swatches: ['#201a17', '#fbf7f2', '#b45309'], minPlan: 'free' },
  { id: 'midnight', name: 'Midnight', description: 'A darker studio with cool sapphire light.', swatches: ['#070b16', '#111827', '#60a5fa'], minPlan: 'pro' },
  { id: 'sakura', name: 'Sakura', description: 'Soft blush surfaces with a polished rose glow.', swatches: ['#25151c', '#fff7fa', '#e879a8'], minPlan: 'pro' },
  { id: 'solar', name: 'Solar', description: 'Bright citrus energy for high-contrast creative work.', swatches: ['#1f1708', '#fffdf5', '#eab308'], minPlan: 'business' },
  { id: 'glass', name: 'iOS Glass', description: 'Premium translucent glass with soft depth and fluid motion.', swatches: ['#07111f', '#f5fbff', '#38bdf8'], minPlan: 'business' },
];

type ContextValue = { theme: WorkspaceTheme; setTheme: (theme: WorkspaceTheme) => void; themes: typeof themes };

const WorkspaceThemeContext = createContext<ContextValue | null>(null);

export function getThemePlan(theme: WorkspaceTheme) {
  return themes.find((item) => item.id === theme)?.minPlan ?? 'free';
}

export function canUseWorkspaceTheme(theme: WorkspaceTheme, plan: string) {
  const required = getThemePlan(theme);
  const normalized = plan === 'business' ? 'business' : plan === 'pro' ? 'pro' : 'free';
  return PLAN_RANK[normalized] >= PLAN_RANK[required];
}

export function WorkspaceThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<WorkspaceTheme>('obsidian');

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as WorkspaceTheme | null;
    if (saved && themes.some((item) => item.id === saved)) setThemeState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.workspaceTheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme: setThemeState, themes }), [theme]);
  return <WorkspaceThemeContext.Provider value={value}>{children}</WorkspaceThemeContext.Provider>;
}

export function useWorkspaceTheme() {
  const context = useContext(WorkspaceThemeContext);
  if (!context) throw new Error('useWorkspaceTheme must be used inside WorkspaceThemeProvider');
  return context;
}

export { themes as WORKSPACE_THEMES };
