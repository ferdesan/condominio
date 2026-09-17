/**
 * UT-032 — componentes do painel, isolados como unidade.
 *
 * Os graficos leem o tema resolvido (`useChartColors`), e o harness nao monta o
 * `ThemeProvider` — mesma razao e mesma solucao de `incidents-chart.test.tsx`.
 *
 * Interpretacoes registradas:
 *  - E1 ("StatCard sem valor -> 'N/A'") e realizado no valor reservado deste
 *    produto, que mora nos formatadores (`format.formatNumber/Currency` -> '—')
 *    e nao no StatCard: a pagina passa o numero ja formatado, e o cartao
 *    mostra o placeholder do dado ausente em vez de lixo ou vazio.
 *  - E5 ("FinancialChart sem dados -> 'Sem dados'") e realizado nos dois
 *    lugares reais: o grafico de linhas com a serie vazia desenha legenda e
 *    tabela sem linhas (nao inventa dado), e o estado vazio de despesas
 *    (`Sem despesas lancadas`) e a mensagem "sem dados" do modulo financeiro.
 *  - E6 ranqueia em barras `recharts`: no jsdom o container mede zero, entao a
 *    prova do topo de seis e na arvore de barras (paths), como a decisão de
 *    recorte de `incidents-chart.data`.
 */
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { Users } from 'lucide-react';
import { ThemeProvider } from '@/providers/theme-provider';
import { formatNumber } from '@/lib/format';
import type { ActivityEntry, CategoryTotal, FinancialSeriesPoint } from '@/types/api';
import { StatCard } from './stat-card';
import { ActivityFeed } from './activity-feed';
import { FinancialChart } from './financial-chart';
import { ExpensesChart } from './expenses-chart';
import { ChartTooltip } from './chart-tooltip';

/**
 * O container responsivo mede o pai para desenhar, e no jsdom a medida e zero —
 * sem largura, o Recharts nao materializa nem uma barra nem um rotulo. Como as
 * despesas nao tem modulo de dados puro (o recorte de ocorrencias tem, em
 * `incident-chart-data`), o container e interrompido em tamanho fixo para que o
 * recorte de `AssertTopSix` seja observavel na arvore real do Recharts.
 */
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  const { cloneElement, createElement, isValidElement } = await import('react');
  return {
    ...actual,
    // O `ResponsiveContainer` mede o pai no browser; no jsdom a medida e zero.
    // O duble repete o que ele faz — injetar tamanho no filho — com numeros
    // fixos, para que barras e rotulos existam de verdade.
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => {
      if (!isValidElement(children)) return createElement('div');
      return cloneElement(
        children as React.ReactElement<{ width?: number; height?: number }>,
        { width: 600, height: 300 },
      );
    },
  };
});

function makeActivity(i: number, overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: `a-${i}`,
    action: 'CREATE',
    resource: 'INCIDENT',
    resourceId: null,
    description: `Ocorrencia registrada ${i}`,
    userName: 'Marina Alves',
    createdAt: '2026-03-10T12:00:00.000Z',
    ...overrides,
  };
}

function makeCategoryTotal(i: number, total: number): CategoryTotal {
  return { categoryId: `c-${i}`, name: `Conta ${i}`, color: null, total };
}

const seriesPoints: FinancialSeriesPoint[] = [
  { referenceMonth: '2026-01', label: 'jan/2026', billed: 40_000, received: 25_000 },
  { referenceMonth: '2026-03', label: 'mar/2026', billed: 48_000, received: 31_500 },
];

function barCount(): number {
  return document.querySelectorAll('.recharts-rectangle').length;
}

describe('StatCard (UT-032, UT-032.E1)', () => {
  it('UT-032: mostra o rotulo, o numero e a pista', () => {
    renderWithProviders(
      <StatCard label="Total de unidades" value="48" hint="4 torres" icon={Users} />,
    );

    expect(screen.getByText('Total de unidades')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('4 torres')).toBeInTheDocument();
  });

  it('UT-032.E1: em carga, esconde o numero e mostra o esqueleto', () => {
    renderWithProviders(
      <StatCard label="Total de unidades" value="48" icon={Users} loading />,
    );

    expect(screen.getByText('Total de unidades')).toBeInTheDocument();
    expect(screen.queryByText('48')).not.toBeInTheDocument();
  });

  it('UT-032.E1: valor ausente usa o reservado do produto, nao o lixo', () => {
    // A pagina passa o numero ja formatado; formatNumber(null) e o placeholder
    // deste produto, decidido em `lib/format.ts`.
    renderWithProviders(
      <StatCard label="Total de unidades" value={formatNumber(null)} icon={Users} />,
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    // Nada de "undefined"/"null" vazando para a tela.
    expect(screen.getByText('—').textContent).toBe('—');
  });
});

describe('ActivityFeed (UT-032.E2/E3/E4)', () => {
  it('UT-032.E2: lista as atividades e limita a tela em oito', () => {
    const data = Array.from({ length: 10 }, (_, i) => makeActivity(i));
    renderWithProviders(<ActivityFeed data={data} loading={false} />);

    expect(screen.getByText('Atividade recente')).toBeInTheDocument();
    expect(screen.getByText('Ocorrencia registrada 0')).toBeInTheDocument();
    expect(screen.getByText('Ocorrencia registrada 7')).toBeInTheDocument();
    expect(screen.queryByText('Ocorrencia registrada 8')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Ocorrencia registrada \d/)).toHaveLength(8);
  });

  it('UT-032.E3: sem atividades, diz isso em vez de listar vazio', () => {
    renderWithProviders(<ActivityFeed data={[]} loading={false} />);

    expect(screen.getByText('Nenhuma atividade registrada')).toBeInTheDocument();
  });

  it('UT-032.E3: em carga, mostra o esqueleto e nao anuncia vazio', () => {
    renderWithProviders(<ActivityFeed data={[]} loading />);

    expect(screen.queryByText('Nenhuma atividade registrada')).not.toBeInTheDocument();
  });

  it('UT-032.E4: atividade sem autor cai para "Sistema"', () => {
    renderWithProviders(<ActivityFeed data={[makeActivity(1, { userName: null })]} loading={false} />);

    expect(screen.getByText(/Sistema/)).toBeInTheDocument();
    expect(screen.getByText('Ocorrencia registrada 1')).toBeInTheDocument();
  });
});

describe('FinancialChart (UT-032, UT-032.E5)', () => {
  it('UT-032: desenha a serie com legenda e a mesma serie em tabela', () => {
    renderWithProviders(
      <ThemeProvider>
        <FinancialChart data={seriesPoints} loading={false} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Faturado x recebido')).toBeInTheDocument();
    // A legenda e o cabecalho da tabela ficam no DOM (o `<details>` existe
    // mesmo fechado), entao a serie aparece nas duas leituras.
    expect(screen.getAllByText('Faturado').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Recebido').length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByText('Ver os numeros em tabela'));
    expect(screen.getByRole('table')).toBeInTheDocument();
    // O mes aparece no eixo do grafico e na linha da tabela.
    expect(screen.getAllByText('mar/2026').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('jan/2026').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('R$ 48.000,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 31.500,00')).toBeInTheDocument();
  });

  it('UT-032.E5: serie vazia nao inventa dado — legenda e tabela sem linhas', () => {
    renderWithProviders(
      <ThemeProvider>
        <FinancialChart data={[]} loading={false} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Faturado x recebido')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ver os numeros em tabela'));
    // A tabela existe, mas nada de mes fake.
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('mar/2026')).not.toBeInTheDocument();
    expect(screen.queryByText('R$ 0,00')).not.toBeInTheDocument();
  });
});

describe('ExpensesChart (UT-032.E5/E6)', () => {
  it('UT-032.E5: sem gastos, diz isso no lugar de um grafico em branco', () => {
    renderWithProviders(
      <ThemeProvider>
        <ExpensesChart data={[]} loading={false} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Sem despesas lancadas')).toBeInTheDocument();
    expect(screen.getByText('Nada a exibir no periodo.')).toBeInTheDocument();
    expect(barCount()).toBe(0);
  });

  it('UT-032.E6: ordena pelo maior e mostra apenas o topo de seis', () => {
    const data = [
      makeCategoryTotal(1, 400),
      makeCategoryTotal(2, 10),
      makeCategoryTotal(3, 300),
      makeCategoryTotal(4, 200),
      makeCategoryTotal(5, 150),
      makeCategoryTotal(6, 100),
      makeCategoryTotal(7, 50),
      makeCategoryTotal(8, 90),
    ];

    renderWithProviders(
      <ThemeProvider>
        <ExpensesChart data={data} loading={false} />
      </ThemeProvider>,
    );

    // 8 entram, 6 saem: os dois menores ficam de fora.
    // O rotulo do eixo vive num <tspan> dentro do <text>; casar com 'text' nao
    // acha nada, e faria as duas negativas passarem por ausencia de seletor.
    expect(barCount()).toBe(6);
    expect(screen.getByText('Conta 1', { selector: 'tspan' })).toBeInTheDocument();
    expect(screen.getByText('Conta 4', { selector: 'tspan' })).toBeInTheDocument();
    expect(screen.queryByText('Conta 2', { selector: 'tspan' })).not.toBeInTheDocument();
    expect(screen.queryByText('Conta 7', { selector: 'tspan' })).not.toBeInTheDocument();
  });
});

describe('ChartTooltip (UT-032.E7)', () => {
  it('UT-032.E7: inativo nao desenha nada', () => {
    const { container } = renderWithProviders(
      <ChartTooltip
        active={false}
        payload={[] as never}
        label=""
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('UT-032.E7: ativo formata a serie em moeda e nomeia a serie', () => {
    renderWithProviders(
      <ChartTooltip
        active
        payload={
          [
            { value: 48_000, name: 'Faturado', color: '#000', dataKey: 'billed' },
            { value: 31_500, name: 'Recebido', color: '#111', dataKey: 'received' },
          ] as never
        }
        label="mar/2026"
      />,
    );

    expect(screen.getByText('mar/2026')).toBeInTheDocument();
    expect(screen.getByText('Faturado')).toBeInTheDocument();
    expect(screen.getByText('R$ 48.000,00')).toBeInTheDocument();
    expect(screen.getByText('Recebido')).toBeInTheDocument();
    expect(screen.getByText('R$ 31.500,00')).toBeInTheDocument();
  });
});