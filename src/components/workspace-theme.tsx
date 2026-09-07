'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type WorkspaceTheme = 'obsidian' | 'aurora' | 'paper';

const STORAGE_KEY = 'solamentis-workspace-theme';

const themes: Array<{ id: WorkspaceTheme; name: string; description: string; swatches: string[] }> = [
  { id: 'obsidian', name: 'Obsidian', description: 'Crisp monochrome with electric blue accents.', swatches: ['#0b1020', '#f8fafc', '#3b82f6'] },
  { id: 'aurora', name: 'Aurora', description: 'Deep indigo surfaces with cyan and violet energy.', swatches: ['#11142e', '#f5f7ff', '#22d3ee'] },
  { id: 'paper', name: 'Paper', description: 'Warm editorial surfaces with ink and copper accents.', swatches: ['#201a17', '#fbf7f2', '#b45309'] },
];

type ContextValue = { theme: WorkspaceTheme; setTheme: (theme: WorkspaceTheme) => void; themes: typeof themes };

const WorkspaceThemeContext = createContext<ContextValue | null>(null);

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
