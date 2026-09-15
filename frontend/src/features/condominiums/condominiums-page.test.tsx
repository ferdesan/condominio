import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiGetPaginated, apiPost } from '@/lib/api';
import { useCondominium } from '@/hooks/use-condominium';
import { CondominiumProvider } from '@/providers/condominium-provider';
import { makeCondominium, makeMeta } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/render';
import type { Condominium } from '@/types/api';
import { CondominiumsPage } from './condominiums-page';

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

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockToastError = vi.mocked(toast.error);

/** Um lote de registros com nomes previsiveis, para conferir qual pagina chegou. */
function makeRecords(count: number, offset = 0): Condominium[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeCondominium({
      id: `cond-${position}`,
      name: `Condominio ${String(position).padStart(2, '0')}`,
      document: String(10000000000000 + position),
    });
  });
}

/** Os parametros da ultima listagem pedida pela tela. */
function lastListParams(): Record<string, unknown> {
  const calls = mockGetPaginated.mock.calls.filter(([url]) => url === '/condominiums');
  return (calls.at(-1)?.[1]?.params ?? {}) as Record<string, unknown>;
}

/**
 * Responde a listagem com 25 registros distribuidos em duas paginas de 20,
 * respeitando a pagina pedida. Busca e ordenacao nao alteram o conjunto: o que
 * estes casos verificam e o que a tela envia, nao o que o servidor faria.
 */
function serveTwoPages(): void {
  mockGetPaginated.mockImplementation(async (_url, config) => {
    const params = (config?.params ?? {}) as { page?: number; perPage?: number };
    const perPage = params.perPage ?? 20;
    const page = params.page ?? 1;
    const offset = (page - 1) * perPage;
    const data = makeRecords(Math.max(0, Math.min(perPage, 25 - offset)), offset);
    return { data, meta: makeMeta({ page, perPage, total: 25, totalPages: 2 }) };
  });
}

function serveOnce(data: Condominium[], meta = {}): void {
  mockGetPaginated.mockResolvedValue({
    data,
    meta: makeMeta({ total: data.length, ...meta }),
  });
}

/** Linhas de dados, sem o cabecalho. */
function dataRows(): HTMLElement[] {
  return screen.getAllByRole('row').slice(1);
}

/**
 * O seletor do shell, observavel. Precisa ficar dentro do `CondominiumProvider`
 * real: e ele quem guarda a colecao que a tela invalida, e substitui-lo por um
 * contexto de mentira apagaria justamente o que estes casos verificam.
 */
function SelectorProbe() {
  const { condominiums, selected } = useCondominium();
  return (
    <div>
      <p>Selecionado: {selected?.name ?? 'nenhum'}</p>
      <ul aria-label="Seletor do shell">
        {condominiums.map((condominium) => (
          <li key={condominium.id}>{condominium.name}</li>
        ))}
      </ul>
    </div>
  );
}

/** Distingue as duas consultas a `/condominiums`: o seletor pede `perPage` 100. */
function serveSelectorAndList(options: Condominium[], rows: Condominium[]): void {
  mockGetPaginated.mockImplementation(async (_url, config) => {
    const params = (config?.params ?? {}) as { perPage?: number };
    const data = params.perPage === 100 ? options : rows;
    return { data, meta: makeMeta({ total: data.length, perPage: params.perPage ?? 20 }) };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de condominios', () => {
  it('IT-001: percorre busca, ordenacao e paginacao preservando os parametros', async () => {
    serveTwoPages();
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);

    await screen.findByText('Condominio 01');
    expect(dataRows()).toHaveLength(20);

    await user.type(screen.getByLabelText('Buscar'), 'Condominio');
    await waitFor(() => expect(lastListParams().search).toBe('Condominio'));

    clickTrigger(screen.getByRole('button', { name: 'Nome' }));
    await waitFor(() => expect(lastListParams().sortBy).toBe('name'));
    expect(lastListParams().sortOrder).toBe('ASC');

    clickTrigger(screen.getByRole('button', { name: 'Próxima página' }));
    await screen.findByText('Condominio 21');

    expect(lastListParams()).toMatchObject({
      page: 2,
      perPage: 20,
      search: 'Condominio',
      sortBy: 'name',
      sortOrder: 'ASC',
    });
    expect(screen.queryByText('Condominio 01')).not.toBeInTheDocument();
  });

  it('IT-002: lista vazia oferece o cadastro do primeiro registro', async () => {
    serveOnce([]);
    renderWithProviders(<CondominiumsPage />);

    expect(await screen.findByText('Nenhum condominio cadastrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar condominio' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum resultado para esta busca')).not.toBeInTheDocument();
  });

  it('IT-003: busca sem resultado oferece limpar a busca', async () => {
    serveOnce([makeCondominium()]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);

    await screen.findByText('Residencial Aurora');
    serveOnce([]);
    await user.type(screen.getByLabelText('Buscar'), 'inexistente');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum condominio cadastrado')).not.toBeInTheDocument();
  });

  it('IT-004: cinco teclas produzem uma requisicao, nao cinco', async () => {
    serveOnce([makeCondominium()]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);

    await screen.findByText('Residencial Aurora');
    expect(mockGetPaginated).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText('Buscar'), 'auror');

    await waitFor(() => expect(lastListParams().search).toBe('auror'));
    expect(mockGetPaginated).toHaveBeenCalledTimes(2);
  });

  it('IT-005: coluna fora do conjunto ordenavel do servidor nao vira controle', async () => {
    serveOnce([makeCondominium()]);
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');

    // `syndicName` nao esta na whitelist: o cabecalho existe, o botao nao.
    expect(screen.getByRole('columnheader', { name: 'Sindico' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sindico' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nome' })).toBeInTheDocument();
  });

  it('IT-006: pagina de 20 registros renderiza 20 linhas', async () => {
    serveTwoPages();
    renderWithProviders(<CondominiumsPage />);

    await screen.findByText('Condominio 01');
    expect(dataRows()).toHaveLength(20);
    expect(screen.getByText('Condominio 20')).toBeInTheDocument();
  });

  it('IT-007: pagina alem da ultima volta para a ultima valida', async () => {
    // A primeira pagina ainda anuncia duas; ao pedir a segunda, o servidor revela
    // que so resta uma. A tela precisa recuar em vez de renderizar vazio.
    mockGetPaginated.mockImplementation(async (_url, config) => {
      const params = (config?.params ?? {}) as { page?: number };
      if ((params.page ?? 1) === 1) {
        return {
          data: makeRecords(20),
          meta: makeMeta({ page: 1, perPage: 20, total: 25, totalPages: 2 }),
        };
      }
      return { data: [], meta: makeMeta({ page: 2, perPage: 20, total: 20, totalPages: 1 }) };
    });
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Condominio 01');

    clickTrigger(screen.getByRole('button', { name: 'Próxima página' }));
    await waitFor(() => expect(lastListParams().page).toBe(2));

    await waitFor(() => expect(screen.getByText(/Página 1 de/)).toBeInTheDocument());
    expect(screen.getByText('Condominio 01')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum resultado para esta busca')).not.toBeInTheDocument();
  });

  it('IT-008: 401 na listagem nao levanta toast', async () => {
    mockGetPaginated.mockRejectedValue(new ApiError('Sessao expirada.', 401, 'UNAUTHORIZED'));
    renderWithProviders(<CondominiumsPage />);

    await waitFor(() => expect(mockGetPaginated).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Carregando...')).not.toBeInTheDocument());
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('IT-009: campos ausentes viram placeholder, nunca "null"', async () => {
    serveOnce([makeCondominium({ document: null, city: null, syndicName: null })]);
    renderWithProviders(<CondominiumsPage />);

    const row = (await screen.findByText('Residencial Aurora')).closest('tr') as HTMLElement;
    expect(within(row).getAllByText('—')).toHaveLength(3);
    expect(within(row).queryByText(/null|undefined/)).not.toBeInTheDocument();
  });
});

describe('Fronteira com a camada de dados', () => {
  it('IT-207: um cadastro atualiza a lista ja renderizada sem refetch manual', async () => {
    serveOnce([makeCondominium()]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');

    const created = makeCondominium({ id: 'cond-2', name: 'Residencial Bosque' });
    mockPost.mockResolvedValue(created);
    // A proxima listagem ja responde com o registro novo: o que se verifica e que
    // a tela refaz a consulta sozinha apos a mutacao.
    serveOnce([makeCondominium(), created]);

    clickTrigger(screen.getByRole('button', { name: 'Novo condominio' }));
    await user.type(await screen.findByLabelText('Nome'), 'Residencial Bosque');
    clickTrigger(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(await screen.findByText('Residencial Bosque')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('IT-208: um cadastro atualiza a lista e o seletor do shell', async () => {
    const existing = makeCondominium();
    const created = makeCondominium({ id: 'cond-2', name: 'Residencial Bosque' });
    serveSelectorAndList([existing], [existing]);
    const user = createUser();

    renderWithProviders(
      <CondominiumProvider>
        <SelectorProbe />
        <CondominiumsPage />
      </CondominiumProvider>,
    );

    const selector = screen.getByRole('list', { name: 'Seletor do shell' });
    await waitFor(() =>
      expect(within(selector).getByText('Residencial Aurora')).toBeInTheDocument(),
    );
    expect(within(selector).queryByText('Residencial Bosque')).not.toBeInTheDocument();

    mockPost.mockResolvedValue(created);
    serveSelectorAndList([existing, created], [existing, created]);

    clickTrigger(screen.getByRole('button', { name: 'Novo condominio' }));
    await user.type(await screen.findByLabelText('Nome'), 'Residencial Bosque');
    clickTrigger(screen.getByRole('button', { name: 'Cadastrar' }));

    // Sem recarregar a pagina: as duas consultas leem a mesma colecao e a
    // mutacao invalida as duas (ADR-008).
    await waitFor(() =>
      expect(within(selector).getByText('Residencial Bosque')).toBeInTheDocument(),
    );
    const table = screen.getByRole('table');
    expect(within(table).getByText('Residencial Bosque')).toBeInTheDocument();
  });

  it('IT-209: a tabela pede a proxima pagina com o mesmo tamanho e ordena em caixa alta', async () => {
    serveTwoPages();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Condominio 01');

    expect(dataRows()).toHaveLength(20);
    expect(lastListParams()).toMatchObject({ page: 1, perPage: 20 });

    clickTrigger(screen.getByRole('button', { name: 'Próxima página' }));
    await screen.findByText('Condominio 21');
    expect(lastListParams()).toMatchObject({ page: 2, perPage: 20 });

    clickTrigger(screen.getByRole('button', { name: 'Nome' }));
    await waitFor(() => expect(lastListParams().sortOrder).toBe('ASC'));

    // Segundo clique inverte a direcao, ainda em caixa alta.
    clickTrigger(screen.getByRole('button', { name: 'Nome' }));
    await waitFor(() => expect(lastListParams().sortOrder).toBe('DESC'));
  });
});
