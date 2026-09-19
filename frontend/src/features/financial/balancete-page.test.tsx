/**
 * A tela do balancete na rota propria.
 *
 * O parametro entra montando um `<Routes>` local e passando a URL concreta em
 * `route`, como `condominium-detail-page.test.tsx:68-75` faz. A existencia da
 * rota dentro do roteador de verdade e afirmada uma vez so, em
 * `routes.test.tsx`, do jeito que `/perfil` e — aqui o alvo e a tela.
 */

import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCondominium } from '@/test/fixtures';
import {
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  within,
  type RenderWithProvidersOptions,
} from '@/test/render';
import { BalancetePage } from './balancete-page';
import {
  allReadRequests,
  makeStatement,
  makeStatementEntry,
  serveFinancial,
  type FinancialWorld,
} from './test-utils';

// O duble fica so na camada de transporte (ADR-010); `ApiError` continua real.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiGet: vi.fn(),
    apiGetPaginated: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiDelete: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const condominium = makeCondominium({ id: 'condo-1', name: 'Residencial Aurora' });
const MONTH = '2026-08';

/** Quantos lancamentos cabem numa pagina da tabela; espelha `PAGE_SIZE`. */
const PAGE_SIZE = 20;

const INCOME = makeStatementEntry({
  sourceId: 'payment-1',
  occurredAt: '2026-08-03T12:00:00.000Z',
  description: 'Taxa condominial da 101',
  counterpart: '101',
  amount: 500,
});

const EXPENSE = makeStatementEntry({
  kind: 'EXPENSE',
  sourceId: 'expense-1',
  occurredAt: '2026-08-11T12:00:00.000Z',
  categoryId: 'cat-2',
  categoryName: 'Agua e energia',
  description: 'Conta de energia',
  counterpart: 'Companhia Elétrica',
  amount: 320,
  method: 'BOLETO',
});

function serveMonth(closingEntries: FinancialWorld['closingEntries'], statement = makeStatement()) {
  return serveFinancial({
    statement: { ...statement, referenceMonth: MONTH, condominiumId: condominium.id },
    closingEntries,
  });
}

function renderBalancete(mes = MONTH, options: RenderWithProvidersOptions = {}) {
  return renderWithProviders(
    <Routes>
      <Route path="/financeiro/balancete/:mes" element={<BalancetePage />} />
    </Routes>,
    {
      route: `/financeiro/balancete/${mes}`,
      condominium,
      condominiums: [condominium],
      ...options,
    },
  );
}

/**
 * A tabela de lancamentos, depois que a tela terminou de carregar.
 *
 * A espera e pelo resumo, e nao pelo `h1`: o esqueleto ja traz o mesmo titulo de
 * proposito, para a pagina nao saltar quando os dados chegam, entao esperar por
 * ele resolveria antes de haver tabela alguma.
 */
async function entriesTable(): Promise<HTMLElement> {
  await screen.findByRole('region', { name: 'Resumo da competência' });
  return screen.getByRole('table');
}

/** As linhas de dados: o `<thead>` tambem e uma linha, e nao conta. */
function dataRows(table: HTMLElement): HTMLElement[] {
  return within(table).getAllByRole('row').slice(1);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Balancete na rota própria', () => {
  it('IT-335: a tela mostra o resumo em cima e os lançamentos embaixo, um por movimento', async () => {
    serveMonth({ frozen: false, entries: [INCOME, EXPENSE] });
    renderBalancete();

    const table = await entriesTable();

    const summary = screen.getByRole('region', { name: 'Resumo da competência' });
    expect(within(summary).getByText('Saldo anterior')).toBeInTheDocument();
    expect(within(summary).getByText('Entradas')).toBeInTheDocument();
    expect(within(summary).getByText('Saídas')).toBeInTheDocument();
    expect(within(summary).getByText('Resultado do mês')).toBeInTheDocument();

    // Em cima e embaixo nao e figura de linguagem: o documento se le de cima
    // para baixo, e um resumo depois da lista nao resumiria coisa alguma.
    const entriesRegion = screen.getByRole('region', { name: 'Lançamentos' });
    expect(summary.compareDocumentPosition(entriesRegion)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    expect(dataRows(table)).toHaveLength(2);
    expect(within(table).getByText('Taxa condominial da 101')).toBeInTheDocument();
    expect(within(table).getByText('Conta de energia')).toBeInTheDocument();
    expect(within(table).getByText('Entrada')).toBeInTheDocument();
    expect(within(table).getByText('Saída')).toBeInTheDocument();
    expect(within(table).getByText('Companhia Elétrica')).toBeInTheDocument();
  });

  it('IT-336: escolher uma categoria deixa so os lançamentos dela, e limpar traz o resto de volta', async () => {
    serveMonth({ frozen: false, entries: [INCOME, EXPENSE] });
    renderBalancete();

    await entriesTable();

    selectOption(screen.getByLabelText('Categoria'), 'Agua e energia');

    expect(dataRows(screen.getByRole('table'))).toHaveLength(1);
    expect(screen.getByText('Conta de energia')).toBeInTheDocument();
    expect(screen.queryByText('Taxa condominial da 101')).not.toBeInTheDocument();

    selectOption(screen.getByLabelText('Categoria'), 'Todas as categorias');

    expect(dataRows(screen.getByRole('table'))).toHaveLength(2);
    expect(screen.getByText('Taxa condominial da 101')).toBeInTheDocument();
    expect(screen.getByText('Conta de energia')).toBeInTheDocument();
  });

  it('IT-337: a segunda página mostra o resto sem nenhuma requisição nova', async () => {
    const extra = 5;
    const many = Array.from({ length: PAGE_SIZE + extra }, (_, index) =>
      makeStatementEntry({
        sourceId: `payment-${index}`,
        description: `Lançamento ${index}`,
        occurredAt: `2026-08-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
      }),
    );
    serveMonth({ frozen: false, entries: many });
    const user = createUser();
    renderBalancete();

    expect(dataRows(await entriesTable())).toHaveLength(PAGE_SIZE);

    // O mes inteiro ja esta em memoria (ADR-004): trocar de pagina e recortar, e
    // nao pedir. Sem esta contagem o caso passaria tambem com paginacao no
    // servidor, que e exatamente o desenho recusado.
    const before = allReadRequests().length;
    // Guarda contra a asercao vazia: se o contador nao registrasse nada, a
    // igualdade la embaixo passaria sem provar coisa nenhuma.
    expect(before).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Próxima página' }));

    expect(dataRows(screen.getByRole('table'))).toHaveLength(extra);
    expect(screen.getByText(`Lançamento ${PAGE_SIZE}`)).toBeInTheDocument();
    expect(allReadRequests()).toHaveLength(before);
  });

  it('IT-338: um mês aberto se identifica como aberto, e não se apresenta como documento fechado', async () => {
    serveMonth(
      { frozen: false, entries: [INCOME] },
      makeStatement({ status: 'OPEN', closedAt: null, closedBy: null }),
    );
    renderBalancete();

    await entriesTable();

    expect(screen.getByText('Em aberto')).toBeInTheDocument();
    expect(screen.getByText(/^Mês em aberto:/)).toBeInTheDocument();
    expect(screen.getByText(/calculados agora, porque o mês está aberto/)).toBeInTheDocument();
    expect(screen.queryByText(/^Fechado em/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Documento fechado:/)).not.toBeInTheDocument();
  });

  it('IT-339: um mês fechado traz o selo com a data e os lançamentos que a resposta marcou congelados', async () => {
    serveMonth(
      { frozen: true, entries: [INCOME, EXPENSE] },
      makeStatement({
        status: 'CLOSED',
        closedAt: '2026-09-02T10:00:00.000Z',
        closedBy: { id: 'user-1', name: 'Ana Lima' },
      }),
    );
    renderBalancete();

    const table = await entriesTable();

    expect(screen.getByText('Fechado em 02/09/2026 por Ana Lima')).toBeInTheDocument();
    expect(screen.queryByText('Em aberto')).not.toBeInTheDocument();

    // `frozen` nao e decoracao: e o que separa o documento gravado do calculo ao
    // vivo, e a tela diz ao leitor de qual dos dois ele esta olhando.
    expect(screen.getByText(/congelados no fechamento do mês/)).toBeInTheDocument();
    expect(dataRows(table)).toHaveLength(2);
    expect(within(table).getByText('Taxa condominial da 101')).toBeInTheDocument();
  });

  it('IT-340: documento anterior ao registro dos lançamentos diz isso, em vez de tabela vazia', async () => {
    serveMonth(
      { frozen: true, entries: [] },
      makeStatement({
        status: 'CLOSED',
        closedAt: '2026-09-02T10:00:00.000Z',
        closedBy: { id: 'user-1', name: 'Ana Lima' },
        totalIncome: 3_000,
        totalExpense: 1_200,
      }),
    );
    renderBalancete();

    expect(
      await screen.findByText('Documento anterior ao registro dos lançamentos'),
    ).toBeInTheDocument();

    // A tabela vazia e o erro que este caso existe para impedir: ela afirmaria
    // que o mes nao teve movimento, quando os totais acima dizem que teve.
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhum lançamento neste mês')).not.toBeInTheDocument();

    const summary = screen.getByRole('region', { name: 'Resumo da competência' });
    expect(within(summary).getByText('Entradas')).toBeInTheDocument();
    expect(within(summary).getByText('Saídas')).toBeInTheDocument();
  });

  it('IT-343: competência malformada rende o estado de não encontrado, com volta para o financeiro', async () => {
    serveMonth({ frozen: false, entries: [INCOME] });
    renderBalancete('2026-13');

    expect(await screen.findByText('Balancete não encontrado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para o financeiro' })).toHaveAttribute(
      'href',
      '/financeiro',
    );

    // E nem chega a perguntar: o servidor recusaria `2026-13` com 422, e gastar
    // a requisicao para descobrir o que a competencia ja diz seria desperdicio.
    expect(allReadRequests()).toHaveLength(0);
  });
});
