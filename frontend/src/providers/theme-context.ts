import { createContext } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export type ThemeContextValue = {
  theme: Theme;
  /** Tema realmente aplicado: resolve `system` para claro ou escuro. */
  resolvedTheme: 'light' | 'dark';
  /**
   * Se este dispositivo ja guardou uma escolha propria.
   *
   * `theme` nao responde isso: sem nada no storage ele vale `'system'`, que e
   * tambem uma escolha possivel. A distincao existe para o perfil — a
   * preferencia da conta so e adotada num dispositivo que nunca escolheu, para
   * nao desfazer o que a pessoa acabou de alternar na topbar.
   */
  hasDeviceChoice: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);
