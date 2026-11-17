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
    name: 'Ink',
    category: 'dark',
    description: 'Warm black workspace, white page, steel blue results',
    colors: {
      bgCanvas: '#100f0e',
      bgChrome: '#171614',
      bgSurface: '#171614',
      bgSubtle: '#24211e',
      borderColor: '#2c2926',
      textPrimary: '#e6e2d8',
      textSecondary: '#b7b1a6',
      textMuted: '#8f8a82',
      mathInputColor: '#1c1915',
      mathOutputColor: '#3d5c78',
      selectionBg: '#3a342c',
      mascotBg: '#3d5c78',
      mascotBorder: '#314c64',
    },
  },
};

interface ThemeContextValue {
  themeId: ThemeId;
  theme: ThemeConfig;
  setTheme: (id: ThemeId) => void;
  availableThemes: ThemeConfig[];
  isDark: boolean;
  invertPage: boolean;
  setInvertPage: (invert: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'regne_theme_id';
const INVERT_KEY = 'regne:page-invert';

function readInvertPage(): boolean {
  try {
    return localStorage.getItem(INVERT_KEY) !== '0';
  } catch {
    return true;
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>('nordic');
  const [invertPage, setInvertPageState] = useState(readInvertPage);

  const theme = useMemo(() => THEMES.nordic, []);
  const availableThemes = useMemo(() => [THEMES.nordic], []);
  const isDark = true;

  const setTheme = (id: ThemeId) => {
    if (!THEMES[id]) return;
    setThemeIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  };

  const setInvertPage = (invert: boolean) => {
    setInvertPageState(invert);
    try {
      localStorage.setItem(INVERT_KEY, invert ? '1' : '0');
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
        invertPage,
        setInvertPage,
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
