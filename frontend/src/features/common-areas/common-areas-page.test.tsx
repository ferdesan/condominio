import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { makeCommonArea, makeMeta } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  fireEvent,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { CommonArea } from '@/types/api';
import { CommonAreasPage } from './common-areas-page';

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

// Abrir um portal do Radix custa dezenas de segundos neste ambiente; a nota
// completa esta em `residents-page.test.tsx`. O prazo vale para o arquivo todo.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

/** Estado do servidor durante um caso; mutavel, para que o refetch veja a mudanca. */
type World = { areas: CommonArea[]; total?: number };

let world: World;

function serve(areas: CommonArea[]): void {
  world = { areas };
  mockGetPaginated.mockImplementation(async (_url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    return {
      data: world.areas,
      meta: makeMeta({
        total: world.total ?? world.areas.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });
}

/** Os parametros da ultima listagem de areas pedida pela tela. */
function lastListParams(): Record<string, unknown> {
  const calls = mockGetPaginated.mock.calls.filter(([url]) => url === '/common-areas');
  return (calls.at(-1)?.[1]?.params ?? {}) as Record<string, unknown>;
}

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

/** Areas com nomes previsiveis, para conferir qual pagina chegou. */
function makeRoster(count: number, offset = 0): CommonArea[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeCommonArea({
      id: `area-${position}`,
      name: `Área ${String(position).padStart(3, '0')}`,
    });
  });
}

/** Abre o dialogo de cadastro e espera o formulario montar. */
async function openCreateForm(): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: 'Nova área comum' }));
  await screen.findByRole('dialog');
}

/** O corpo enviado no ultimo `POST /common-areas`. */
function lastCreateBody(): Record<string, unknown> {
  return (mockPost.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de áreas comuns', () => {
  it('busca, filtros, paginação e ordenação chegam ao servidor como ele os aceita', async () => {
    serve(makeRoster(20));
    world.total = 60;
    const user = createUser();
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Área 001');
    // Toda consulta nasce presa ao condominio escolhido no shell.
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'Salao');
    await waitFor(() => expect(lastListParams().search).toBe('Salao'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta.
    selectOption(screen.getByLabelText('Status'), 'Em manutenção');
    expect(lastListParams().status).toBe('MAINTENANCE');

    selectOption(screen.getByLabelText('Aprovação'), 'Exige aprovação');
    expect(lastListParams().requiresApproval).toBe('true');

    // A ordenacao viaja em caixa alta; a tabela fala em caixa baixa e a
    // traducao mora na camada de dados (ADR-008/ADR-009).
    clickTrigger(screen.getByRole('button', { name: /^Nome/ }));
    expect(lastListParams().sortBy).toBe('name');
    expect(lastListParams().sortOrder).toBe('ASC');

    world.areas = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /próxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Área 021')).toBeInTheDocument();
    // Os controles anteriores continuam valendo na pagina seguinte.
    expect(lastListParams()).toMatchObject({
      condominiumId: 'cond-1',
      search: 'Salao',
      status: 'MAINTENANCE',
      requiresApproval: 'true',
      sortOrder: 'ASC',
    });
  });

  it('lista vazia oferece cadastrar, e busca sem resultado oferece limpar', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CommonAreasPage />);

    // Sem nenhum registro: o convite e cadastrar o primeiro.
    expect(await screen.findByText('Nenhuma área comum cadastrada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar área comum' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Buscar'), 'piscina');

    // Com um termo aplicado: o convite e desfazer a busca. Os dois estados sao
    // distinguiveis, e nao a mesma tela vazia.
    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cadastrar área comum' })).not.toBeInTheDocument();
  });

  it('sem condomínio selecionado explica a exigência e não consulta', async () => {
    serve([makeCommonArea()]);
    renderWithProviders(<CommonAreasPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condomínio')).toBeInTheDocument();
    expect(mockGetPaginated.mock.calls.filter(([url]) => url === '/common-areas')).toHaveLength(0);
  });

  it('celula nula rende o placeholder, nunca a string "null"', async () => {
    serve([makeCommonArea({ description: null })]);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Salao de Festas');

    expect(cellsOf('Descrição')).toEqual(['—']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('capacidade zero e dias nulos sao lidos como ausência de limite, não como vazio', async () => {
    serve([makeCommonArea({ capacity: 0, availableWeekdays: null })]);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Salao de Festas');

    expect(cellsOf('Capacidade')).toEqual(['Sem limite']);
    expect(cellsOf('Dias')).toEqual(['Todos os dias']);
  });

  it('a taxa de reserva aparece como dinheiro na listagem', async () => {
    serve([makeCommonArea({ reservationFee: 150 })]);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Salao de Festas');

    expect(cellsOf('Taxa')[0]).toMatch(/R\$\s*150,00/);
  });
});

describe('Cadastro de área comum', () => {
  it('envia os campos e a lista se atualiza sem refetch manual', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.areas = [makeCommonArea({ id: 'area-9', name: 'Churrasqueira' })];
      return world.areas[0] as never;
    });
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma área comum cadastrada');
    clickTrigger(screen.getByRole('button', { name: 'Cadastrar área comum' }));
    await screen.findByRole('dialog');

    await user.type(screen.getByLabelText('Nome'), 'Churrasqueira');
    clickTrigger(screen.getByRole('button', { name: 'Criar área' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/common-areas', expect.anything()));
    // A invalidacao da fabrica traz a lista nova: nenhuma tela pede refetch.
    expect(await screen.findByText('Churrasqueira')).toBeInTheDocument();
  });

  it('o corpo carrega o condomínio do shell e os padrões do servidor', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockResolvedValue(makeCommonArea() as never);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma área comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Quadra');
    clickTrigger(screen.getByRole('button', { name: 'Criar área' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(lastCreateBody()).toMatchObject({
      condominiumId: 'cond-1',
      name: 'Quadra',
      status: 'AVAILABLE',
      capacity: 0,
      opensAt: '08:00',
      closesAt: '22:00',
      availableWeekdays: null,
      minHours: 1,
      maxHours: 6,
      advanceBookingDays: 60,
      minIntervalDays: 0,
      requiresApproval: true,
      reservationFee: 0,
    });
  });

  it('422 com campo aparece no campo, sem toast', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
        { field: 'name', message: 'Já existe uma área com este nome.' },
      ]),
    );
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma área comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Salao de Festas');
    clickTrigger(screen.getByRole('button', { name: 'Criar área' }));

    expect(await screen.findByText('Já existe uma área com este nome.')).toBeInTheDocument();
    // O formulario apresenta a falha por si; o toast global duplicaria.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('409 sem campo vira mensagem do formulário e preserva o preenchido', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Já existe uma área comum com este nome neste condomínio.', 409, 'CONFLICT'),
    );
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma área comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Salao de Festas');
    await user.type(screen.getByLabelText('Capacidade'), '0');
    clickTrigger(screen.getByRole('button', { name: 'Criar área' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Já existe uma área comum com este nome neste condomínio.');
    // O dialogo continua aberto com o que foi digitado: reescrever tudo seria
    // a punicao errada para um conflito de nome.
    expect(screen.getByLabelText('Nome')).toHaveValue('Salao de Festas');
  });

  it('dois cliques em salvar produzem uma única requisição', async () => {
    serve([]);
    const user = createUser();
    // A requisicao demora o bastante para que o segundo clique caia enquanto a
    // primeira ainda esta no ar, e se resolve sozinha antes do fim do caso.
    mockPost.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(makeCommonArea()), 50)) as never,
    );
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma área comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Coworking');
    const submit = screen.getByRole('button', { name: 'Criar área' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });
});

describe('Validações cruzadas de área comum', () => {
  it('fechamento anterior a abertura e recusado no campo do fechamento', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma área comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Piscina');
    fireEvent.change(screen.getByLabelText('Abre as'), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText('Fecha as'), { target: { value: '09:00' } });
    clickTrigger(screen.getByRole('button', { name: 'Criar área' }));

    const field = screen.getByLabelText('Fecha as');
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    expect(
      screen.getByText('O horário de fechamento deve ser posterior ao de abertura.'),
    ).toBeInTheDocument();
    // A objecao e local: nada foi enviado.
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('duração máxima menor que a mínima e recusada no campo da máxima', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma área comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Piscina');
    fireEvent.change(screen.getByLabelText('Duração mínima (h)'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Duração máxima (h)'), { target: { value: '2' } });
    clickTrigger(screen.getByRole('button', { name: 'Criar área' }));

    const field = screen.getByLabelText('Duração máxima (h)');
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    expect(
      screen.getByText('A duração máxima deve ser maior ou igual a mínima.'),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe('Dias da semana', () => {
  it('o seletor grava um array de inteiros', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockResolvedValue(makeCommonArea() as never);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma área comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Quadra');
    // Sair de "todos os dias" revela as caixas por dia.
    await user.click(screen.getByLabelText('Todos os dias'));
    await user.click(screen.getByLabelText('Sábado'));
    await user.click(screen.getByLabelText('Domingo'));
    clickTrigger(screen.getByRole('button', { name: 'Criar área' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    // Inteiros e ordenados, com domingo em zero — como o servidor numera.
    expect(lastCreateBody().availableWeekdays).toEqual([0, 6]);
  });

  it('"todos os dias" e "nenhum dia" produzem valores distintos', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockResolvedValue(makeCommonArea() as never);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma área comum cadastrada');

    // Primeiro envio: "todos os dias" marcado, que e o padrao.
    await openCreateForm();
    await user.type(screen.getByLabelText('Nome'), 'Quadra');
    clickTrigger(screen.getByRole('button', { name: 'Criar área' }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody().availableWeekdays).toBeNull();

    // Segundo envio: restricao ativa e nenhum dia marcado.
    await openCreateForm();
    await user.type(screen.getByLabelText('Nome'), 'Quadra coberta');
    await user.click(screen.getByLabelText('Todos os dias'));
    clickTrigger(screen.getByRole('button', { name: 'Criar área' }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));

    // Nulo libera a semana inteira; a lista vazia e uma restricao explicita. Os
    // dois estados chegam diferentes ao servidor.
    expect(lastCreateBody().availableWeekdays).toEqual([]);
  });

  it('nenhum dia liberado e anunciado antes do envio', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma área comum cadastrada');
    await openCreateForm();

    await user.click(screen.getByLabelText('Todos os dias'));

    expect(
      screen.getByText(/Nenhum dia liberado: a área não aceitara reservas/),
    ).toBeInTheDocument();
  });
});

describe('Taxa de reserva', () => {
  it('e exibida como dinheiro no formulário e enviada como número', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockResolvedValue(makeCommonArea() as never);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma área comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Salao');
    const fee = screen.getByLabelText('Taxa de reserva') as HTMLInputElement;
    fireEvent.change(fee, { target: { value: '250' } });

    // O campo reformata para moeda assim que o valor chega ao formulario.
    await waitFor(() => expect(fee.value).toMatch(/R\$\s*250,00/));

    clickTrigger(screen.getByRole('button', { name: 'Criar área' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    // O corpo leva numero, e nao o texto formatado.
    expect(lastCreateBody().reservationFee).toBe(250);
  });
});

describe('Edição de área comum', () => {
  it('os campos vem preenchidos com o registro existente', async () => {
    const area = makeCommonArea({
      name: 'Salao de Festas',
      description: 'Salao com cozinha equipada.',
      status: 'MAINTENANCE',
      capacity: 80,
      photoUrl: 'https://exemplo.com/salao.jpg',
      opensAt: '10:00',
      closesAt: '23:00',
      availableWeekdays: [5, 6],
      minHours: 3,
      maxHours: 8,
      advanceBookingDays: 90,
      minIntervalDays: 15,
      requiresApproval: false,
      reservationFee: 320,
      rules: 'Devolver limpo.',
    });
    serve([area]);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Salao de Festas');
    clickTrigger(screen.getByRole('button', { name: 'Editar Salao de Festas' }));
    // "Status" tambem rotula o filtro da listagem, que segue montado atras do
    // dialogo: as buscas ficam presas ao formulario.
    const form = within(await screen.findByRole('dialog'));

    // Identificacao.
    expect(form.getByLabelText('Nome')).toHaveValue('Salao de Festas');
    expect(form.getByLabelText('Descrição')).toHaveValue('Salao com cozinha equipada.');
    expect(form.getByLabelText('Status')).toHaveTextContent('Em manutenção');
    expect(form.getByLabelText('Capacidade')).toHaveValue('80');
    expect(form.getByLabelText('Foto (URL)')).toHaveValue('https://exemplo.com/salao.jpg');

    // Disponibilidade.
    expect(form.getByLabelText('Abre as')).toHaveValue('10:00');
    expect(form.getByLabelText('Fecha as')).toHaveValue('23:00');
    expect(form.getByLabelText('Todos os dias')).not.toBeChecked();
    expect(form.getByLabelText('Sexta-feira')).toBeChecked();
    expect(form.getByLabelText('Sábado')).toBeChecked();
    expect(form.getByLabelText('Segunda-feira')).not.toBeChecked();

    // Regras de reserva.
    expect(form.getByLabelText('Duração mínima (h)')).toHaveValue('3');
    expect(form.getByLabelText('Duração máxima (h)')).toHaveValue('8');
    expect(form.getByLabelText('Antecedência (dias)')).toHaveValue('90');
    expect(form.getByLabelText('Intervalo mínimo (dias)')).toHaveValue('15');
    expect(form.getByLabelText('Exige aprovação do síndico')).not.toBeChecked();
    expect(form.getByLabelText('Regras de uso')).toHaveValue('Devolver limpo.');

    // Custo.
    expect((form.getByLabelText('Taxa de reserva') as HTMLInputElement).value).toMatch(
      /R\$\s*320,00/,
    );
  });

  it('editar avisa que os parametros governam o formulário de reservas', async () => {
    serve([makeCommonArea()]);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Salao de Festas');
    clickTrigger(screen.getByRole('button', { name: 'Editar Salao de Festas' }));
    await screen.findByRole('dialog');

    expect(
      screen.getByText(/valem imediatamente para o formulário de\s+Reservas/),
    ).toBeInTheDocument();
  });

  it('a edição envia o parcial e a lista reflete a mudança', async () => {
    serve([makeCommonArea()]);
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.areas = [makeCommonArea({ name: 'Salao Nobre' })];
      return world.areas[0] as never;
    });
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Salao de Festas');
    clickTrigger(screen.getByRole('button', { name: 'Editar Salao de Festas' }));
    await screen.findByRole('dialog');

    await user.clear(screen.getByLabelText('Nome'));
    await user.type(screen.getByLabelText('Nome'), 'Salao Nobre');
    clickTrigger(screen.getByRole('button', { name: 'Salvar área' }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/common-areas/area-1',
        expect.objectContaining({ name: 'Salao Nobre' }),
      ),
    );
    expect(await screen.findByText('Salao Nobre')).toBeInTheDocument();
  });
});

describe('Exclusao e restauração de áreas comuns', () => {
  it('a exclusao pede confirmação antes de chamar o servidor', async () => {
    serve([makeCommonArea()]);
    mockDelete.mockImplementation(async () => {
      world.areas = [];
    });
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Salao de Festas');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Salao de Festas' }));

    // O dialogo esta aberto e nada foi enviado ainda.
    expect(await screen.findByText('Excluir área comum?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/common-areas/area-1'));
    await waitFor(() => expect(screen.queryByText('Salao de Festas')).not.toBeInTheDocument());
  });

  it('409 de reservas futuras mostra a mensagem do servidor e mantem a área', async () => {
    serve([makeCommonArea()]);
    mockDelete.mockRejectedValue(
      new ApiError(
        'Existem reservas futuras para esta área. Cancele-as antes de remover.',
        409,
        'BUSINESS_RULE_ERROR',
      ),
    );
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Salao de Festas');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Salao de Festas' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'Existem reservas futuras para esta área. Cancele-as antes de remover.',
      ),
    );
    // A recusa nao remove nada: a area continua listada.
    expect(screen.getByText('Salao de Festas')).toBeInTheDocument();
  });

  it('o filtro de removidos envia includeDeleted e restaurar devolve o registro', async () => {
    serve([makeCommonArea({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.areas = [makeCommonArea({ deletedAt: null })];
      return world.areas[0] as never;
    });
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Salao de Festas');
    await user.click(screen.getByLabelText('Incluir removidos'));

    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));
    expect(await screen.findByText('Removido')).toBeInTheDocument();

    clickTrigger(await screen.findByRole('button', { name: 'Restaurar Salao de Festas' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/common-areas/area-1/restore'));
    await waitFor(() => expect(screen.queryByText('Removido')).not.toBeInTheDocument());
  });
});

describe('Permissões', () => {
  it('um operador ve a listagem sem cadastrar, editar ou excluir', async () => {
    serve([makeCommonArea()]);
    renderWithProviders(<CommonAreasPage />, { role: 'STAFF' });

    await screen.findByText('Salao de Festas');

    expect(screen.queryByRole('button', { name: 'Nova área comum' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
  });

  it('um operador não ve restaurar nas linhas removidas', async () => {
    serve([makeCommonArea({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    renderWithProviders(<CommonAreasPage />, { role: 'STAFF' });

    await screen.findByText('Salao de Festas');
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });

  it('a lista vazia não oferece cadastrar a quem não pode criar', async () => {
    serve([]);
    renderWithProviders(<CommonAreasPage />, { role: 'STAFF' });

    expect(await screen.findByText('Nenhuma área comum cadastrada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cadastrar área comum' })).not.toBeInTheDocument();
  });
});
