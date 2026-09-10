import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

export type ThemeId = 'nordic';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  category: 'dark' | 'light';
  description: string;
  colors: {
    bgCanvas: string;
    bgChrome: string;
    bgSurface: string;
    bgSubtle: string;
    borderColor: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    mathInputColor: string;
    mathOutputColor: string;
    selectionBg: string;
    mascotBg: string;
    mascotBorder: string;
  };
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  nordic: {
    id: 'nordic',
    name: 'Nordic Paper',
    category: 'light',
    description: 'Crisp white LaTeX paper sheet with sapphire blue outputs',
    colors: {
      bgCanvas: '#ffffff',
      bgChrome: '#ffffff',
      bgSurface: '#ffffff',
      bgSubtle: '#f1f5f9',
      borderColor: '#e2e8f0',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#94a3b8',
      mathInputColor: '#0f172a',
      mathOutputColor: '#1d4ed8',
      selectionBg: '#bfdbfe',
      mascotBg: '#242e84',
      mascotBorder: '#1c246b',
    },
  },
};

interface ThemeContextValue {
  themeId: ThemeId;
  theme: ThemeConfig;
  setTheme: (id: ThemeId) => void;
  availableThemes: ThemeConfig[];
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'regne_theme_id';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>('nordic');

  const theme = useMemo(() => THEMES.nordic, []);
  const availableThemes = useMemo(() => [THEMES.nordic], []);
  const isDark = false;

  const setTheme = (id: ThemeId) => {
    if (!THEMES[id]) return;
    setThemeIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  };

  // Sync CSS variables and data-theme to document
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme.id);
    root.classList.toggle('dark', isDark);

    // Apply CSS Custom Properties
    root.style.setProperty('--bg-canvas', theme.colors.bgCanvas);
    root.style.setProperty('--bg-chrome', theme.colors.bgChrome);
    root.style.setProperty('--bg-surface', theme.colors.bgSurface);
    root.style.setProperty('--bg-subtle', theme.colors.bgSubtle);
    root.style.setProperty('--border-color', theme.colors.borderColor);
    root.style.setProperty('--text-primary', theme.colors.textPrimary);
    root.style.setProperty('--text-secondary', theme.colors.textSecondary);
    root.style.setProperty('--text-muted', theme.colors.textMuted);
    root.style.setProperty('--math-input-color', theme.colors.mathInputColor);
    root.style.setProperty('--math-output-color', theme.colors.mathOutputColor);
    root.style.setProperty('--maple-blue', theme.colors.mathOutputColor);
    root.style.setProperty('--selection-bg', theme.colors.selectionBg);
  }, [theme, isDark]);

  return (
    <ThemeContext.Provider
      value={{
        themeId,
        theme,
        setTheme,
        availableThemes,
        isDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
