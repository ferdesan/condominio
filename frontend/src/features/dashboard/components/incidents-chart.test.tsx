import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/providers/theme-provider';
import { renderWithProviders, screen } from '@/test/render';
import type { IncidentCategoryTotal } from '@/types/api';
import { MAX_BARS, rankIncidentCategories } from '../incident-chart-data';
import { IncidentsChart } from './incidents-chart';

function make(category: string, total: number): IncidentCategoryTotal {
  return { category, total };
}

/**
 * `useChartColors` le o tema resolvido, e o harness compartilhado nao monta o
 * `ThemeProvider` — mesma razao e mesma solucao de `features/profile/`. Em
 * producao ele vem de `App.tsx`, acima de tudo.
 */
function render(data: IncidentCategoryTotal[], loading = false) {
  return renderWithProviders(
    <ThemeProvider>
      <IncidentsChart data={data} loading={loading} />
    </ThemeProvider>,
  );
}

/**
 * O recorte e os rotulos sao testados na funcao, e nao no componente: o
 * Recharts mede o container para desenhar, e no jsdom a medida e sempre zero —
 * nenhum rotulo de eixo chega ao DOM. Afirmar sobre o texto renderizado seria
 * afirmar sobre o que a biblioteca faz, e nao sobre a decisao que e nossa.
 */
describe('Recorte do grafico de ocorrências', () => {
  it('traduz a categoria do servidor para o rotulo do produto', () => {
    const [first] = rankIncidentCategories([make('NOISE', 7)]);

    // O servidor devolve `incident.category` cru; o nome legivel e do cliente.
    expect(first?.label).toBe('Barulho');
  });

  it('categoria desconhecida mantem o próprio valor, e não some', () => {
    const ranked = rankIncidentCategories([make('DRONE', 3)]);

    // Um enum que cresca no servidor precisa aparecer incompleto, e nunca
    // desaparecer do grafico.
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.label).toBe('DRONE');
  });

  it('ordena pelo maior total', () => {
    const ranked = rankIncidentCategories([make('NOISE', 1), make('SECURITY', 9), make('PET', 5)]);

    expect(ranked.map((item) => item.category)).toEqual(['SECURITY', 'PET', 'NOISE']);
  });

  it('corta no teto de barras, mantendo as maiores', () => {
    const data = [
      make('NOISE', 1),
      make('SECURITY', 9),
      make('MAINTENANCE', 8),
      make('NEIGHBOR', 7),
      make('CLEANING', 6),
      make('PET', 5),
      make('PARKING', 4),
      make('OTHER', 3),
    ];
    const ranked = rankIncidentCategories(data);

    expect(ranked).toHaveLength(MAX_BARS);
    // As duas menores ficam de fora; a menor das mantidas e `PARKING`.
    expect(ranked.map((item) => item.category)).not.toContain('NOISE');
    expect(ranked.map((item) => item.category)).toContain('PARKING');
  });

  it('não reordena o array recebido', () => {
    // O argumento vem do cache do React Query, que outras partes da tela leem.
    const data = [make('NOISE', 1), make('SECURITY', 9)];
    rankIncidentCategories(data);

    expect(data.map((item) => item.category)).toEqual(['NOISE', 'SECURITY']);
  });
});

describe('Estados do grafico de ocorrências', () => {
  it('sem ocorrências, diz isso em vez de desenhar um grafico vazio', () => {
    render([]);

    // Nenhuma ocorrencia registrada e uma boa noticia, e precisa ser dita.
    expect(screen.getByText('Nenhuma ocorrência registrada')).toBeInTheDocument();
  });

  it('carregando não mostra o estado vazio', () => {
    render([], true);

    // Anunciar "nenhuma ocorrencia" antes de ter perguntado seria falso.
    expect(screen.queryByText('Nenhuma ocorrência registrada')).not.toBeInTheDocument();
  });

  it('o título nomeia o que o grafico mede', () => {
    render([make('NOISE', 7)]);

    expect(screen.getByText('Ocorrências por categoria')).toBeInTheDocument();
  });
});
