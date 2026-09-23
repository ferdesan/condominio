import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import {
  clickTrigger,
  createUser,
  fireEvent,
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
  makePayment,
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

/**
 * Troca a secao visivel. As quatro vivem sob a mesma rota.
 *
 * `role="tab"` porque o alternador e o Radix Tabs, nao botoes comuns; e
 * `mousedown` porque e ali que o gatilho do Radix troca o valor — o `click`
 * sozinho nao move nada.
 */
function openSection(label: string): void {
  fireEvent.mouseDown(screen.getByRole('tab', { name: label }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Posição financeira', () => {
  it('os números vem do endpoint de resumo, e não da soma das linhas', async () => {
    // A unica cobranca carregada vale mil reais; o resumo fala em quarenta e
    // oito mil. Se a tela somasse as linhas, mostraria o numero errado.
    world = serveFinancial({ charges: [makeCharge()], summary: makeSummary() });
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);

    const region = screen.getByRole('region', { name: 'Posição financeira' });
    expect(within(region).getByText('R$ 48.000,00')).toBeInTheDocument();
    expect(within(region).getByText('R$ 31.500,00')).toBeInTheDocument();
    expect(within(region).getByText(/19 cobranças a receber/)).toBeInTheDocument();
    expect(allReadRequests().some((request) => request.url === '/financial/charges/summary')).toBe(
      true,
    );
  });

  it('a inadimplência por unidade vem da rota própria, já ordenada pelo servidor', async () => {
    world = serveFinancial({
      charges: [makeCharge()],
      delinquency: [
        makeDelinquencyRow(),
        makeDelinquencyRow({ unitId: 'unit-8', unitNumber: '808', total: 1200, charges: 1 }),
      ],
    });
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);

    const region = screen.getByRole('region', { name: 'Posição financeira' });
    expect(await within(region).findByText('Unidade 909')).toBeInTheDocument();
    expect(within(region).getByText('Unidade 808')).toBeInTheDocument();
  });

  it('sem condomínio selecionado explica a exigência e não consulta nada', async () => {
    world = serveFinancial({ charges: [makeCharge()] });
    renderWithProviders(<FinancialPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condomínio')).toBeInTheDocument();
    expect(mockGetPaginated).not.toHaveBeenCalled();
  });
});

describe('Permissões de seção e consultas auxiliares', () => {
  it('sem expense:read e financial-category:read, so a aba de cobranças aparece', async () => {
    serveFinancial({ charges: [makeCharge()] });
    // O morador chega em `/financeiro` com `charge:read`; as demais abas pedem
    // permissões de leitura que ele nao tem, e mostra-las só geraria 403.
    renderWithProviders(<FinancialPage />, {
      permissions: ['charge:read', 'payment:read', 'unit:read'],
    });

    await screen.findByText(CHARGE);
    expect(screen.getByRole('tab', { name: 'Cobranças' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Despesas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Plano de contas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Balancete' })).not.toBeInTheDocument();

    // As consultas que o servidor recusaria nem saem: `/service-providers` e
    // `/financial/categories` exigem permissões que este papel nao tem.
    const urls = mockGetPaginated.mock.calls.map(([url]) => url);
    expect(urls).not.toContain('/service-providers');
    expect(urls).not.toContain('/financial/categories');
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('com as permissoes de leitura, as quatro abas seguem disponiveis', async () => {
    serveFinancial({ charges: [makeCharge()] });
    renderWithProviders(<FinancialPage />, {
      permissions: [
        'charge:read',
        'expense:read',
        'financial-category:read',
        'financial-closing:read',
      ],
    });

    await screen.findByText(CHARGE);
    for (const label of ['Cobranças', 'Despesas', 'Plano de contas', 'Balancete']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });
});

describe('Cobranças', () => {
  it('a listagem carrega escopada no condomínio do shell', async () => {
    world = serveFinancial({ charges: [makeCharge()] });
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);
    expect(lastParamsOf('/financial/charges').condominiumId).toBe('cond-1');
  });

  it('o saldo soma encargos e abate o que já entrou', async () => {
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

  it('registrar pagamento já vem com o saldo preenchido e envia a baixa', async () => {
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

  it('cancelar pede confirmação e a recusa do servidor aparece na linha', async () => {
    world = serveFinancial({ charges: [makeCharge({ status: 'PAID' })] });
    mockPost.mockRejectedValue(
      new ApiError('Cobrança já quitada não pode ser cancelada.', 409, 'BUSINESS_RULE'),
    );
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);
    clickTrigger(screen.getByRole('button', { name: `Cancelar ${CHARGE_ACTION}` }));

    // O pedido so sai depois da confirmacao.
    expect(mockPost).not.toHaveBeenCalled();
    clickTrigger(await screen.findByRole('button', { name: 'Cancelar cobrança' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/financial/charges/charge-1/cancel', {}),
    );

    const message = await screen.findByText('Cobrança já quitada não pode ser cancelada.');
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

  it('cobrança lancada a mao envia os encargos e nenhum status', async () => {
    world = serveFinancial({ charges: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => makeCharge() as never);
    renderWithProviders(<FinancialPage />);

    await screen.findByText('Nenhuma cobrança lancada');
    clickTrigger(screen.getByRole('button', { name: 'Nova cobrança' }));

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

describe('Geração em lote', () => {
  it('envia o pedido e diz quantas foram geradas e quantas foram puladas', async () => {
    world = serveFinancial({ charges: [] });
    const user = createUser();
    mockPost.mockResolvedValue({ created: 44, skipped: 4, total: 48 } as never);
    renderWithProviders(<FinancialPage />);

    await screen.findByText('Nenhuma cobrança lancada');
    clickTrigger(screen.getByRole('button', { name: 'Gerar cobranças do mês' }));

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
    expect(await screen.findByText(/44 cobranças geradas de 48 unidades/)).toBeInTheDocument();
    expect(screen.getByText(/4 já tinham cobrança nesta competência/)).toBeInTheDocument();
  });

  it('valor fixo e total a ratear juntos sao barrados antes do envio', async () => {
    world = serveFinancial({ charges: [] });
    const user = createUser();
    renderWithProviders(<FinancialPage />);

    await screen.findByText('Nenhuma cobrança lancada');
    clickTrigger(screen.getByRole('button', { name: 'Gerar cobranças do mês' }));

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
  it('a seção troca sem sair da rota', async () => {
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
    expect(within(dialog).getByText(/a próxima será agendada/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Liquidar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/financial/expenses/expense-1/pay');
    expect(body).toMatchObject({ paymentMethod: 'TRANSFER' });
    expect(String((body as { paidAt: string }).paidAt)).toMatch(/Z$/);
  });

  it('despesa nova não envia status: quem liquida e a rota própria', async () => {
    world = serveFinancial({ expenses: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => makeExpense() as never);
    renderWithProviders(<FinancialPage />);

    openSection('Despesas');
    await screen.findByText('Nenhuma despesa lancada');
    clickTrigger(screen.getByRole('button', { name: 'Nova despesa' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Descrição'), 'Energia eletrica');
    await user.type(within(dialog).getByLabelText('Valor (R$)'), '3100');
    await user.click(within(dialog).getByRole('button', { name: 'Lancar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/financial/expenses');
    expect(body).toMatchObject({ description: 'Energia eletrica', amount: 3100 });
    expect(body).not.toHaveProperty('status');
  });

  it('excluir despesa pede confirmação', async () => {
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
    mockPatch.mockImplementation(async () => makeCategory({ name: 'Taxa ordinária' }) as never);
    renderWithProviders(<FinancialPage />);

    openSection('Plano de contas');
    await screen.findByText('Taxa condominial');
    clickTrigger(screen.getByRole('button', { name: 'Editar Taxa condominial' }));

    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Taxa ordinária');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/financial/categories/category-1',
        expect.objectContaining({ name: 'Taxa ordinária' }),
      ),
    );
  });
});

describe('Multa e juros em massa', () => {
  it('pede confirmação e diz quantas cobranças foram atualizadas', async () => {
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
    expect(await screen.findByText(/7 cobranças vencidas foram atualizadas/)).toBeInTheDocument();
  });

  it('sem charge:manage, a acao em massa nao e oferecida', async () => {
    world = serveFinancial({ charges: [makeCharge()] });
    renderWithProviders(<FinancialPage />, {
      permissions: ['charge:read', 'charge:create', 'expense:read', 'financial-category:read'],
    });

    await screen.findByText(CHARGE);

    expect(screen.queryByRole('button', { name: 'Aplicar multa e juros' })).not.toBeInTheDocument();
    // Gerar continua: exige `charge:create`, que o papel tem.
    expect(screen.getByRole('button', { name: 'Gerar cobranças do mês' })).toBeInTheDocument();
  });
});

describe('Histórico de pagamentos de uma cobrança', () => {
  /**
   * `chargeLabel` acrescenta a unidade ao rotulo acessivel: numa tabela de
   * cobrancas, a descricao sozinha se repete entre unidades.
   */
  const VIEW_PAYMENTS = `Ver pagamentos de ${CHARGE} da unidade 101`;

  it('abre o histórico e pede so os pagamentos daquela cobrança', async () => {
    const user = createUser();
    serveFinancial({
      charges: [makeCharge({ id: 'charge-1', description: CHARGE, amount: 600 })],
      payments: [
        makePayment({ id: 'payment-1', chargeId: 'charge-1', amount: 250 }),
        makePayment({ id: 'payment-2', chargeId: 'charge-9', amount: 999 }),
      ],
    });
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);
    await user.click(screen.getByRole('button', { name: VIEW_PAYMENTS }));

    const dialog = await screen.findByRole('dialog');
    // Escopado na tabela: com uma baixa so, o rodape de total repete o mesmo
    // valor da linha.
    const table = await within(dialog).findByRole('table');
    expect(within(table).getByText('R$ 250,00')).toBeInTheDocument();
    // O duble filtra por `chargeId` como o servidor: o historico de outra
    // cobranca nao pode vazar para este dialogo.
    expect(within(dialog).queryByText('R$ 999,00')).not.toBeInTheDocument();
    expect(lastParamsOf('/financial/payments').chargeId).toBe('charge-1');
  });

  it('a soma das baixas explica um saldo parcial', async () => {
    const user = createUser();
    serveFinancial({
      charges: [makeCharge({ id: 'charge-1', description: CHARGE, amount: 600 })],
      payments: [
        makePayment({ id: 'payment-1', chargeId: 'charge-1', amount: 250 }),
        makePayment({ id: 'payment-2', chargeId: 'charge-1', amount: 170 }),
      ],
    });
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);
    await user.click(screen.getByRole('button', { name: VIEW_PAYMENTS }));

    const dialog = await screen.findByRole('dialog');
    // 250 + 170 de uma cobranca de 600: e a unica tela que mostra de onde vem
    // um saldo parcial.
    expect(await within(dialog).findByText('R$ 420,00')).toBeInTheDocument();
    expect(within(dialog).getByText('R$ 600,00')).toBeInTheDocument();
  });

  it('cobrança sem baixa rende estado vazio, e não tabela de zero linhas', async () => {
    const user = createUser();
    serveFinancial({
      charges: [makeCharge({ id: 'charge-1', description: CHARGE })],
      payments: [],
    });
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);
    await user.click(screen.getByRole('button', { name: VIEW_PAYMENTS }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Nenhum pagamento registrado')).toBeInTheDocument();
  });

  it('o histórico não oferece lancar pagamento', async () => {
    const user = createUser();
    serveFinancial({
      charges: [makeCharge({ id: 'charge-1', description: CHARGE })],
      payments: [makePayment({ chargeId: 'charge-1' })],
    });
    renderWithProviders(<FinancialPage />);

    await screen.findByText(CHARGE);
    await user.click(screen.getByRole('button', { name: VIEW_PAYMENTS }));

    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('table');
    // A baixa acontece por `POST /financial/charges/:id/payments`, que ja tem
    // tela. Um botao aqui duplicaria aquele caminho.
    expect(within(dialog).queryByRole('button', { name: /Registrar/ })).not.toBeInTheDocument();
  });

  it('sem payment:read, a acao nao e oferecida', async () => {
    serveFinancial({ charges: [makeCharge({ id: 'charge-1', description: CHARGE })] });
    // Consultar o que ja foi baixado e leitura, e `financial.routes.ts` separa
    // `payment:read` de `payment:create`.
    renderWithProviders(<FinancialPage />, {
      permissions: ['charge:read', 'charge:manage', 'payment:create'],
    });

    await screen.findByText(CHARGE);
    expect(screen.queryByRole('button', { name: VIEW_PAYMENTS })).not.toBeInTheDocument();
  });
});
