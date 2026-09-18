import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGet, apiGetPaginated, apiPost } from '@/lib/api';
import {
  chooseOption,
  clickTrigger,
  createUser,
  openCombobox,
  openSelect,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Incident } from '@/types/incident';
import { IncidentsPage } from './incidents-page';
import {
  lastListParams,
  makeAssignee,
  makeIncident,
  serveIncidents,
  summaryRequests,
  type IncidentWorld,
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

let world: IncidentWorld;

/** Ocorrencias com protocolos previsiveis, para conferir qual pagina chegou. */
function makeRoster(count: number, offset = 0): Incident[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeIncident({
      id: `incident-${position}`,
      protocol: `OC-2026-${String(position).padStart(6, '0')}`,
    });
  });
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

/** Celulas de uma coluna em todas as linhas, na ordem em que aparecem. */
function cellsIn(label: string): HTMLElement[] {
  const index = columnIndex(label);
  return dataRows().map((row) => within(row).getAllByRole('cell')[index]);
}

/** Conteudo de uma coluna em todas as linhas. */
function cellsOf(label: string): string[] {
  return cellsIn(label).map((cell) => cell.textContent?.trim() ?? '');
}

/** O bloco de indicadores, que e uma regiao nomeada e navegavel a parte. */
function indicators(): HTMLElement {
  return screen.getByRole('region', { name: /Indicadores de ocorrências/ });
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de ocorrências', () => {
  it('percorre busca e os quatro filtros preservando os parametros', async () => {
    world = serveIncidents({ incidents: [makeIncident()] });
    const user = createUser();
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    // Toda consulta nasce presa ao condominio escolhido no shell.
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'garagem');
    await waitFor(() => expect(lastListParams().search).toBe('garagem'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta.
    selectOption(screen.getByLabelText('Status'), 'Em atendimento');
    expect(lastListParams().status).toBe('IN_PROGRESS');

    selectOption(screen.getByLabelText('Categoria'), 'Manutenção');
    expect(lastListParams().category).toBe('MAINTENANCE');

    selectOption(screen.getByLabelText('Prioridade'), 'Crítica');
    expect(lastListParams().priority).toBe('CRITICAL');

    selectOption(screen.getByLabelText('Responsável'), 'Joana Ribeiro');
    expect(lastListParams().assignedToId).toBe('user-2');

    // Os controles se somam em vez de se substituirem.
    expect(lastListParams()).toMatchObject({
      condominiumId: 'cond-1',
      search: 'garagem',
      status: 'IN_PROGRESS',
      category: 'MAINTENANCE',
      priority: 'CRITICAL',
      assignedToId: 'user-2',
    });
  });

  it('ordenar por uma coluna envia sortOrder em maiusculas', async () => {
    world = serveIncidents({ incidents: [makeIncident()] });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');

    clickTrigger(screen.getByRole('button', { name: 'Protocolo' }));
    await waitFor(() => expect(lastListParams().sortBy).toBe('protocol'));
    expect(lastListParams().sortOrder).toBe('ASC');

    // A tabela alterna a direcao; a traducao para a caixa da API e da camada de
    // dados, e e ela que precisa continuar valendo (ADR-009).
    clickTrigger(screen.getByRole('button', { name: 'Protocolo' }));
    await waitFor(() => expect(lastListParams().sortOrder).toBe('DESC'));
    expect(lastListParams().sortBy).toBe('protocol');
  });

  it('trezentas ocorrências paginam no tamanho pedido', async () => {
    world = serveIncidents({ incidents: makeRoster(20), total: 300 });
    const user = createUser();
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('OC-2026-000001');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams().perPage).toBe(20);

    world.incidents = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /próxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('OC-2026-000021')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });

  it('campos ausentes viram placeholder, nunca a string "null"', async () => {
    world = serveIncidents({
      incidents: [
        makeIncident({
          location: null,
          assignedToId: null,
          reportedByName: null,
          isAnonymous: true,
        }),
      ],
    });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');

    expect(cellsOf('Local')).toEqual(['—']);
    // Sem responsavel e sem autor sao estados nomeados, e nao dados faltando.
    expect(cellsOf('Responsável')).toEqual(['Sem responsável']);
    expect(cellsOf('Relatado por')).toEqual(['Anonimo']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('nenhum controle e oferecido para filtro fora da whitelist do servidor', async () => {
    world = serveIncidents({ incidents: [makeIncident()] });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');

    // Dentro da whitelist do servidor: condominiumId (vem do shell), status,
    // category, priority e assignedToId. Qualquer controle fora dela pareceria
    // funcionar enquanto o backend o descarta em silencio.
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
    expect(screen.getByLabelText('Prioridade')).toBeInTheDocument();
    expect(screen.getByLabelText('Responsável')).toBeInTheDocument();

    for (const absent of ['Protocolo', 'Local', 'Relatado por', 'Aberta em']) {
      expect(screen.queryByLabelText(absent)).not.toBeInTheDocument();
    }
  });
});

describe('Prioridade das ocorrências', () => {
  it('a prioridade e distinguível sem depender de cor, e CRITICAL mais que as outras', async () => {
    world = serveIncidents({
      incidents: [
        makeIncident({ id: 'incident-1', protocol: 'OC-2026-000001', priority: 'LOW' }),
        makeIncident({ id: 'incident-2', protocol: 'OC-2026-000002', priority: 'MEDIUM' }),
        makeIncident({ id: 'incident-3', protocol: 'OC-2026-000003', priority: 'HIGH' }),
        makeIncident({ id: 'incident-4', protocol: 'OC-2026-000004', priority: 'CRITICAL' }),
      ],
    });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('OC-2026-000004');

    // Primeiro canal: o rotulo por extenso. So o texto ja separa as quatro, o
    // que continua valendo numa lista impressa em preto e branco.
    expect(cellsOf('Prioridade')).toEqual(['Baixa', 'Média', 'Alta', 'Crítica']);

    // Segundo canal: um icone de forma propria por prioridade. O da critica nao
    // pertence a serie de setas — nao e uma gradacao a mais.
    const icons = cellsIn('Prioridade').map(
      (cell) => cell.querySelector('svg')?.getAttribute('class') ?? '',
    );
    expect(new Set(icons).size).toBe(4);
    expect(icons[3]).toContain('lucide-octagon-alert');

    // Terceiro canal, so na critica: peso e caixa do texto.
    const critical = screen.getByLabelText('Prioridade crítica');
    expect(critical).toHaveClass('uppercase', 'font-bold');
    expect(screen.getByLabelText('Prioridade baixa')).not.toHaveClass('uppercase');

    // E o rotulo acessivel diz o mesmo por extenso, para quem nao ve a lista.
    for (const name of ['baixa', 'média', 'alta', 'crítica']) {
      expect(screen.getByLabelText(`Prioridade ${name}`)).toBeInTheDocument();
    }
  });
});

describe('Indicadores de ocorrências', () => {
  it('os numeros vem de /incidents/summary, e nao das linhas carregadas', async () => {
    world = serveIncidents({
      incidents: [makeIncident()],
      summary: [
        { status: 'OPEN', total: 7 },
        { status: 'IN_PROGRESS', total: 2 },
        { status: 'RESOLVED', total: 3 },
      ],
    });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');

    // O endpoint dedicado agrupa no banco; a lista traz uma pagina e um recorte
    // de filtros, entao conta-la responderia outra pergunta.
    await waitFor(() => expect(summaryRequests().length).toBeGreaterThan(0));
    expect(summaryRequests().at(-1)).toMatchObject({ condominiumId: 'cond-1' });

    const region = within(indicators());
    // Doze no condominio, contra a unica linha carregada.
    await waitFor(() => expect(region.getByText('12')).toBeInTheDocument());
    expect(region.getByText('Total de ocorrências')).toBeInTheDocument();

    // Um status ausente do resumo e zero, e nao um buraco: a fila vazia num
    // status e informacao.
    const items = region.getAllByRole('listitem').map((item) => item.textContent?.trim());
    expect(items).toEqual([
      'Aberta7',
      'Em analise0',
      'Em atendimento2',
      'Resolvida3',
      'Encerrada0',
      'Recusada0',
    ]);
  });

  it('uma falha nos indicadores não derruba a lista', async () => {
    world = serveIncidents({
      incidents: [makeIncident()],
      // O `/summary` valida a query e exige o condominio como uuid; um recorte
      // que ele recusa devolve 422 — e um 4xx nao e repetido pelo cliente.
      summaryError: new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR'),
    });
    renderWithProviders(<IncidentsPage />);

    // A consulta dos indicadores e separada da listagem de proposito: a lista
    // continua utilizavel com eles em erro.
    expect(
      await within(indicators()).findByText(/Não foi possível carregar os indicadores/),
    ).toBeInTheDocument();
    expect(screen.getByText('Vazamento na garagem')).toBeInTheDocument();
    expect(dataRows()).toHaveLength(1);
  });
});

describe('Estados vazios de ocorrências', () => {
  it('lista vazia oferece o cadastro', async () => {
    world = serveIncidents({ incidents: [] });
    renderWithProviders(<IncidentsPage />);

    expect(await screen.findByText('Nenhuma ocorrência registrada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar ocorrência' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum resultado para esta busca')).not.toBeInTheDocument();
  });

  it('busca sem resultado oferece limpar, e e distinta da lista vazia', async () => {
    world = serveIncidents({ incidents: [makeIncident()] });
    const user = createUser();
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    world.incidents = [];
    await user.type(screen.getByLabelText('Buscar'), 'Nada');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    // Os dois vazios sao estados diferentes e dizem coisas diferentes.
    expect(screen.queryByText('Nenhuma ocorrência registrada')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar ocorrência' })).not.toBeInTheDocument();
  });
});

describe('Mudança de status', () => {
  it('mudar status reflete na lista e no resumo', async () => {
    world = serveIncidents({
      incidents: [makeIncident({ status: 'OPEN' })],
      summary: [{ status: 'OPEN', total: 1 }],
    });
    mockPost.mockImplementation(async (url) => {
      if (url !== '/incidents/incident-1/status') throw new Error(`URL inesperada: ${url}`);
      world.incidents = [makeIncident({ status: 'IN_PROGRESS' })];
      world.summary = [{ status: 'IN_PROGRESS', total: 1 }];
      return world.incidents[0] as never;
    });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    expect(cellsOf('Status')).toEqual(['Aberta']);

    clickTrigger(screen.getByRole('button', { name: 'Mudar status de OC-2026-000001' }));

    // Resolver e recusar exigem a tratativa, entao a acao de linha pergunta
    // antes de postar.
    await screen.findByLabelText('Novo status');
    selectOption(within(dialog()).getByLabelText('Novo status'), 'Em atendimento');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Mudar status' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/incidents/incident-1/status');
    expect(mockPost.mock.calls[0][1]).toMatchObject({ status: 'IN_PROGRESS', resolution: null });

    // A invalidacao da acao alcanca listagem e resumo de uma vez.
    await waitFor(() => expect(cellsOf('Status')).toEqual(['Em atendimento']));
  });

  it('o status atual não e oferecido como destino', async () => {
    world = serveIncidents({ incidents: [makeIncident({ status: 'OPEN' })] });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    clickTrigger(screen.getByRole('button', { name: 'Mudar status de OC-2026-000001' }));

    await screen.findByLabelText('Novo status');
    openSelect(within(dialog()).getByLabelText('Novo status'));

    const options = screen.getAllByRole('option').map((option) => option.textContent?.trim());
    // Quais transicoes valem e do servidor (`STATUS_FLOW`); o unico destino que
    // a tela descarta e o proprio estado atual, que nao e uma mudanca.
    expect(options).not.toContain('Aberta');
    expect(options).toEqual(['Em analise', 'Em atendimento', 'Resolvida', 'Encerrada', 'Recusada']);
  });

  it('uma transição recusada mostra a mensagem do servidor e o status não muda', async () => {
    world = serveIncidents({ incidents: [makeIncident({ status: 'OPEN' })] });
    mockPost.mockRejectedValue(
      new ApiError('Transição de status inválida: OPEN -> CLOSED.', 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    clickTrigger(screen.getByRole('button', { name: 'Mudar status de OC-2026-000001' }));

    await screen.findByLabelText('Novo status');
    selectOption(within(dialog()).getByLabelText('Novo status'), 'Encerrada');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Mudar status' }));

    const message = await screen.findByText('Transição de status inválida: OPEN -> CLOSED.');
    // A recusa aparece onde a acao foi tomada, e o registro continua como estava.
    expect(within(dialog()).getByRole('alert')).toBe(message);
    // O `onError` proprio substitui o toast global: a mesma recusa nao pode
    // aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('duas confirmações seguidas da mudança produzem um único POST', async () => {
    world = serveIncidents({ incidents: [makeIncident({ status: 'OPEN' })] });
    mockPost.mockImplementation(async () => {
      world.incidents = [makeIncident({ status: 'IN_ANALYSIS' })];
      return world.incidents[0] as never;
    });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    clickTrigger(screen.getByRole('button', { name: 'Mudar status de OC-2026-000001' }));

    await screen.findByLabelText('Novo status');
    const submit = within(dialog()).getByRole('button', { name: 'Mudar status' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });
});

describe('Atribuição de responsável', () => {
  it('atribuir envia o responsável escolhido e a lista reflete', async () => {
    world = serveIncidents({ incidents: [makeIncident({ assignedToId: null })] });
    mockPost.mockImplementation(async (url) => {
      if (url !== '/incidents/incident-1/assign') throw new Error(`URL inesperada: ${url}`);
      world.incidents = [makeIncident({ assignedToId: 'user-2', status: 'IN_ANALYSIS' })];
      return world.incidents[0] as never;
    });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    expect(cellsOf('Responsável')).toEqual(['Sem responsável']);

    clickTrigger(screen.getByRole('button', { name: 'Atribuir OC-2026-000001' }));

    await screen.findByText('Atribuir responsável');
    chooseOption(
      within(dialog()).getByLabelText('Responsável'),
      'Joana Ribeiro, joana@exemplo.com',
    );
    clickTrigger(within(dialog()).getByRole('button', { name: 'Atribuir' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/incidents/incident-1/assign');
    expect(mockPost.mock.calls[0][1]).toEqual({ assignedToId: 'user-2' });

    await waitFor(() => expect(cellsOf('Responsável')).toEqual(['Joana Ribeiro']));
  });

  it('o seletor de responsável lista so gente do condomínio selecionado', async () => {
    world = serveIncidents({
      incidents: [makeIncident()],
      users: [
        makeAssignee({
          id: 'user-2',
          name: 'Joana Ribeiro',
          condominiums: [{ id: 'cond-1', name: 'Residencial Aurora' }],
        }),
        makeAssignee({
          id: 'user-3',
          name: 'Bruno Tavares',
          condominiums: [{ id: 'cond-2', name: 'Residencial Boreal' }],
        }),
        // Vinculo vazio significa "todos do tenant", que e como perfis
        // administrativos sao cadastrados — e como o proprio servidor os trata
        // em `recipientsService.usersOfCondominium`.
        makeAssignee({ id: 'user-4', name: 'Marina Alves', condominiums: [] }),
      ],
    });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    clickTrigger(screen.getByRole('button', { name: 'Atribuir OC-2026-000001' }));

    await screen.findByText('Atribuir responsável');
    openCombobox(within(dialog()).getByLabelText('Responsável'));

    // O nome acessivel, e nao o `textContent`: a opcao tem duas linhas, e
    // concatena-las devolveria "Joana Ribeirojoana@exemplo.com".
    const options = screen
      .getAllByRole('option')
      .map((option) => option.getAttribute('aria-label'));
    expect(options).toEqual([
      'Joana Ribeiro, joana@exemplo.com',
      'Marina Alves, joana@exemplo.com',
    ]);
    // Quem so alcanca outro predio nao pode ser escolhido aqui.
    expect(options).not.toContain('Bruno Tavares');
  });

  it('atribuir sem escolher responsável para no próprio campo', async () => {
    world = serveIncidents({ incidents: [makeIncident({ assignedToId: null })] });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    clickTrigger(screen.getByRole('button', { name: 'Atribuir OC-2026-000001' }));

    await screen.findByText('Atribuir responsável');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Atribuir' }));

    const message = await screen.findByText('Selecione o responsável pela ocorrência.');
    expect(message).toHaveAttribute('id', 'assignedToId-error');
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe('Exclusao e restauração de ocorrências', () => {
  it('excluir pede confirmação antes de remover', async () => {
    world = serveIncidents({ incidents: [makeIncident()] });
    mockDelete.mockImplementation(async () => {
      world.incidents = [];
    });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    clickTrigger(screen.getByRole('button', { name: 'Excluir OC-2026-000001' }));

    // O pedido so sai depois da confirmacao.
    expect(await screen.findByText('Excluir ocorrência?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/incidents/incident-1'));
    await waitFor(() => expect(screen.queryByText('Vazamento na garagem')).not.toBeInTheDocument());
  });

  it('um 409 de impedimento mostra a mensagem do servidor e mantem o registro', async () => {
    world = serveIncidents({ incidents: [makeIncident()] });
    mockDelete.mockRejectedValue(
      new ApiError(
        'Ocorrências encerradas não podem ser alteradas.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    clickTrigger(screen.getByRole('button', { name: 'Excluir OC-2026-000001' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    // A exclusao nao passa `onError`, entao herda o toast global — que e a
    // apresentacao certa para um 409 que traz so a mensagem do servidor.
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'Ocorrências encerradas não podem ser alteradas.',
      ),
    );
    expect(screen.getByText('Vazamento na garagem')).toBeInTheDocument();
  });

  it('incluir removidos envia includeDeleted, e restaurar devolve o registro', async () => {
    world = serveIncidents({
      incidents: [makeIncident({ deletedAt: '2026-03-11T10:00:00.000Z' })],
    });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.incidents = [makeIncident({ deletedAt: null })];
      return world.incidents[0] as never;
    });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    await user.click(screen.getByLabelText('Incluir removidos'));

    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));
    expect(screen.getByText('Removido')).toBeInTheDocument();

    clickTrigger(await screen.findByRole('button', { name: 'Restaurar OC-2026-000001' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/incidents/incident-1/restore'));
    await waitFor(() => expect(screen.queryByText('Removido')).not.toBeInTheDocument());
  });
});

describe('Escopo e permissões de ocorrências', () => {
  it('sem condomínio selecionado a tela explica a exigência e não consulta', async () => {
    world = serveIncidents({ incidents: [makeIncident()] });
    renderWithProviders(<IncidentsPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condomínio')).toBeInTheDocument();
    // Nem a listagem, nem o seletor de responsaveis, nem o resumo saem sem
    // condominio.
    expect(mockGetPaginated).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('com incident:update e sem manage, mudar status e oferecido e atribuir nao', async () => {
    world = serveIncidents({ incidents: [makeIncident()] });
    renderWithProviders(<IncidentsPage />, {
      role: 'STAFF',
      permissions: ['incident:read', 'incident:update'],
    });

    await screen.findByText('Vazamento na garagem');

    // A divisao e a do servidor: `POST /:id/status` exige `incident:update`,
    // `POST /:id/assign` exige `incident:manage` (ADR-002).
    expect(
      screen.getByRole('button', { name: 'Mudar status de OC-2026-000001' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Atribuir/ })).not.toBeInTheDocument();
  });

  it('com incident:manage as duas acoes sao oferecidas', async () => {
    world = serveIncidents({ incidents: [makeIncident()] });
    renderWithProviders(<IncidentsPage />, {
      role: 'SINDICO',
      permissions: ['incident:read', 'incident:manage'],
    });

    await screen.findByText('Vazamento na garagem');

    // `manage` ja implica as demais acoes sobre o recurso, do mesmo jeito nas
    // duas pontas.
    expect(
      screen.getByRole('button', { name: 'Mudar status de OC-2026-000001' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atribuir OC-2026-000001' })).toBeInTheDocument();
  });

  it('um operador sem update não recebe nenhuma ação de fluxo', async () => {
    world = serveIncidents({ incidents: [makeIncident()] });
    renderWithProviders(<IncidentsPage />, {
      role: 'STAFF',
      permissions: ['incident:read'],
    });

    await screen.findByText('Vazamento na garagem');

    expect(screen.queryByRole('button', { name: /^Mudar status/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Atribuir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova ocorrência' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
  });

  it('um operador não ve restaurar nas linhas removidas', async () => {
    world = serveIncidents({
      incidents: [makeIncident({ deletedAt: '2026-03-11T10:00:00.000Z' })],
    });
    const user = createUser();
    renderWithProviders(<IncidentsPage />, {
      role: 'STAFF',
      permissions: ['incident:read'],
    });

    await screen.findByText('Vazamento na garagem');
    // Ver removidos e leitura; restaurar exige `update` (ADR-006).
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(await screen.findByText('Removido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });
});
