import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Assembly } from '@/types/assembly';
import { AssembliesPage } from './assemblies-page';
import {
  allReadRequests,
  lastListParams,
  lastPollParams,
  makeAssembly,
  makePoll,
  makePollResults,
  serveAssemblies,
  type AssemblyWorld,
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

let world: AssemblyWorld;

const TITLE = 'AGO 2026';

/** Permissoes de quem le assembleias e deliberacoes, e nao conduz nenhuma. */
const READ_ONLY = ['assembly:read', 'poll:read'];

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
 * Espera as linhas chegarem.
 *
 * A tabela existe desde o primeiro quadro, com uma linha de "Carregando..." no
 * lugar dos dados; quem prova que a resposta chegou e o titulo da assembleia.
 */
async function findRows(title: string = TITLE): Promise<HTMLElement> {
  return screen.findByText(title);
}

/** O dialogo mais recente — o painel de deliberacoes abre formularios sobre si. */
function topDialog(): HTMLElement {
  const dialogs = screen.getAllByRole('dialog');
  return dialogs[dialogs.length - 1];
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de assembleias', () => {
  it('percorre busca e os tres filtros preservando o condominio', async () => {
    world = serveAssemblies({ assemblies: [makeAssembly()] });
    const user = createUser();
    renderWithProviders(<AssembliesPage />);

    await findRows();
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'ago');
    await waitFor(() => expect(lastListParams().search).toBe('ago'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta.
    selectOption(screen.getByLabelText('Situacao'), 'Agendada');
    expect(lastListParams().status).toBe('SCHEDULED');

    selectOption(screen.getByLabelText('Tipo'), 'Ordinaria');
    expect(lastListParams().type).toBe('ORDINARY');

    selectOption(screen.getByLabelText('Formato'), 'Hibrida');
    expect(lastListParams().mode).toBe('HYBRID');

    expect(lastListParams()).toMatchObject({
      search: 'ago',
      status: 'SCHEDULED',
      type: 'ORDINARY',
      mode: 'HYBRID',
      condominiumId: 'cond-1',
    });
  });

  it('sem condominio selecionado explica a exigencia e nao consulta nada', async () => {
    world = serveAssemblies({ assemblies: [makeAssembly()] });
    renderWithProviders(<AssembliesPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condominio')).toBeInTheDocument();
    expect(mockGetPaginated).not.toHaveBeenCalled();
  });

  it('o destaque do que esta por vir vem da rota propria, e nao da listagem', async () => {
    world = serveAssemblies({
      assemblies: [makeAssembly()],
      upcoming: [makeAssembly({ id: 'assembly-2', title: 'AGE de obras' })],
    });
    renderWithProviders(<AssembliesPage />);

    await findRows();

    // A regiao e nomeada porque o vocabulario dela repete o da lista: sem o
    // escopo, a consulta por texto seria ambigua.
    const region = screen.getByRole('region', { name: 'Proximas assembleias' });
    expect(await within(region).findByText('AGE de obras')).toBeInTheDocument();

    const upcomingCalls = allReadRequests().filter(
      (request) => request.url === '/assemblies/upcoming',
    );
    expect(upcomingCalls).toHaveLength(1);
    expect(upcomingCalls[0].params).toMatchObject({ condominiumId: 'cond-1' });
  });

  it('lista vazia renderiza estado vazio, e nao tabela em branco', async () => {
    world = serveAssemblies({ assemblies: [] });
    renderWithProviders(<AssembliesPage />);

    expect(await screen.findByText('Nenhuma assembleia registrada')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('paginacao pede a proxima pagina com os parametros certos', async () => {
    const roster = (count: number, offset = 0): Assembly[] =>
      Array.from({ length: count }, (_, index) => {
        const position = offset + index + 1;
        return makeAssembly({
          id: `assembly-${position}`,
          title: `Convocacao ${String(position).padStart(2, '0')}`,
        });
      });

    world = serveAssemblies({ assemblies: roster(20), total: 300 });
    const user = createUser();
    renderWithProviders(<AssembliesPage />);

    await screen.findByText('Convocacao 01');
    expect(dataRows()).toHaveLength(20);

    world.assemblies = roster(20, 20);
    await user.click(screen.getByRole('button', { name: /proxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Convocacao 21')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });
});

describe('Ciclo da assembleia', () => {
  it('iniciar chama a rota propria e a lista acompanha', async () => {
    world = serveAssemblies({ assemblies: [makeAssembly()] });
    mockPost.mockImplementation(async () => {
      world.assemblies = [makeAssembly({ status: 'IN_PROGRESS' })];
      return world.assemblies[0] as never;
    });
    renderWithProviders(<AssembliesPage />);

    await findRows();
    expect(cellsOf('Situacao')[0]).toBe('Agendada');

    clickTrigger(screen.getByRole('button', { name: `Iniciar ${TITLE}` }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/assemblies/assembly-1/start', {}));
    await waitFor(() => expect(cellsOf('Situacao')[0]).toBe('Em andamento'));
  });

  it('as tres acoes de ciclo sao oferecidas por permissao, e nao por situacao', async () => {
    // Uma assembleia ja encerrada continua mostrando as tres: quem decide se a
    // transicao vale e o servidor, e duplicar a regra aqui criaria uma segunda
    // versao dela que dessincroniza na primeira mudanca do backend.
    world = serveAssemblies({ assemblies: [makeAssembly({ status: 'FINISHED' })] });
    renderWithProviders(<AssembliesPage />);

    await findRows();
    expect(screen.getByRole('button', { name: `Iniciar ${TITLE}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Encerrar ${TITLE}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Cancelar ${TITLE}` })).toBeInTheDocument();
  });

  it('a recusa do servidor aparece na linha, sem duplicar em toast', async () => {
    world = serveAssemblies({ assemblies: [makeAssembly({ status: 'FINISHED' })] });
    mockPost.mockRejectedValue(
      new ApiError('Somente assembleias agendadas podem ser iniciadas.', 409, 'BUSINESS_RULE'),
    );
    renderWithProviders(<AssembliesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Iniciar ${TITLE}` }));

    const message = await screen.findByText('Somente assembleias agendadas podem ser iniciadas.');
    expect(message).toHaveAttribute('role', 'alert');
    // O registro continua como estava: a recusa nao pode parecer sucesso.
    expect(cellsOf('Situacao')[0]).toBe('Encerrada');
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('dois cliques em iniciar disparam uma requisicao so', async () => {
    world = serveAssemblies({ assemblies: [makeAssembly()] });
    mockPost.mockImplementation(async () => {
      world.assemblies = [makeAssembly({ status: 'IN_PROGRESS' })];
      return world.assemblies[0] as never;
    });
    renderWithProviders(<AssembliesPage />);

    await findRows();
    const button = screen.getByRole('button', { name: `Iniciar ${TITLE}` });
    clickTrigger(button);
    clickTrigger(button);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('encerrar abre dialogo porque exige corpo, e envia o comparecimento', async () => {
    world = serveAssemblies({ assemblies: [makeAssembly({ status: 'IN_PROGRESS' })] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.assemblies = [makeAssembly({ status: 'FINISHED', attendeesCount: 31 })];
      return world.assemblies[0] as never;
    });
    renderWithProviders(<AssembliesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Encerrar ${TITLE}` }));

    const dialog = await screen.findByRole('dialog');
    // Iniciar e cancelar aceitam corpo vazio e sao clique unico; encerrar nao.
    expect(mockPost).not.toHaveBeenCalled();

    const attendees = within(dialog).getByLabelText('Unidades presentes');
    await user.clear(attendees);
    await user.type(attendees, '31');
    await user.type(within(dialog).getByLabelText('Ata'), 'https://exemplo.com/ata-ago-2026.pdf');
    await user.click(within(dialog).getByRole('button', { name: 'Encerrar' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/assemblies/assembly-1/finish', {
        attendeesCount: 31,
        minutesUrl: 'https://exemplo.com/ata-ago-2026.pdf',
      }),
    );
  });
});

describe('Cadastro de assembleia', () => {
  it('envia datas em ISO e o quorum como numero', async () => {
    world = serveAssemblies({ assemblies: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.assemblies = [makeAssembly({ title: 'AGE de fachada' })];
      return world.assemblies[0] as never;
    });
    renderWithProviders(<AssembliesPage />);

    await screen.findByText('Nenhuma assembleia registrada');
    clickTrigger(screen.getByRole('button', { name: 'Nova assembleia' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Titulo'), 'AGE de fachada');
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/assemblies');
    expect(body).toMatchObject({
      condominiumId: 'cond-1',
      title: 'AGE de fachada',
      type: 'ORDINARY',
      mode: 'HYBRID',
      quorumPercent: 50,
      // Campos opcionais vazios viajam como nulo, e nao como string vazia.
      secondCallAt: null,
      location: null,
      onlineUrl: null,
    });
    // A data sai em ISO, e nao no formato local do input nativo.
    expect(String((body as { scheduledAt: string }).scheduledAt)).toMatch(/Z$/);
  });

  it('segunda convocacao anterior a primeira e barrada no campo, sem requisicao', async () => {
    world = serveAssemblies({ assemblies: [] });
    const user = createUser();
    renderWithProviders(<AssembliesPage />);

    await screen.findByText('Nenhuma assembleia registrada');
    clickTrigger(screen.getByRole('button', { name: 'Nova assembleia' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Titulo'), 'Convocacao torta');

    const first = within(dialog).getByLabelText('Primeira chamada');
    await user.clear(first);
    await user.type(first, '2026-05-10T19:00');

    const second = within(dialog).getByLabelText('Segunda chamada');
    await user.type(second, '2026-05-10T18:00');

    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    // A regra existe no servidor como 409 sem caminho de campo; dita no campo,
    // ela tem conserto obvio.
    expect(
      await screen.findByText('A segunda convocacao deve ser posterior ao horario da primeira.'),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe('Deliberacoes', () => {
  it('o painel lista somente as deliberacoes da assembleia aberta', async () => {
    world = serveAssemblies({
      assemblies: [makeAssembly()],
      polls: [makePoll()],
    });
    renderWithProviders(<AssembliesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Deliberacoes de ${TITLE}` }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Aprovacao das contas de 2025')).toBeInTheDocument();
    // O recorte vem da whitelist do repositorio, que aceita `assemblyId`.
    expect(lastPollParams()).toMatchObject({
      assemblyId: 'assembly-1',
      condominiumId: 'cond-1',
    });
  });

  it('criar deliberacao envia as alternativas', async () => {
    world = serveAssemblies({ assemblies: [makeAssembly()], polls: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => makePoll() as never);
    renderWithProviders(<AssembliesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Deliberacoes de ${TITLE}` }));

    await screen.findByRole('dialog');
    clickTrigger(screen.getByRole('button', { name: 'Nova deliberacao' }));

    // O formulario abre sobre o painel: as consultas seguem o dialogo do topo.
    const form = await waitFor(() => {
      const top = topDialog();
      expect(within(top).getByLabelText('Pergunta')).toBeInTheDocument();
      return top;
    });

    await user.type(within(form).getByLabelText('Pergunta'), 'Aprovar a reforma?');
    await user.type(within(form).getByLabelText('Alternativa 1'), 'Aprovo');
    await user.type(within(form).getByLabelText('Alternativa 2'), 'Rejeito');

    // Depois da abertura, que ja vem preenchida com o horario atual: o schema
    // recusa um encerramento anterior a ela, como o servidor tambem faz.
    const ends = within(form).getByLabelText('Encerra em');
    await user.type(ends, '2030-06-01T20:00');

    await user.click(within(form).getByRole('button', { name: 'Criar deliberacao' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/polls');
    expect(body).toMatchObject({
      condominiumId: 'cond-1',
      assemblyId: 'assembly-1',
      title: 'Aprovar a reforma?',
      options: [{ label: 'Aprovo' }, { label: 'Rejeito' }],
    });
  });

  it('a apuracao vem da rota de resultados, e nao dos contadores da votacao', async () => {
    world = serveAssemblies({
      assemblies: [makeAssembly()],
      polls: [makePoll({ status: 'CLOSED' })],
      results: makePollResults(),
    });
    renderWithProviders(<AssembliesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Deliberacoes de ${TITLE}` }));

    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Aprovacao das contas de 2025');

    clickTrigger(
      within(dialog).getByRole('button', { name: 'Ver apuracao de Aprovacao das contas de 2025' }),
    );

    expect(await within(dialog).findByText('30 de 48 unidades')).toBeInTheDocument();
    // O texto diz se o quorum foi atingido: a cor sozinha nao diria.
    expect(within(dialog).getByText(/quorum atingido/)).toBeInTheDocument();
    expect(allReadRequests().some((request) => request.url === '/polls/poll-1/results')).toBe(true);
  });

  it('apurar chama a rota de encerramento da votacao', async () => {
    world = serveAssemblies({
      assemblies: [makeAssembly()],
      polls: [makePoll({ status: 'OPEN' })],
    });
    mockPost.mockImplementation(async () => makePollResults() as never);
    renderWithProviders(<AssembliesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Deliberacoes de ${TITLE}` }));

    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Aprovacao das contas de 2025');

    clickTrigger(
      within(dialog).getByRole('button', { name: 'Apurar Aprovacao das contas de 2025' }),
    );

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/polls/poll-1/close', {}));
  });

  it('editar uma deliberacao nao envia as alternativas', async () => {
    world = serveAssemblies({ assemblies: [makeAssembly()], polls: [makePoll()] });
    const user = createUser();
    mockPatch.mockImplementation(async () => makePoll({ title: 'Pergunta corrigida' }) as never);
    renderWithProviders(<AssembliesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Deliberacoes de ${TITLE}` }));

    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Aprovacao das contas de 2025');
    clickTrigger(
      within(dialog).getByRole('button', { name: 'Editar Aprovacao das contas de 2025' }),
    );

    const form = await waitFor(() => {
      const top = topDialog();
      expect(within(top).getByLabelText('Pergunta')).toBeInTheDocument();
      return top;
    });

    // O servidor omite `options` no PATCH de proposito: mudar as alternativas de
    // uma votacao que ja recebeu votos invalidaria a apuracao.
    expect(within(form).queryByLabelText('Alternativa 1')).not.toBeInTheDocument();
    expect(within(form).getByText(/alternativas nao podem ser alteradas/i)).toBeInTheDocument();

    const question = within(form).getByLabelText('Pergunta');
    await user.clear(question);
    await user.type(question, 'Pergunta corrigida');
    await user.click(within(form).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    const [url, body] = mockPatch.mock.calls[0];
    expect(url).toBe('/polls/poll-1');
    expect(body).toMatchObject({ title: 'Pergunta corrigida' });
    expect(body).not.toHaveProperty('options');
  });
});

describe('Exclusao, restauracao e permissoes', () => {
  it('excluir pede confirmacao antes de remover', async () => {
    world = serveAssemblies({ assemblies: [makeAssembly()] });
    mockDelete.mockImplementation(async () => {
      world.assemblies = [];
    });
    renderWithProviders(<AssembliesPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Excluir ${TITLE}` }));

    expect(mockDelete).not.toHaveBeenCalled();
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/assemblies/assembly-1'));
  });

  it('assembleia removida aparece marcada e so oferece restaurar', async () => {
    world = serveAssemblies({
      assemblies: [makeAssembly({ deletedAt: '2026-03-20T10:00:00.000Z' })],
    });
    renderWithProviders(<AssembliesPage />);

    await findRows();

    // A tarja nomeia o estado: cor sozinha nao distingue removida de ativa.
    expect(screen.getByText('Removida')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Restaurar ${TITLE}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Iniciar ${TITLE}` })).not.toBeInTheDocument();
  });

  it('papel sem escrita nao alcanca nenhuma acao de ciclo', async () => {
    world = serveAssemblies({ assemblies: [makeAssembly()], polls: [makePoll()] });
    renderWithProviders(<AssembliesPage />, { permissions: READ_ONLY });

    await findRows();

    expect(screen.queryByRole('button', { name: 'Nova assembleia' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Iniciar ${TITLE}` })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Encerrar ${TITLE}` })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Excluir ${TITLE}` })).not.toBeInTheDocument();
    // Ler as deliberacoes continua: `poll:read` esta no papel.
    expect(screen.getByRole('button', { name: `Deliberacoes de ${TITLE}` })).toBeInTheDocument();
  });

  it('sem poll:read, o painel de deliberacoes nao e oferecido', async () => {
    world = serveAssemblies({ assemblies: [makeAssembly()] });
    renderWithProviders(<AssembliesPage />, { permissions: ['assembly:manage'] });

    await findRows();

    expect(
      screen.queryByRole('button', { name: `Deliberacoes de ${TITLE}` }),
    ).not.toBeInTheDocument();
    // As acoes de assembleia seguem disponiveis: `assembly:manage` as cobre.
    expect(screen.getByRole('button', { name: `Iniciar ${TITLE}` })).toBeInTheDocument();
  });
});
