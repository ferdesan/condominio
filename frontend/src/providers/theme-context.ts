import { createContext } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export type ThemeContextValue = {
  theme: Theme;
  /** Tema realmente aplicado: resolve `system` para claro ou escuro. */
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);
