import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPost } from '@/lib/api';
import { makeCondominium } from '@/test/fixtures';
import {
  clickTrigger,
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/render';
import { FinancialPage } from './financial-page';
import { allReadRequests, makeStatement, serveFinancial } from './test-utils';

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

const condominium = makeCondominium({ id: 'condo-1' });
const currentMonth = new Date().toISOString().slice(0, 7);

/**
 * Abre a secao e espera o titulo. O nome casa por trecho porque o titulo carrega
 * tambem o nome do condominio — a casca some na impressao, e o documento precisa
 * dizer de quem ele e.
 *
 * `role="tab"` e `mousedown`: o alternador e o Radix Tabs, que troca o valor no
 * botao esquerdo do mouse, nao no `click`.
 */
async function openClosing(): Promise<void> {
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Balancete' }));
  await screen.findByRole('heading', { name: /^Balancete mensal/ });
}

function render(options: { permissions?: string[] } = {}) {
  return renderWithProviders(<FinancialPage />, {
    condominium,
    condominiums: [condominium],
    ...(options.permissions ? { permissions: options.permissions } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Balancete na tela de Financeiro', () => {
  it('IT-305: a seção mostra o mês, os saldos com procedência e as duas tabelas', async () => {
    serveFinancial();
    render();
    await openClosing();

    expect(screen.getByLabelText('Competência')).toHaveValue(currentMonth);
    expect(await screen.findByText(/Calculado a partir do saldo de abertura/)).toBeInTheDocument();

    expect(screen.getByText('Entradas por categoria')).toBeInTheDocument();
    expect(screen.getByText('Saídas por categoria')).toBeInTheDocument();
    expect(screen.getByText('Taxa condominial')).toBeInTheDocument();
    expect(screen.getByText('Agua e energia')).toBeInTheDocument();
    expect(screen.getByText('Resultado do mês')).toBeInTheDocument();
    expect(screen.getByText('Saldo final')).toBeInTheDocument();
  });

  it('IT-306: trocar a competência refaz a leitura com o mês escolhido', async () => {
    const world = serveFinancial();
    render();
    await openClosing();
    await screen.findByText('Taxa condominial');

    world.statement = makeStatement({
      referenceMonth: '2026-03',
      income: [{ categoryId: 'cat-9', name: 'Fundo de reserva', total: 42 }],
      totalIncome: 42,
    });

    fireEvent.change(screen.getByLabelText('Competência'), { target: { value: '2026-03' } });

    expect(await screen.findByText('Fundo de reserva')).toBeInTheDocument();
    expect(
      allReadRequests().some((request) => request.url === '/financial/closings/2026-03'),
    ).toBe(true);
  });

  it('IT-307: mês sem lançamento diz isso, e não mostra um balancete de zeros', async () => {
    serveFinancial({
      statement: makeStatement({
        income: [],
        expense: [],
        totalIncome: 0,
        totalExpense: 0,
        result: 0,
      }),
    });
    render();
    await openClosing();

    expect(await screen.findByText(/Nenhum lançamento em/)).toBeInTheDocument();
    expect(screen.queryByText('Resultado do mês')).not.toBeInTheDocument();
  });

  it('IT-308: mês fechado mostra o selo e oferece reabrir, sem oferecer fechar', async () => {
    serveFinancial({
      statement: makeStatement({ status: 'CLOSED', closedAt: '2026-09-02T10:00:00.000Z' }),
    });
    render();
    await openClosing();

    expect(await screen.findByText(/Fechado em/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reabrir mês' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fechar mês' })).not.toBeInTheDocument();
  });

  it('IT-309: sem a permissão de fechar, a ação não é oferecida', async () => {
    serveFinancial();
    render({ permissions: ['charge:read', 'financial-closing:read'] });
    await openClosing();
    await screen.findByText('Taxa condominial');

    expect(screen.queryByRole('button', { name: 'Fechar mês' })).not.toBeInTheDocument();
  });

  it('IT-310: sem a permissão de reabrir, a ação não é oferecida num mês fechado', async () => {
    serveFinancial({ statement: makeStatement({ status: 'CLOSED' }) });
    render({ permissions: ['charge:read', 'financial-closing:read', 'financial-closing:create'] });
    await openClosing();
    await screen.findByText(/Em aberto|Fechado em/);

    expect(screen.queryByRole('button', { name: 'Reabrir mês' })).not.toBeInTheDocument();
  });

  it('IT-311: fechar pede confirmação, e só então chama o servidor', async () => {
    serveFinancial();
    render();
    await openClosing();
    await screen.findByText('Taxa condominial');

    clickTrigger(screen.getByRole('button', { name: 'Fechar mês' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Fechar o balancete de/)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();

    clickTrigger(within(dialog).getByRole('button', { name: /Cancelar/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(apiPost).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Fechar mês' }));
    const again = await screen.findByRole('dialog');
    clickTrigger(within(again).getByRole('button', { name: /^Fechar mês$/ }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        `/financial/closings/${currentMonth}/close`,
        expect.objectContaining({ condominiumId: 'condo-1' }),
      ),
    );
  });

  it('IT-312: sem a permissão de leitura, a seção some do alternador e as outras seguem', async () => {
    serveFinancial();
    render({ permissions: ['charge:read', 'expense:read', 'financial-category:read'] });

    await screen.findByRole('tab', { name: 'Cobranças' });
    expect(screen.queryByRole('tab', { name: 'Balancete' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Despesas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Plano de contas' })).toBeInTheDocument();
  });

  it('IT-313: recusa do servidor aparece na seção, e o mês continua aberto na tela', async () => {
    const { ApiError } = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
    serveFinancial();
    render();
    await openClosing();
    await screen.findByText('Taxa condominial');

    vi.mocked(apiPost).mockRejectedValueOnce(
      new ApiError('A competência 2026-09 já está fechada.', 409, 'BUSINESS_RULE_VIOLATION'),
    );

    clickTrigger(screen.getByRole('button', { name: 'Fechar mês' }));
    const dialog = await screen.findByRole('dialog');
    clickTrigger(within(dialog).getByRole('button', { name: /^Fechar mês$/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/já está fechada/);
    expect(screen.getByRole('button', { name: 'Fechar mês' })).toBeInTheDocument();
  });

  it('IT-341: a seção oferece o link para o documento completo e não oferece mais exportar', async () => {
    /*
      A exportacao migrou para `/financeiro/balancete/:mes` (ADR-005), e as duas
      metades deste caso sao uma so afirmacao: a secao aponta para o documento em
      vez de tentar ser ele. Exportar tambem daqui produziria dois arquivos com o
      mesmo nome — `closingCsvFileName` so olha a competencia — e conteudos
      diferentes, porque o payload desta secao e o resumo.

      `balancete-mensal` IT-314 foi realocado para la como IT-345, e nao e
      reimplementado aqui.
    */
    serveFinancial();
    render();
    await openClosing();
    await screen.findByText('Taxa condominial');

    expect(screen.getByRole('link', { name: 'Ver o documento completo' })).toHaveAttribute(
      'href',
      `/financeiro/balancete/${currentMonth}`,
    );
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument();

    /*
      As marcacoes de impressao foram junto. Enquanto elas estivessem aqui,
      imprimir a partir de `/financeiro` renderia uma folha com o resumo e sem os
      lancamentos — o documento incompleto que a rota existe para substituir.
    */
    const section = screen.getByRole('region', { name: /Balancete mensal/ });
    expect(section).not.toHaveClass('print-document');
    expect(section.querySelector('.print-hide')).toBeNull();
  });

  it('IT-315: abrir /financeiro não lê o balancete — a seção só monta quando escolhida', async () => {
    serveFinancial();
    render();
    await screen.findByRole('tab', { name: 'Cobranças' });

    await waitFor(() => expect(allReadRequests().length).toBeGreaterThan(0));
    expect(allReadRequests().some((request) => request.url.includes('/financial/closings'))).toBe(
      false,
    );
  });
});
