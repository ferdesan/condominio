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
      name: `Area ${String(position).padStart(3, '0')}`,
    });
  });
}

/** Abre o dialogo de cadastro e espera o formulario montar. */
async function openCreateForm(): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: 'Nova area comum' }));
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

describe('Listagem de areas comuns', () => {
  it('busca, filtros, paginacao e ordenacao chegam ao servidor como ele os aceita', async () => {
    serve(makeRoster(20));
    world.total = 60;
    const user = createUser();
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Area 001');
    // Toda consulta nasce presa ao condominio escolhido no shell.
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'Salao');
    await waitFor(() => expect(lastListParams().search).toBe('Salao'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta.
    selectOption(screen.getByLabelText('Status'), 'Em manutencao');
    expect(lastListParams().status).toBe('MAINTENANCE');

    selectOption(screen.getByLabelText('Aprovacao'), 'Exige aprovacao');
    expect(lastListParams().requiresApproval).toBe('true');

    // A ordenacao viaja em caixa alta; a tabela fala em caixa baixa e a
    // traducao mora na camada de dados (ADR-008/ADR-009).
    clickTrigger(screen.getByRole('button', { name: /^Nome/ }));
    expect(lastListParams().sortBy).toBe('name');
    expect(lastListParams().sortOrder).toBe('ASC');

    world.areas = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /proxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Area 021')).toBeInTheDocument();
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
    expect(await screen.findByText('Nenhuma area comum cadastrada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar area comum' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Buscar'), 'piscina');

    // Com um termo aplicado: o convite e desfazer a busca. Os dois estados sao
    // distinguiveis, e nao a mesma tela vazia.
    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cadastrar area comum' }),
    ).not.toBeInTheDocument();
  });

  it('sem condominio selecionado explica a exigencia e nao consulta', async () => {
    serve([makeCommonArea()]);
    renderWithProviders(<CommonAreasPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condominio')).toBeInTheDocument();
    expect(mockGetPaginated.mock.calls.filter(([url]) => url === '/common-areas')).toHaveLength(0);
  });

  it('celula nula rende o placeholder, nunca a string "null"', async () => {
    serve([makeCommonArea({ description: null })]);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Salao de Festas');

    expect(cellsOf('Descricao')).toEqual(['—']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('capacidade zero e dias nulos sao lidos como ausencia de limite, nao como vazio', async () => {
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

describe('Cadastro de area comum', () => {
  it('envia os campos e a lista se atualiza sem refetch manual', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.areas = [makeCommonArea({ id: 'area-9', name: 'Churrasqueira' })];
      return world.areas[0] as never;
    });
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma area comum cadastrada');
    clickTrigger(screen.getByRole('button', { name: 'Cadastrar area comum' }));
    await screen.findByRole('dialog');

    await user.type(screen.getByLabelText('Nome'), 'Churrasqueira');
    clickTrigger(screen.getByRole('button', { name: 'Criar area' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/common-areas', expect.anything()));
    // A invalidacao da fabrica traz a lista nova: nenhuma tela pede refetch.
    expect(await screen.findByText('Churrasqueira')).toBeInTheDocument();
  });

  it('o corpo carrega o condominio do shell e os padroes do servidor', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockResolvedValue(makeCommonArea() as never);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma area comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Quadra');
    clickTrigger(screen.getByRole('button', { name: 'Criar area' }));

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
        { field: 'name', message: 'Ja existe uma area com este nome.' },
      ]),
    );
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma area comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Salao de Festas');
    clickTrigger(screen.getByRole('button', { name: 'Criar area' }));

    expect(await screen.findByText('Ja existe uma area com este nome.')).toBeInTheDocument();
    // O formulario apresenta a falha por si; o toast global duplicaria.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('409 sem campo vira mensagem do formulario e preserva o preenchido', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Ja existe uma area comum com este nome neste condominio.', 409, 'CONFLICT'),
    );
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma area comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Salao de Festas');
    await user.type(screen.getByLabelText('Capacidade'), '0');
    clickTrigger(screen.getByRole('button', { name: 'Criar area' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ja existe uma area comum com este nome neste condominio.');
    // O dialogo continua aberto com o que foi digitado: reescrever tudo seria
    // a punicao errada para um conflito de nome.
    expect(screen.getByLabelText('Nome')).toHaveValue('Salao de Festas');
  });

  it('dois cliques em salvar produzem uma unica requisicao', async () => {
    serve([]);
    const user = createUser();
    // A requisicao demora o bastante para que o segundo clique caia enquanto a
    // primeira ainda esta no ar, e se resolve sozinha antes do fim do caso.
    mockPost.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(makeCommonArea()), 50)) as never,
    );
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma area comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Coworking');
    const submit = screen.getByRole('button', { name: 'Criar area' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });
});

describe('Validacoes cruzadas de area comum', () => {
  it('fechamento anterior a abertura e recusado no campo do fechamento', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma area comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Piscina');
    fireEvent.change(screen.getByLabelText('Abre as'), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText('Fecha as'), { target: { value: '09:00' } });
    clickTrigger(screen.getByRole('button', { name: 'Criar area' }));

    const field = screen.getByLabelText('Fecha as');
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    expect(
      screen.getByText('O horario de fechamento deve ser posterior ao de abertura.'),
    ).toBeInTheDocument();
    // A objecao e local: nada foi enviado.
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('duracao maxima menor que a minima e recusada no campo da maxima', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma area comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Piscina');
    fireEvent.change(screen.getByLabelText('Duracao minima (h)'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Duracao maxima (h)'), { target: { value: '2' } });
    clickTrigger(screen.getByRole('button', { name: 'Criar area' }));

    const field = screen.getByLabelText('Duracao maxima (h)');
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    expect(
      screen.getByText('A duracao maxima deve ser maior ou igual a minima.'),
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

    await screen.findByText('Nenhuma area comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Quadra');
    // Sair de "todos os dias" revela as caixas por dia.
    await user.click(screen.getByLabelText('Todos os dias'));
    await user.click(screen.getByLabelText('Sabado'));
    await user.click(screen.getByLabelText('Domingo'));
    clickTrigger(screen.getByRole('button', { name: 'Criar area' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    // Inteiros e ordenados, com domingo em zero — como o servidor numera.
    expect(lastCreateBody().availableWeekdays).toEqual([0, 6]);
  });

  it('"todos os dias" e "nenhum dia" produzem valores distintos', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockResolvedValue(makeCommonArea() as never);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma area comum cadastrada');

    // Primeiro envio: "todos os dias" marcado, que e o padrao.
    await openCreateForm();
    await user.type(screen.getByLabelText('Nome'), 'Quadra');
    clickTrigger(screen.getByRole('button', { name: 'Criar area' }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody().availableWeekdays).toBeNull();

    // Segundo envio: restricao ativa e nenhum dia marcado.
    await openCreateForm();
    await user.type(screen.getByLabelText('Nome'), 'Quadra coberta');
    await user.click(screen.getByLabelText('Todos os dias'));
    clickTrigger(screen.getByRole('button', { name: 'Criar area' }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));

    // Nulo libera a semana inteira; a lista vazia e uma restricao explicita. Os
    // dois estados chegam diferentes ao servidor.
    expect(lastCreateBody().availableWeekdays).toEqual([]);
  });

  it('nenhum dia liberado e anunciado antes do envio', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma area comum cadastrada');
    await openCreateForm();

    await user.click(screen.getByLabelText('Todos os dias'));

    expect(
      screen.getByText(/Nenhum dia liberado: a area nao aceitara reservas/),
    ).toBeInTheDocument();
  });
});

describe('Taxa de reserva', () => {
  it('e exibida como dinheiro no formulario e enviada como numero', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockResolvedValue(makeCommonArea() as never);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Nenhuma area comum cadastrada');
    await openCreateForm();

    await user.type(screen.getByLabelText('Nome'), 'Salao');
    const fee = screen.getByLabelText('Taxa de reserva') as HTMLInputElement;
    fireEvent.change(fee, { target: { value: '250' } });

    // O campo reformata para moeda assim que o valor chega ao formulario.
    await waitFor(() => expect(fee.value).toMatch(/R\$\s*250,00/));

    clickTrigger(screen.getByRole('button', { name: 'Criar area' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    // O corpo leva numero, e nao o texto formatado.
    expect(lastCreateBody().reservationFee).toBe(250);
  });
});

describe('Edicao de area comum', () => {
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
    expect(form.getByLabelText('Descricao')).toHaveValue('Salao com cozinha equipada.');
    expect(form.getByLabelText('Status')).toHaveTextContent('Em manutencao');
    expect(form.getByLabelText('Capacidade')).toHaveValue('80');
    expect(form.getByLabelText('Foto (URL)')).toHaveValue('https://exemplo.com/salao.jpg');

    // Disponibilidade.
    expect(form.getByLabelText('Abre as')).toHaveValue('10:00');
    expect(form.getByLabelText('Fecha as')).toHaveValue('23:00');
    expect(form.getByLabelText('Todos os dias')).not.toBeChecked();
    expect(form.getByLabelText('Sexta-feira')).toBeChecked();
    expect(form.getByLabelText('Sabado')).toBeChecked();
    expect(form.getByLabelText('Segunda-feira')).not.toBeChecked();

    // Regras de reserva.
    expect(form.getByLabelText('Duracao minima (h)')).toHaveValue('3');
    expect(form.getByLabelText('Duracao maxima (h)')).toHaveValue('8');
    expect(form.getByLabelText('Antecedencia (dias)')).toHaveValue('90');
    expect(form.getByLabelText('Intervalo minimo (dias)')).toHaveValue('15');
    expect(form.getByLabelText('Exige aprovacao do sindico')).not.toBeChecked();
    expect(form.getByLabelText('Regras de uso')).toHaveValue('Devolver limpo.');

    // Custo.
    expect((form.getByLabelText('Taxa de reserva') as HTMLInputElement).value).toMatch(
      /R\$\s*320,00/,
    );
  });

  it('editar avisa que os parametros governam o formulario de reservas', async () => {
    serve([makeCommonArea()]);
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Salao de Festas');
    clickTrigger(screen.getByRole('button', { name: 'Editar Salao de Festas' }));
    await screen.findByRole('dialog');

    expect(
      screen.getByText(/valem imediatamente para o formulario de\s+Reservas/),
    ).toBeInTheDocument();
  });

  it('a edicao envia o parcial e a lista reflete a mudanca', async () => {
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
    clickTrigger(screen.getByRole('button', { name: 'Salvar area' }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/common-areas/area-1',
        expect.objectContaining({ name: 'Salao Nobre' }),
      ),
    );
    expect(await screen.findByText('Salao Nobre')).toBeInTheDocument();
  });
});

describe('Exclusao e restauracao de areas comuns', () => {
  it('a exclusao pede confirmacao antes de chamar o servidor', async () => {
    serve([makeCommonArea()]);
    mockDelete.mockImplementation(async () => {
      world.areas = [];
    });
    renderWithProviders(<CommonAreasPage />);

    await screen.findByText('Salao de Festas');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Salao de Festas' }));

    // O dialogo esta aberto e nada foi enviado ainda.
    expect(await screen.findByText('Excluir area comum?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/common-areas/area-1'));
    await waitFor(() => expect(screen.queryByText('Salao de Festas')).not.toBeInTheDocument());
  });

  it('409 de reservas futuras mostra a mensagem do servidor e mantem a area', async () => {
    serve([makeCommonArea()]);
    mockDelete.mockRejectedValue(
      new ApiError(
        'Existem reservas futuras para esta area. Cancele-as antes de remover.',
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
        'Existem reservas futuras para esta area. Cancele-as antes de remover.',
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

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/common-areas/area-1/restore'),
    );
    await waitFor(() => expect(screen.queryByText('Removido')).not.toBeInTheDocument());
  });
});

describe('Permissoes', () => {
  it('um operador ve a listagem sem cadastrar, editar ou excluir', async () => {
    serve([makeCommonArea()]);
    renderWithProviders(<CommonAreasPage />, { role: 'STAFF' });

    await screen.findByText('Salao de Festas');

    expect(screen.queryByRole('button', { name: 'Nova area comum' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
  });

  it('um operador nao ve restaurar nas linhas removidas', async () => {
    serve([makeCommonArea({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    renderWithProviders(<CommonAreasPage />, { role: 'STAFF' });

    await screen.findByText('Salao de Festas');
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });

  it('a lista vazia nao oferece cadastrar a quem nao pode criar', async () => {
    serve([]);
    renderWithProviders(<CommonAreasPage />, { role: 'STAFF' });

    expect(await screen.findByText('Nenhuma area comum cadastrada')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cadastrar area comum' }),
    ).not.toBeInTheDocument();
  });
});
