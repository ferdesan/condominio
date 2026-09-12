import { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';

/**
 * O Recharts pinta via atributos de apresentacao do SVG, onde `var(--token)`
 * nao resolve. Entao lemos os tokens computados e recalculamos a cada troca de
 * tema — cada modo tem seus proprios passos de paleta, definidos em index.css.
 */
export type ChartColors = {
  series: [string, string, string, string, string];
  grid: string;
  axis: string;
  surface: string;
};

function readToken(styles: CSSStyleDeclaration, token: string): string {
  const value = styles.getPropertyValue(token).trim();
  return value ? `hsl(${value})` : 'currentColor';
}

function readChartColors(): ChartColors {
  const styles = getComputedStyle(document.documentElement);
  return {
    series: [
      readToken(styles, '--chart-1'),
      readToken(styles, '--chart-2'),
      readToken(styles, '--chart-3'),
      readToken(styles, '--chart-4'),
      readToken(styles, '--chart-5'),
    ],
    grid: readToken(styles, '--border'),
    axis: readToken(styles, '--muted-foreground'),
    surface: readToken(styles, '--card'),
  };
}

export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<ChartColors>(readChartColors);

  useEffect(() => {
    // O efeito roda apos o ThemeProvider trocar a classe `dark` na raiz.
    setColors(readChartColors());
  }, [resolvedTheme]);

  return colors;
}
