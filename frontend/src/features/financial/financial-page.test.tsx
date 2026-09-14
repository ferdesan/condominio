import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/render';
import { FinancialPage } from './financial-page';
import {
  allReadRequests,
  lastParamsOf,
  makeCategory,
  makeCharge,
  makeDelinquencyRow,
  makeExpense,
  makeSummary,
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

/** Mesmo custo de portal do Radix medido nas demais telas. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

let world: FinancialWorld;

const CHARGE = 'Taxa condominial 03/2026';
const CHARGE_ACTION = `${CHARGE} da unidade 101`;
const EXPENSE = 'Limpeza mensal';

/** Linhas de dados, sem o cabecalho. */
function dataRows(): HTMLElement[] {
  return screen.getAllByRole('row').slice(1);
}

/** Indice da coluna pelo rotulo do cabecalho, para nao depender da ordem. */
function columnIndex(label: string): number {
  const headers = within(screen.getAllByRole('row')[0]).getAllByRole('columnheader');
  return headers.findIndex((header) => header.textContent?.trim().startsWith(label));
}

/** Conteudo de uma coluna em todas as linhas, na ordem em que aparecem. */
function cellsOf(label: string): string[] {
  const index = columnIndex(label);
  return dataRows().map((row) => within(row).getAllByRole('cell')[index].textContent?.trim() ?? '');
}

/** Troca a secao visivel. As tres vivem sob a mesma rota. */
function openSection(label: string): void {
  clickTrigger(screen.getByRole('button', { name: label }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Posicao financeira', () => {
  it('os numeros vem do endpoint de resumo, e nao da soma das linhas', async () => {
    // A unica cobranca carregada vale mil reais; o resumo fala em quarenta e
    // oito mil. Se a tela somasse as linhas, mostraria o numero errado.
    world = serveFinancial({ charges: [makeCharge()], summary: makeSummary() });
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);

    const region = screen.getByRole('region', { name: 'Posicao financeira' });
    expect(within(region).getByText('R$ 48.000,00')).toBeInTheDocument();
    expect(within(region).getByText('R$ 31.500,00')).toBeInTheDocument();
    expect(within(region).getByText(/19 cobrancas a receber/)).toBeInTheDocument();
    expect(
      allReadRequests().some((request) => request.url === '/financial/charges/summary'),
    ).toBe(true);
  });

  it('a inadimplencia por unidade vem da rota propria, ja ordenada pelo servidor', async () => {
    world = serveFinancial({
      charges: [makeCharge()],
      delinquency: [makeDelinquencyRow(), makeDelinquencyRow({ unitId: 'unit-8', unitNumber: '808', total: 1200, charges: 1 })],
    });
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);

    const region = screen.getByRole('region', { name: 'Posicao financeira' });
    expect(await within(region).findByText('Unidade 909')).toBeInTheDocument();
    expect(within(region).getByText('Unidade 808')).toBeInTheDocument();
  });

  it('sem condominio selecionado explica a exigencia e nao consulta nada', async () => {
    world = serveFinancial({ charges: [makeCharge()] });
    renderWithProviders(<FinancialPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condominio')).toBeInTheDocument();
    expect(mockGetPaginated).not.toHaveBeenCalled();
  });
});

describe('Cobrancas', () => {
  it('a listagem carrega escopada no condominio do shell', async () => {
    world = serveFinancial({ charges: [makeCharge()] });
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);
    expect(lastParamsOf('/financial/charges').condominiumId).toBe('cond-1');
  });

  it('o saldo soma encargos e abate o que ja entrou', async () => {
    world = serveFinancial({ charges: [makeCharge()] });
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);

    // 1000 + 20 de juros + 30 de multa - 50 de desconto - 200 pagos = 800.
    // A comparacao e pelos digitos: `Intl` separa "R$" do numero com espaco
    // rigido, que `textContent` preserva e uma string literal nao tem.
    const valor = cellsOf('Valor')[0];
    expect(valor).toContain('1.000,00');
    expect(valor).toContain('800,00');
  });

  it('registrar pagamento ja vem com o saldo preenchido e envia a baixa', async () => {
    world = serveFinancial({ charges: [makeCharge()] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.charges = [makeCharge({ status: 'PAID', paidAmount: 1000 })];
      return { charge: world.charges[0], payment: {} } as never;
    });
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);
    clickTrigger(screen.getByRole('button', { name: `Registrar pagamento de ${CHARGE_ACTION}` }));

    const dialog = await screen.findByRole('dialog');
    // A baixa total e o caso comum: o valor chega pronto com o saldo.
    expect(within(dialog).getByLabelText('Valor recebido (R$)')).toHaveValue(800);

    await user.click(within(dialog).getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/financial/charges/charge-1/payments');
    expect(body).toMatchObject({ amount: 800, method: 'PIX' });
    // A data sai em ISO, e nao no formato local do input nativo.
    expect(String((body as { paidAt: string }).paidAt)).toMatch(/Z$/);
  });

  it('cancelar pede confirmacao e a recusa do servidor aparece na linha', async () => {
    world = serveFinancial({ charges: [makeCharge({ status: 'PAID' })] });
    mockPost.mockRejectedValue(
      new ApiError('Cobranca ja quitada nao pode ser cancelada.', 409, 'BUSINESS_RULE'),
    );
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);
    clickTrigger(screen.getByRole('button', { name: `Cancelar ${CHARGE_ACTION}` }));

    // O pedido so sai depois da confirmacao.
    expect(mockPost).not.toHaveBeenCalled();
    clickTrigger(await screen.findByRole('button', { name: 'Cancelar cobranca' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/financial/charges/charge-1/cancel', {}));

    const message = await screen.findByText('Cobranca ja quitada nao pode ser cancelada.');
    expect(message).toHaveAttribute('role', 'alert');
    // O `onError` proprio substitui o toast global: a mesma recusa nao pode
    // aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('sem payment:create, a baixa nao e oferecida', async () => {
    world = serveFinancial({ charges: [makeCharge()] });
    // Quem administra cobrancas mas nao registra pagamento: a divisao e do
    // proprio `financial.routes.ts`.
    renderWithProviders(<FinancialPage />, { permissions: ['charge:manage'] });

    await screen.findByText(CHARGE);

    expect(
      screen.queryByRole('button', { name: `Registrar pagamento de ${CHARGE_ACTION}` }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Cancelar ${CHARGE_ACTION}` })).toBeInTheDocument();
  });

  it('cobranca lancada a mao envia os encargos e nenhum status', async () => {
    world = serveFinancial({ charges: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => makeCharge() as never);
    renderWithProviders(<FinancialPage />);

    await screen.findByText('Nenhuma cobranca lancada');
    clickTrigger(screen.getByRole('button', { name: 'Nova cobranca' }));

    const dialog = await screen.findByRole('dialog');
    // O painel de filtros tem rotulos iguais: as consultas sao escopadas no
    // dialogo, senao resolvem para o controle errado.
    await user.type(within(dialog).getByLabelText('Valor (R$)'), '1200');
    clickTrigger(within(dialog).getByLabelText('Unidade'));
    clickTrigger(await screen.findByRole('option', { name: /101/ }));

    await user.click(within(dialog).getByRole('button', { name: 'Lancar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/financial/charges');
    expect(body).toMatchObject({
      condominiumId: 'cond-1',
      unitId: 'unit-1',
      amount: 1200,
      discount: 0,
      interest: 0,
      penalty: 0,
    });
    // Quem move o status sao as rotas de baixa e cancelamento, e nao o corpo.
    expect(body).not.toHaveProperty('status');
  });
});

describe('Geracao em lote', () => {
  it('envia o pedido e diz quantas foram geradas e quantas foram puladas', async () => {
    world = serveFinancial({ charges: [] });
    const user = createUser();
    mockPost.mockResolvedValue({ created: 44, skipped: 4, total: 48 } as never);
    renderWithProviders(<FinancialPage />);

    await screen.findByText('Nenhuma cobranca lancada');
    clickTrigger(screen.getByRole('button', { name: 'Gerar cobrancas do mes' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Gerar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/financial/charges/generate');
    expect(body).toMatchObject({ condominiumId: 'cond-1', onlyOccupied: false });
    // Vazio significa "use a taxa da unidade": mandar zero geraria cobrancas de
    // R$ 0,00.
    expect(body).not.toHaveProperty('fixedAmount');
    expect(body).not.toHaveProperty('totalToApportion');

    // "Gerou" sem quantidade nao diria se a competencia ja tinha cobrancas.
    expect(await screen.findByText(/44 cobrancas geradas de 48 unidades/)).toBeInTheDocument();
    expect(screen.getByText(/4 ja tinham cobranca nesta competencia/)).toBeInTheDocument();
  });

  it('valor fixo e total a ratear juntos sao barrados antes do envio', async () => {
    world = serveFinancial({ charges: [] });
    const user = createUser();
    renderWithProviders(<FinancialPage />);

    await screen.findByText('Nenhuma cobranca lancada');
    clickTrigger(screen.getByRole('button', { name: 'Gerar cobrancas do mes' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Valor fixo por unidade (R$)'), '500');
    await user.type(within(dialog).getByLabelText('Total a ratear (R$)'), '24000');
    await user.click(within(dialog).getByRole('button', { name: 'Gerar' }));

    // Os dois juntos deixariam o servidor escolher em silencio qual vale.
    expect(
      await screen.findByText('Escolha um dos dois: valor fixo por unidade ou total a ratear.'),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe('Despesas', () => {
  it('a secao troca sem sair da rota', async () => {
    world = serveFinancial({ charges: [makeCharge()], expenses: [makeExpense()] });
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);
    openSection('Despesas');

    expect(await screen.findByText(EXPENSE)).toBeInTheDocument();
    expect(screen.queryByText(CHARGE)).not.toBeInTheDocument();
    expect(lastParamsOf('/financial/expenses').condominiumId).toBe('cond-1');
  });

  it('liquidar envia a data e a forma de pagamento', async () => {
    world = serveFinancial({ expenses: [makeExpense()] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.expenses = [makeExpense({ status: 'PAID' })];
      return world.expenses[0] as never;
    });
    renderWithProviders(<FinancialPage />);

    openSection('Despesas');
    await screen.findByText(EXPENSE);
    clickTrigger(screen.getByRole('button', { name: `Liquidar ${EXPENSE}` }));

    const dialog = await screen.findByRole('dialog');
    // A despesa e recorrente: o dialogo diz que a proxima sera agendada.
    expect(within(dialog).getByText(/a proxima sera agendada/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Liquidar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/financial/expenses/expense-1/pay');
    expect(body).toMatchObject({ paymentMethod: 'TRANSFER' });
    expect(String((body as { paidAt: string }).paidAt)).toMatch(/Z$/);
  });

  it('despesa nova nao envia status: quem liquida e a rota propria', async () => {
    world = serveFinancial({ expenses: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => makeExpense() as never);
    renderWithProviders(<FinancialPage />);

    openSection('Despesas');
    await screen.findByText('Nenhuma despesa lancada');
    clickTrigger(screen.getByRole('button', { name: 'Nova despesa' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Descricao'), 'Energia eletrica');
    await user.type(within(dialog).getByLabelText('Valor (R$)'), '3100');
    await user.click(within(dialog).getByRole('button', { name: 'Lancar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/financial/expenses');
    expect(body).toMatchObject({ description: 'Energia eletrica', amount: 3100 });
    expect(body).not.toHaveProperty('status');
  });

  it('excluir despesa pede confirmacao', async () => {
    world = serveFinancial({ expenses: [makeExpense()] });
    mockDelete.mockImplementation(async () => {
      world.expenses = [];
    });
    renderWithProviders(<FinancialPage />);

    openSection('Despesas');
    await screen.findByText(EXPENSE);
    clickTrigger(screen.getByRole('button', { name: `Excluir ${EXPENSE}` }));

    expect(mockDelete).not.toHaveBeenCalled();
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/financial/expenses/expense-1'));
  });
});

describe('Plano de contas', () => {
  it('lista as contas e distingue a inativa por texto', async () => {
    world = serveFinancial({
      categories: [
        makeCategory(),
        makeCategory({ id: 'category-2', name: 'Fundo de reserva', active: false }),
      ],
    });
    renderWithProviders(<FinancialPage />);

    openSection('Plano de contas');
    await screen.findByText('Fundo de reserva');

    // A tarja nomeia o estado: cor sozinha nao distingue inativa de ativa.
    expect(screen.getByText('Inativa')).toBeInTheDocument();
  });

  it('cadastrar uma conta envia a natureza escolhida', async () => {
    world = serveFinancial({ categories: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => makeCategory() as never);
    renderWithProviders(<FinancialPage />);

    openSection('Plano de contas');
    await screen.findByText('Plano de contas vazio');
    clickTrigger(screen.getByRole('button', { name: 'Nova conta' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nome'), 'Fundo de obras');
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/financial/categories');
    expect(body).toMatchObject({
      condominiumId: 'cond-1',
      name: 'Fundo de obras',
      kind: 'EXPENSE',
      active: true,
    });
  });

  it('editar uma conta manda o PATCH na rota do modulo', async () => {
    world = serveFinancial({ categories: [makeCategory()] });
    const user = createUser();
    mockPatch.mockImplementation(async () => makeCategory({ name: 'Taxa ordinaria' }) as never);
    renderWithProviders(<FinancialPage />);

    openSection('Plano de contas');
    await screen.findByText('Taxa condominial');
    clickTrigger(screen.getByRole('button', { name: 'Editar Taxa condominial' }));

    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Taxa ordinaria');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/financial/categories/category-1',
        expect.objectContaining({ name: 'Taxa ordinaria' }),
      ),
    );
  });
});

describe('Multa e juros em massa', () => {
  it('pede confirmacao e diz quantas cobrancas foram atualizadas', async () => {
    world = serveFinancial({ charges: [makeCharge({ status: 'OVERDUE' })] });
    mockPost.mockResolvedValue({ updated: 7 } as never);
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);
    clickTrigger(screen.getByRole('button', { name: 'Aplicar multa e juros' }));

    // A acao mexe em todas as vencidas de uma vez: a confirmacao e parte dela.
    expect(mockPost).not.toHaveBeenCalled();
    clickTrigger(await screen.findByRole('button', { name: 'Aplicar' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/financial/charges/apply-late-fees', {
        condominiumId: 'cond-1',
      }),
    );
    expect(await screen.findByText(/7 cobrancas vencidas foram atualizadas/)).toBeInTheDocument();
  });

  it('sem charge:manage, a acao em massa nao e oferecida', async () => {
    world = serveFinancial({ charges: [makeCharge()] });
    renderWithProviders(<FinancialPage />, {
      permissions: ['charge:read', 'charge:create', 'expense:read', 'financial-category:read'],
    });

    await screen.findByText(CHARGE);

    expect(
      screen.queryByRole('button', { name: 'Aplicar multa e juros' }),
    ).not.toBeInTheDocument();
    // Gerar continua: exige `charge:create`, que o papel tem.
    expect(screen.getByRole('button', { name: 'Gerar cobrancas do mes' })).toBeInTheDocument();
  });
});
