import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPost } from '@/lib/api';
import { makeMeta, makeServiceProvider } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { ServiceProvider } from '@/types/api';
import { ServiceProvidersPage } from './service-providers-page';

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

/**
 * Mesmo custo medido em `residents-page.test.tsx`: abrir um select do Radix no
 * jsdom ocupa a thread por dezenas de segundos, e o excedente escorre para o
 * caso seguinte. Dai o prazo largo, que vale para o arquivo inteiro, e o uso de
 * `selectOption` com assercao sincrona logo depois — `fireEvent` ja vem
 * embrulhado em `act`, entao o novo pedido saiu antes de a chamada retornar.
 */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

/** Estado do servidor durante um caso, mutavel para que o refetch mostre o efeito. */
type World = { providers: ServiceProvider[]; total?: number };

let world: World;

/**
 * A tela faz duas consultas a `/service-providers`: a listagem paginada e a que
 * alimenta o seletor de tipos de servico, que pede a colecao inteira e por isso
 * nao manda `page`. O duble responde as duas a partir da mesma descricao.
 */
function serve(providers: ServiceProvider[]): void {
  world = { providers };
  mockGetPaginated.mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    if (url !== '/service-providers') throw new Error(`URL nao prevista no teste: ${url}`);

    if (params.page === undefined) {
      return {
        data: world.providers,
        meta: makeMeta({ total: world.providers.length, perPage: 200 }),
      };
    }

    return {
      data: world.providers,
      meta: makeMeta({
        total: world.total ?? world.providers.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    };
  });
}

/** Prestadores com razoes sociais previsiveis, para conferir qual pagina chegou. */
function makeRoster(count: number, offset = 0): ServiceProvider[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeServiceProvider({
      id: `provider-${position}`,
      companyName: `Prestador ${String(position).padStart(3, '0')}`,
      document: null,
    });
  });
}

/** Consultas da listagem — as do seletor de tipos nao mandam `page`. */
function listCalls(): Record<string, unknown>[] {
  return mockGetPaginated.mock.calls
    .filter(([url]) => url === '/service-providers')
    .map(([, config]) => (config?.params ?? {}) as Record<string, unknown>)
    .filter((params) => params.page !== undefined);
}

/** Os parametros da ultima listagem pedida pela tela. */
function lastListParams(): Record<string, unknown> {
  return listCalls().at(-1) ?? {};
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

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de prestadores', () => {
  it('percorre busca e filtros de tipo e status preservando os parametros', async () => {
    serve([makeServiceProvider()]);
    const user = createUser();
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Limpeza Total Ltda');
    // Toda consulta nasce presa ao condominio escolhido no shell.
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'Total');
    await waitFor(() => expect(lastListParams().search).toBe('Total'));

    selectOption(screen.getByLabelText('Tipo de servico'), 'Limpeza');
    expect(lastListParams().serviceType).toBe('Limpeza');

    selectOption(screen.getByLabelText('Status'), 'Ativo');
    expect(lastListParams().status).toBe('ACTIVE');

    // Os controles se somam em vez de se substituirem.
    expect(lastListParams()).toMatchObject({
      condominiumId: 'cond-1',
      search: 'Total',
      serviceType: 'Limpeza',
      status: 'ACTIVE',
    });
  });

  it('um CNPJ pontuado na busca e enviado apenas com os digitos', async () => {
    serve([makeServiceProvider()]);
    const user = createUser();
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Limpeza Total Ltda');
    await user.type(screen.getByLabelText('Buscar'), '12.345.678/0001-99');

    await waitFor(() => expect(lastListParams().search).toBe('12345678000199'));
  });

  it('ordenar por uma coluna envia sortOrder em maiusculas', async () => {
    serve([makeServiceProvider()]);
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Limpeza Total Ltda');

    clickTrigger(screen.getByRole('button', { name: 'Razao social' }));
    await waitFor(() => expect(lastListParams().sortBy).toBe('companyName'));
    expect(lastListParams().sortOrder).toBe('ASC');

    // A tabela alterna a direcao; a traducao para a caixa da API e da camada de
    // dados, e e ela que precisa continuar valendo (ADR-009).
    clickTrigger(screen.getByRole('button', { name: 'Razao social' }));
    await waitFor(() => expect(lastListParams().sortOrder).toBe('DESC'));
    expect(lastListParams().sortBy).toBe('companyName');
  });

  it('trezentos prestadores paginam no tamanho pedido', async () => {
    serve(makeRoster(20));
    world.total = 300;
    const user = createUser();
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Prestador 001');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams().perPage).toBe(20);

    world.providers = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /proxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Prestador 021')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });

  it('o documento sai formatado como CPF ou como CNPJ, conforme o comprimento', async () => {
    serve([
      makeServiceProvider({ id: 'p1', companyName: 'Alfa Servicos', document: '12345678000199' }),
      makeServiceProvider({ id: 'p2', companyName: 'Bruno Eletricista', document: '12345678909' }),
    ]);
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Alfa Servicos');

    // O mesmo helper distingue os dois comprimentos, entao a coluna nao precisa
    // saber qual prestador e pessoa fisica.
    expect(cellsOf('CPF/CNPJ')).toEqual(['12.345.678/0001-99', '123.456.789-09']);
  });

  it('a avaliacao aparece como nota, e nao como o inteiro guardado', async () => {
    serve([makeServiceProvider({ rating: 4 })]);
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Limpeza Total Ltda');

    expect(cellsOf('Avaliacao')).toEqual(['★★★★☆']);
    // A escala vai junto para quem le por leitor de tela: "4" sozinho nao diz
    // de quanto e a nota nem para que lado ela cresce.
    expect(screen.getByLabelText('4 de 5 — Muito bom')).toBeInTheDocument();
  });

  it('uma nota fora da faixa nao derruba a listagem', async () => {
    // A coluna e um `int` sem restricao: quem segura o 1 a 5 e o schema da API,
    // entao um registro antigo pode chegar com outra coisa.
    serve([makeServiceProvider({ rating: 7 })]);
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Limpeza Total Ltda');

    expect(cellsOf('Avaliacao')).toEqual(['★★★★★']);
    // As estrelas saturam, mas o rotulo continua dizendo o valor de fato.
    expect(screen.getByLabelText('7 de 5')).toBeInTheDocument();
  });

  it('campos ausentes viram placeholder, nunca a string "null"', async () => {
    serve([
      makeServiceProvider({
        tradeName: null,
        document: null,
        contactName: null,
        phone: null,
        rating: null,
        contractStart: null,
        contractEnd: null,
      }),
    ]);
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Limpeza Total Ltda');

    expect(cellsOf('Nome fantasia')).toEqual(['—']);
    expect(cellsOf('CPF/CNPJ')).toEqual(['—']);
    expect(cellsOf('Contato')).toEqual(['—']);
    expect(cellsOf('Telefone')).toEqual(['—']);
    expect(cellsOf('Vigencia')).toEqual(['—']);
    expect(cellsOf('Avaliacao')).toEqual(['—']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('nenhum controle e oferecido para filtro fora da whitelist do servidor', async () => {
    serve([makeServiceProvider()]);
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Limpeza Total Ltda');

    // Whitelist do servidor: condominiumId (vem do shell), status e serviceType.
    // Qualquer outro controle pareceria funcionar enquanto o backend o descarta
    // em silencio.
    expect(screen.getByLabelText('Tipo de servico')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();

    for (const absent of ['Avaliacao', 'Contato', 'Telefone', 'E-mail', 'Vigencia']) {
      expect(screen.queryByLabelText(absent)).not.toBeInTheDocument();
    }
  });
});

describe('Estados vazios de prestadores', () => {
  it('lista vazia oferece o cadastro', async () => {
    serve([]);
    renderWithProviders(<ServiceProvidersPage />);

    expect(await screen.findByText('Nenhum prestador cadastrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar prestador' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum resultado para esta busca')).not.toBeInTheDocument();
  });

  it('busca sem resultado oferece limpar, e e distinta da lista vazia', async () => {
    serve([makeServiceProvider()]);
    const user = createUser();
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Limpeza Total Ltda');
    world.providers = [];
    await user.type(screen.getByLabelText('Buscar'), 'Jardinagem');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    // Os dois vazios sao estados diferentes e dizem coisas diferentes.
    expect(screen.queryByText('Nenhum prestador cadastrado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cadastrar prestador' })).not.toBeInTheDocument();
  });
});

describe('Exclusao e restauracao de prestadores', () => {
  it('excluir pede confirmacao antes de remover', async () => {
    serve([makeServiceProvider()]);
    mockDelete.mockImplementation(async () => {
      world.providers = [];
    });
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Limpeza Total Ltda');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Limpeza Total Ltda' }));

    // O pedido so sai depois da confirmacao.
    expect(await screen.findByText('Excluir prestador?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/service-providers/provider-1'));
    await waitFor(() => expect(screen.queryByText('Limpeza Total Ltda')).not.toBeInTheDocument());
  });

  it('um 409 de impedimento mostra a mensagem do servidor e mantem o registro', async () => {
    serve([makeServiceProvider()]);
    mockDelete.mockRejectedValue(
      new ApiError(
        'Ha ordens de servico abertas para este prestador.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Limpeza Total Ltda');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Limpeza Total Ltda' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    // Acao de linha nao passa `onError`, entao herda o toast global — que e a
    // apresentacao certa para um 409 que traz so a mensagem do servidor.
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'Ha ordens de servico abertas para este prestador.',
      ),
    );
    expect(screen.getByText('Limpeza Total Ltda')).toBeInTheDocument();
  });

  it('incluir removidos envia includeDeleted, e restaurar devolve o registro', async () => {
    serve([makeServiceProvider({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.providers = [makeServiceProvider({ deletedAt: null })];
      return world.providers[0];
    });
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Limpeza Total Ltda');
    await user.click(screen.getByLabelText('Incluir removidos'));

    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));
    expect(screen.getByText('Removido')).toBeInTheDocument();

    clickTrigger(await screen.findByRole('button', { name: 'Restaurar Limpeza Total Ltda' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/service-providers/provider-1/restore'),
    );
    await waitFor(() => expect(screen.queryByText('Removido')).not.toBeInTheDocument());
  });
});

describe('Escopo e permissoes de prestadores', () => {
  it('sem condominio selecionado a tela explica a exigencia e nao consulta', async () => {
    serve([makeServiceProvider()]);
    renderWithProviders(<ServiceProvidersPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condominio')).toBeInTheDocument();
    expect(mockGetPaginated).not.toHaveBeenCalled();
  });

  it('um operador ve a listagem sem cadastrar, editar ou excluir', async () => {
    serve([makeServiceProvider()]);
    // O operador e leitura pura sobre este recurso (ADR-002).
    renderWithProviders(<ServiceProvidersPage />, {
      role: 'STAFF',
      permissions: ['service-provider:read'],
    });

    await screen.findByText('Limpeza Total Ltda');

    expect(screen.queryByRole('button', { name: 'Novo prestador' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
  });

  it('um operador nao ve restaurar nas linhas removidas', async () => {
    serve([makeServiceProvider({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    renderWithProviders(<ServiceProvidersPage />, {
      role: 'STAFF',
      permissions: ['service-provider:read'],
    });

    await screen.findByText('Limpeza Total Ltda');
    // Ver removidos e leitura; restaurar exige `update` (ADR-006).
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(await screen.findByText('Removido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });
});
