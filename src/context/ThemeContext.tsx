import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppThemeMode = 'dark' | 'light' | 'system';
export type AccentColor = 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan';

interface ThemeContextType {
  themeMode: AppThemeMode;
  resolvedTheme: 'dark' | 'light';
  accentColor: AccentColor;
  hapticsEnabled: boolean;
  setThemeMode: (mode: AppThemeMode) => void;
  setAccentColor: (accent: AccentColor) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<AppThemeMode>(() => {
    const saved = localStorage.getItem('dochub_theme_mode');
    return (saved as AppThemeMode) || 'dark';
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    const saved = localStorage.getItem('dochub_accent_color');
    return (saved as AccentColor) || 'indigo';
  });

  const [hapticsEnabled, setHapticsEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem('dochub_haptics');
    return saved !== null ? saved === 'true' : true;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPrefersDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: 'dark' | 'light' =
    themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode;

  const setThemeMode = (mode: AppThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('dochub_theme_mode', mode);
  };

  const setAccentColor = (accent: AccentColor) => {
    setAccentColorState(accent);
    localStorage.setItem('dochub_accent_color', accent);
  };

  const setHapticsEnabled = (enabled: boolean) => {
    setHapticsEnabledState(enabled);
    localStorage.setItem('dochub_haptics', String(enabled));
  };

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'light') {
      root.classList.add('theme-light');
      root.classList.remove('theme-dark');
    } else {
      root.classList.add('theme-dark');
      root.classList.remove('theme-light');
    }
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        accentColor,
        hapticsEnabled,
        setThemeMode,
        setAccentColor,
        setHapticsEnabled,
        isSettingsOpen,
        setIsSettingsOpen,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
