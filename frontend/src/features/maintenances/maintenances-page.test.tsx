import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGet, apiGetPaginated, apiPost } from '@/lib/api';
import {
  clickTrigger,
  createUser,
  openSelect,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Maintenance } from '@/types/maintenance';
import { MaintenancesPage } from './maintenances-page';
import {
  lastListParams,
  makeMaintenance,
  serveMaintenances,
  upcomingRequests,
  type MaintenanceWorld,
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
const mockGet = vi.mocked(apiGet);
const mockPost = vi.mocked(apiPost);
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

let world: MaintenanceWorld;

const TITLE = 'Revisao do elevador social';

/** Ordens com titulos previsiveis, para conferir qual pagina chegou. */
function makeRoster(count: number, offset = 0): Maintenance[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeMaintenance({
      id: `maintenance-${position}`,
      title: `Ordem ${String(position).padStart(2, '0')}`,
    });
  });
}

/** A tabela, isolada do destaque do que esta por vir. */
function table(): HTMLElement {
  return screen.getByRole('table');
}

/** Linhas de dados, sem o cabecalho. */
function dataRows(): HTMLElement[] {
  return within(table()).getAllByRole('row').slice(1);
}

/** Indice da coluna pelo rotulo do cabecalho, para nao depender da ordem. */
function columnIndex(label: string): number {
  const headers = within(within(table()).getAllByRole('row')[0]).getAllByRole('columnheader');
  return headers.findIndex((header) => header.textContent?.trim().startsWith(label));
}

/** Conteudo de uma coluna em todas as linhas, na ordem em que aparecem. */
function cellsOf(label: string): string[] {
  const index = columnIndex(label);
  return dataRows().map((row) => within(row).getAllByRole('cell')[index].textContent?.trim() ?? '');
}

/** O painel de destaque, nomeado para nao se confundir com a tabela. */
function upcomingPanel(): HTMLElement {
  return screen.getByRole('region', { name: 'Proximas manutenções' });
}

/**
 * Espera as linhas chegarem.
 *
 * Nao serve esperar pela tabela: ela existe desde o primeiro quadro, com uma
 * linha de "Carregando..." no lugar dos dados. Quem prova que a resposta chegou
 * e o titulo da ordem — e nenhuma fixture o repete no destaque, entao a consulta
 * e inequivoca.
 */
async function findRows(title: string = TITLE): Promise<HTMLElement> {
  return screen.findByText(title);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de manutenções', () => {
  it('percorre busca e os cinco filtros preservando os parametros', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance()] });
    const user = createUser();
    renderWithProviders(<MaintenancesPage />);

    await findRows();
    // Toda consulta nasce presa ao condominio escolhido no shell.
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'elevador');
    await waitFor(() => expect(lastListParams().search).toBe('elevador'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta.
    selectOption(screen.getByLabelText('Status'), 'Agendada');
    expect(lastListParams().status).toBe('SCHEDULED');

    selectOption(screen.getByLabelText('Tipo'), 'Preventiva');
    expect(lastListParams().type).toBe('PREVENTIVE');

    selectOption(screen.getByLabelText('Recorrência'), 'Semestral');
    expect(lastListParams().recurrence).toBe('SEMIANNUAL');

    selectOption(screen.getByLabelText('Prestador'), 'Limpeza Total');
    expect(lastListParams().serviceProviderId).toBe('provider-1');

    selectOption(screen.getByLabelText('Responsável'), 'Joana Ribeiro');
    expect(lastListParams().responsibleId).toBe('user-2');

    // Os controles se somam em vez de se substituirem.
    expect(lastListParams()).toMatchObject({
      condominiumId: 'cond-1',
      search: 'elevador',
      status: 'SCHEDULED',
      type: 'PREVENTIVE',
      recurrence: 'SEMIANNUAL',
      serviceProviderId: 'provider-1',
      responsibleId: 'user-2',
    });
  });

  it('ordenar por uma coluna envia sortOrder em maiusculas', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance()] });
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    clickTrigger(screen.getByRole('button', { name: 'Título' }));
    await waitFor(() => expect(lastListParams().sortBy).toBe('title'));
    expect(lastListParams().sortOrder).toBe('ASC');

    // A tabela alterna a direcao; a traducao para a caixa da API e da camada de
    // dados, e e ela que precisa continuar valendo (ADR-009).
    clickTrigger(screen.getByRole('button', { name: 'Título' }));
    await waitFor(() => expect(lastListParams().sortOrder).toBe('DESC'));
    expect(lastListParams().sortBy).toBe('title');
  });

  it('trezentas ordens paginam no tamanho pedido', async () => {
    world = serveMaintenances({ maintenances: makeRoster(20), total: 300 });
    const user = createUser();
    renderWithProviders(<MaintenancesPage />);

    await screen.findByText('Ordem 01');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams().perPage).toBe(20);

    world.maintenances = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /próxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Ordem 21')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });

  it('campos ausentes viram placeholder, nunca a string "null"', async () => {
    world = serveMaintenances({
      maintenances: [
        makeMaintenance({ assetName: null, serviceProviderId: null, responsibleId: null }),
      ],
    });
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    // Cada ausencia e um estado nomeado, e nao um dado faltando: uma ordem sem
    // prestador e feita pela equipe propria, e nao "sem informacao".
    expect(cellsOf('Ativo')).toEqual(['Ativo não informado']);
    expect(cellsOf('Prestador')).toEqual(['Equipe própria']);
    expect(cellsOf('Responsável')).toEqual(['Sem responsável']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('nenhum controle e oferecido para filtro fora da whitelist do servidor', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance()] });
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    // Whitelist do servidor: condominiumId (vem do shell), status, type,
    // recurrence, serviceProviderId e responsibleId. Qualquer outro controle
    // pareceria funcionar enquanto o backend o descarta em silencio.
    for (const present of ['Status', 'Tipo', 'Recorrência', 'Prestador', 'Responsável']) {
      expect(screen.getByLabelText(present)).toBeInTheDocument();
    }
    for (const absent of ['Ativo', 'Agendamento', 'Título']) {
      expect(screen.queryByLabelText(absent)).not.toBeInTheDocument();
    }

    // `scheduledFor` e a ordem padrao do servidor, mas nao esta no conjunto
    // ordenavel dele — filtravel mais buscavel mais os dois timestamps —, entao
    // uma coluna que se oferecesse para ordenar seria descartada em silencio e a
    // lista voltaria igual.
    const header = within(within(table()).getAllByRole('row')[0])
      .getAllByRole('columnheader')
      .find((item) => item.textContent?.trim().startsWith('Agendamento'));
    expect(within(header as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Estados vazios de manutenções', () => {
  it('lista vazia oferece o cadastro', async () => {
    world = serveMaintenances({ maintenances: [] });
    renderWithProviders(<MaintenancesPage />);

    expect(await screen.findByText('Nenhuma manutenção registrada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agendar manutenção' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum resultado para esta busca')).not.toBeInTheDocument();
  });

  it('busca sem resultado oferece limpar, e e distinta da lista vazia', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance()] });
    const user = createUser();
    renderWithProviders(<MaintenancesPage />);

    await findRows();
    world.maintenances = [];
    await user.type(screen.getByLabelText('Buscar'), 'Nada');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    // Os dois vazios sao estados diferentes e dizem coisas diferentes.
    expect(screen.queryByText('Nenhuma manutenção registrada')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agendar manutenção' })).not.toBeInTheDocument();
  });
});

describe('Ciclo de vida da manutenção', () => {
  it('uma agendada oferece iniciar e cancelar, e não oferece concluir', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance({ status: 'SCHEDULED' })] });
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    expect(screen.getByRole('button', { name: `Iniciar ${TITLE}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Cancelar ${TITLE}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Concluir/ })).not.toBeInTheDocument();
    expect(cellsOf('Status')).toEqual(['Agendada']);
  });

  it('uma atrasada segue oferecendo iniciar, como o servidor aceita', async () => {
    // `OVERDUE` nao e um destino escolhido: o job diario move para ele o que
    // venceu. Para `start` e `cancel` o servico o trata igual a `SCHEDULED`.
    world = serveMaintenances({ maintenances: [makeMaintenance({ status: 'OVERDUE' })] });
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    expect(screen.getByRole('button', { name: `Iniciar ${TITLE}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Cancelar ${TITLE}` })).toBeInTheDocument();
    expect(cellsOf('Status')).toEqual(['Atrasada']);
  });

  it('uma iniciada oferece concluir e cancelar, e não oferece iniciar', async () => {
    world = serveMaintenances({
      maintenances: [
        makeMaintenance({ status: 'IN_PROGRESS', startedAt: '2026-04-02T09:10:00.000Z' }),
      ],
    });
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    expect(screen.getByRole('button', { name: `Concluir ${TITLE}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Cancelar ${TITLE}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Iniciar/ })).not.toBeInTheDocument();
    expect(cellsOf('Status')).toEqual(['Em execução']);
  });

  it('uma concluida não oferece nenhuma das três', async () => {
    world = serveMaintenances({
      maintenances: [
        makeMaintenance({ status: 'COMPLETED', completedAt: '2026-04-02T11:00:00.000Z' }),
      ],
    });
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    // O ciclo e fechado: o servidor recusa iniciar, concluir e cancelar a partir
    // de `COMPLETED`. Editar continua oferecido.
    expect(screen.queryByRole('button', { name: /^Iniciar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Concluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cancelar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Editar ${TITLE}` })).toBeInTheDocument();
    expect(cellsOf('Status')).toEqual(['Concluida']);
  });

  it('uma cancelada também não oferece nenhuma das três', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance({ status: 'CANCELED' })] });
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    // O servidor recusa iniciar e concluir a partir de `CANCELED`; cancelar de
    // novo nao teria efeito.
    expect(screen.queryByRole('button', { name: /^Iniciar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Concluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cancelar/ })).not.toBeInTheDocument();
    expect(cellsOf('Status')).toEqual(['Cancelada']);
  });

  it('iniciar muda o status na lista e passa a oferecer concluir', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance({ status: 'SCHEDULED' })] });
    mockPost.mockImplementation(async (url) => {
      if (url !== '/maintenances/maintenance-1/start') throw new Error(`URL inesperada: ${url}`);
      world.maintenances = [makeMaintenance({ status: 'IN_PROGRESS' })];
      return world.maintenances[0] as never;
    });
    renderWithProviders(<MaintenancesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Iniciar ${TITLE}` }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/maintenances/maintenance-1/start');

    // A invalidacao da acao traz a lista nova: o status acompanha, e agora e a
    // vez de concluir.
    await waitFor(() => expect(cellsOf('Status')).toEqual(['Em execução']));
    expect(screen.getByRole('button', { name: `Concluir ${TITLE}` })).toBeInTheDocument();
  });

  it('concluir manda corpo vazio, que e o que o schema do servidor exige', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance({ status: 'IN_PROGRESS' })] });
    mockPost.mockImplementation(async () => {
      world.maintenances = [makeMaintenance({ status: 'COMPLETED' })];
      // `complete` devolve `{ maintenance, nextId }`, e nao a ordem sozinha.
      return { maintenance: world.maintenances[0], nextId: null } as never;
    });
    renderWithProviders(<MaintenancesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Concluir ${TITLE}` }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/maintenances/maintenance-1/complete');
    // A rota valida o corpo: sem objeto o zod recusaria antes do servico, ainda
    // que todos os campos sejam opcionais.
    expect(mockPost.mock.calls[0][1]).toEqual({});
    await waitFor(() => expect(cellsOf('Status')).toEqual(['Concluida']));
  });

  it('cancelar muda o status na lista', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance({ status: 'SCHEDULED' })] });
    mockPost.mockImplementation(async () => {
      world.maintenances = [makeMaintenance({ status: 'CANCELED' })];
      return world.maintenances[0] as never;
    });
    renderWithProviders(<MaintenancesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Cancelar ${TITLE}` }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/maintenances/maintenance-1/cancel');
    await waitFor(() => expect(cellsOf('Status')).toEqual(['Cancelada']));
  });

  it('a recusa do servidor numa transição aparece na linha, e o status não muda', async () => {
    // A ordem foi concluida por outra pessoa enquanto esta lista estava aberta:
    // a tela ainda a mostra como agendada, e o servidor recusa.
    world = serveMaintenances({ maintenances: [makeMaintenance({ status: 'SCHEDULED' })] });
    mockPost.mockRejectedValue(
      new ApiError('Manutenção já concluida.', 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderWithProviders(<MaintenancesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Iniciar ${TITLE}` }));

    const message = await screen.findByText('Manutenção já concluida.');
    // A recusa aparece onde a acao foi tomada, e o registro continua como estava.
    expect(message).toHaveAttribute('role', 'alert');
    expect(cellsOf('Status')).toEqual(['Agendada']);
    // O `onError` proprio substitui o toast global: a mesma recusa nao pode
    // aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('dois cliques em iniciar disparam uma requisição so', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance({ status: 'SCHEDULED' })] });
    mockPost.mockImplementation(async () => {
      world.maintenances = [makeMaintenance({ status: 'IN_PROGRESS' })];
      return world.maintenances[0] as never;
    });
    renderWithProviders(<MaintenancesPage />);

    await findRows();
    const button = screen.getByRole('button', { name: `Iniciar ${TITLE}` });
    clickTrigger(button);
    clickTrigger(button);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });
});

describe('Proximas manutenções', () => {
  it('o destaque vem de /maintenances/upcoming, e nao das linhas carregadas', async () => {
    // A lista mostra uma ordem; o destaque mostra outra. Se a tela filtrasse as
    // linhas carregadas, a do destaque nao teria como aparecer — e a da lista
    // apareceria nos dois lugares.
    world = serveMaintenances({
      maintenances: [makeMaintenance({ id: 'maintenance-1', title: TITLE })],
      upcoming: [
        makeMaintenance({
          id: 'maintenance-9',
          title: 'Limpeza da caixa dagua',
          assetName: 'Reservatório superior',
          scheduledFor: '2026-04-05T08:00:00.000Z',
        }),
      ],
    });
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    const panel = upcomingPanel();
    expect(await within(panel).findByText('Limpeza da caixa dagua')).toBeInTheDocument();
    expect(within(panel).queryByText(TITLE)).not.toBeInTheDocument();

    // A consulta e propria e carrega o condominio do shell.
    await waitFor(() => expect(upcomingRequests().length).toBeGreaterThan(0));
    expect(upcomingRequests().at(-1)).toMatchObject({ condominiumId: 'cond-1' });
  });

  it('sem nada agendado adiante o destaque diz isso, em vez de sumir', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance()], upcoming: [] });
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    expect(
      await within(upcomingPanel()).findByText('Nada agendado adiante neste condomínio.'),
    ).toBeInTheDocument();
  });

  it('uma falha no destaque não leva a lista junto', async () => {
    world = serveMaintenances({
      maintenances: [makeMaintenance()],
      // Um 4xx nao e repetido pelo cliente; um 5xx seria tentado tres vezes
      // antes de virar estado de erro.
      upcomingError: new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR'),
    });
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    expect(await within(upcomingPanel()).findByRole('alert')).toBeInTheDocument();
    // A lista continua utilizavel, que e o ponto de separar as duas consultas.
    expect(cellsOf('Status')).toEqual(['Agendada']);
  });
});

describe('Exclusao e restauração de manutenções', () => {
  it('excluir pede confirmação antes de remover', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance()] });
    mockDelete.mockImplementation(async () => {
      world.maintenances = [];
    });
    renderWithProviders(<MaintenancesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Excluir ${TITLE}` }));

    // O pedido so sai depois da confirmacao.
    expect(await screen.findByText('Excluir manutenção?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/maintenances/maintenance-1'));
    await waitFor(() => expect(screen.queryByText(TITLE)).not.toBeInTheDocument());
  });

  it('um 409 de impedimento mostra a mensagem do servidor e mantem o registro', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance()] });
    mockDelete.mockRejectedValue(
      new ApiError('Manutenção em execução não pode ser excluida.', 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderWithProviders(<MaintenancesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Excluir ${TITLE}` }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    // A exclusao nao passa `onError`, entao herda o toast global — que e a
    // apresentacao certa para um 409 que traz so a mensagem do servidor.
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('Manutenção em execução não pode ser excluida.'),
    );
    expect(screen.getByText(TITLE)).toBeInTheDocument();
  });

  it('incluir removidos envia includeDeleted, e restaurar devolve o registro', async () => {
    world = serveMaintenances({
      maintenances: [makeMaintenance({ deletedAt: '2026-03-11T10:00:00.000Z' })],
    });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.maintenances = [makeMaintenance({ deletedAt: null })];
      return world.maintenances[0] as never;
    });
    renderWithProviders(<MaintenancesPage />);

    await findRows();
    await user.click(screen.getByLabelText('Incluir removidos'));

    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));
    expect(screen.getByText('Removido')).toBeInTheDocument();

    clickTrigger(await screen.findByRole('button', { name: `Restaurar ${TITLE}` }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/maintenances/maintenance-1/restore'),
    );
    await waitFor(() => expect(screen.queryByText('Removido')).not.toBeInTheDocument());
  });
});

describe('Escopo e permissões de manutenções', () => {
  it('sem condomínio selecionado a tela explica a exigência e não consulta', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance()] });
    renderWithProviders(<MaintenancesPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condomínio')).toBeInTheDocument();
    // Nem a listagem, nem as colecoes auxiliares, nem o destaque saem sem
    // condominio.
    expect(mockGetPaginated).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('a coleção de prestadores fica presa ao condomínio do shell', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance()] });
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    const call = mockGetPaginated.mock.calls.find(([url]) => url === '/service-providers');
    expect((call?.[1]?.params ?? {}) as Record<string, unknown>).toMatchObject({
      condominiumId: 'cond-1',
    });
  });

  it('a colecao de responsaveis nao envia condominiumId, porque /users e por tenant', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance()] });
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    // Mandar a chave nao escoparia nada — `UserRepository` nao a aceita — e o
    // seletor pareceria escopado sem estar. O recorte e do cliente.
    const call = mockGetPaginated.mock.calls.find(([url]) => url === '/users');
    expect(call?.[1]?.params).not.toHaveProperty('condominiumId');
  });

  it('um responsável de outro condomínio fica fora do seletor', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance()] });
    world.users = [
      ...world.users,
      {
        ...world.users[0],
        id: 'user-3',
        name: 'Paulo Nunes',
        condominiums: [{ id: 'cond-9', name: 'Residencial Boreal' }],
      },
      // Lista vazia significa "todos do tenant": um perfil administrativo entra.
      { ...world.users[0], id: 'user-4', name: 'Ana Duarte', condominiums: [] },
    ];
    renderWithProviders(<MaintenancesPage />);

    await findRows();

    openSelect(screen.getByLabelText('Responsável'));

    expect(await screen.findByRole('option', { name: 'Joana Ribeiro' })).toBeInTheDocument();
    // Lista vazia significa "todos do tenant": um perfil administrativo entra.
    expect(screen.getByRole('option', { name: 'Ana Duarte' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Paulo Nunes' })).not.toBeInTheDocument();
  });

  it('um operador sem update não recebe as ações do ciclo', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance({ status: 'SCHEDULED' })] });
    renderWithProviders(<MaintenancesPage />, {
      role: 'STAFF',
      permissions: ['maintenance:read'],
    });

    await findRows();

    // As tres transicoes exigem `maintenance:update`; a interface nao oferece o
    // que o servidor recusaria.
    expect(screen.queryByRole('button', { name: /^Iniciar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Concluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cancelar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova manutenção' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
  });

  it('um operador não ve restaurar nas linhas removidas', async () => {
    world = serveMaintenances({
      maintenances: [makeMaintenance({ deletedAt: '2026-03-11T10:00:00.000Z' })],
    });
    const user = createUser();
    renderWithProviders(<MaintenancesPage />, {
      role: 'STAFF',
      permissions: ['maintenance:read'],
    });

    await findRows();
    // Ver removidos e leitura; restaurar exige `update` (ADR-006).
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(await screen.findByText('Removido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });
});
