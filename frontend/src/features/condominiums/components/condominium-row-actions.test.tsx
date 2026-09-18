import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPost } from '@/lib/api';
import { useCondominium } from '@/hooks/use-condominium';
import { CondominiumProvider } from '@/providers/condominium-provider';
import { makeCondominium, makeMeta } from '@/test/fixtures';
import { clickTrigger, renderWithProviders, screen, waitFor, within } from '@/test/render';
import type { Condominium } from '@/types/api';
import { CondominiumsPage } from '../condominiums-page';

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
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

const AURORA = makeCondominium();
const BOSQUE = makeCondominium({ id: 'cond-2', name: 'Residencial Bosque' });

function serve(rows: Condominium[]): void {
  mockGetPaginated.mockResolvedValue({ data: rows, meta: makeMeta({ total: rows.length }) });
}

/** Responde conforme o alternador de removidos, como o backend faz. */
function serveWithDeleted(live: Condominium[], deleted: Condominium[]): void {
  mockGetPaginated.mockImplementation(async (_url, config) => {
    const params = (config?.params ?? {}) as { includeDeleted?: boolean };
    const data = params.includeDeleted ? [...live, ...deleted] : live;
    return { data, meta: makeMeta({ total: data.length }) };
  });
}

/** Distingue as duas consultas a `/condominiums`: o seletor pede `perPage` 100. */
function serveSelectorAndList(options: Condominium[], rows: Condominium[]): void {
  mockGetPaginated.mockImplementation(async (_url, config) => {
    const params = (config?.params ?? {}) as { perPage?: number };
    const data = params.perPage === 100 ? options : rows;
    return { data, meta: makeMeta({ total: data.length, perPage: params.perPage ?? 20 }) };
  });
}

function lastListParams(): Record<string, unknown> {
  const calls = mockGetPaginated.mock.calls.filter(([url]) => url === '/condominiums');
  return (calls.at(-1)?.[1]?.params ?? {}) as Record<string, unknown>;
}

/** O seletor do shell, observavel dentro do provider real. */
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

/** O botao de confirmar; o nome ganha "Carregando" enquanto a requisicao corre. */
function confirmButton(): HTMLElement {
  return within(screen.getByRole('dialog')).getByRole('button', { name: /Excluir$/ });
}

/**
 * A linha do registro, localizada pela celula do nome. O nome tambem aparece nos
 * rotulos das acoes, entao a busca precisa ser pelo texto proprio da celula.
 */
function rowOf(name: string): HTMLElement {
  return screen.getByText(name, { selector: 'span' }).closest('tr') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Exclusao de condomínio', () => {
  it('IT-032: confirma nomeando o registro e o remove da lista e do seletor', async () => {
    serveSelectorAndList([AURORA, BOSQUE], [AURORA, BOSQUE]);
    renderWithProviders(
      <CondominiumProvider>
        <SelectorProbe />
        <CondominiumsPage />
      </CondominiumProvider>,
    );
    const selector = screen.getByRole('list', { name: 'Seletor do shell' });
    await waitFor(() =>
      expect(within(selector).getByText('Residencial Bosque')).toBeInTheDocument(),
    );

    mockDelete.mockResolvedValue(undefined);
    clickTrigger(screen.getByRole('button', { name: 'Excluir Residencial Bosque' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Residencial Bosque/)).toBeInTheDocument();

    serveSelectorAndList([AURORA], [AURORA]);
    clickTrigger(confirmButton());

    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
    expect(mockDelete).toHaveBeenCalledWith('/condominiums/cond-2');
    await waitFor(() =>
      expect(within(selector).queryByText('Residencial Bosque')).not.toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole('table')).queryByText('Residencial Bosque'),
    ).not.toBeInTheDocument();
  });

  it('IT-033: recusa por unidades existentes mostra a mensagem e mantem o registro', async () => {
    serve([AURORA]);
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');

    const message =
      'Condomínio possui unidades cadastradas. Remova ou transfira as unidades antes de excluir.';
    mockDelete.mockRejectedValue(new ApiError(message, 409, 'BUSINESS_RULE_VIOLATION'));

    clickTrigger(screen.getByRole('button', { name: 'Excluir Residencial Aurora' }));
    clickTrigger(await screen.findByRole('button', { name: /Excluir$/ }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(message));
    // A confirmacao fecha sem sugerir que deu certo, e a linha continua la.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Residencial Aurora')).toBeInTheDocument();
  });

  it('IT-034: excluir o condomínio selecionado move a seleção para outro', async () => {
    localStorage.setItem('condomínio.selectedCondominium', 'cond-1');
    serveSelectorAndList([AURORA, BOSQUE], [AURORA, BOSQUE]);
    renderWithProviders(
      <CondominiumProvider>
        <SelectorProbe />
        <CondominiumsPage />
      </CondominiumProvider>,
    );
    await screen.findByText('Selecionado: Residencial Aurora');

    mockDelete.mockResolvedValue(undefined);
    serveSelectorAndList([BOSQUE], [BOSQUE]);

    clickTrigger(screen.getByRole('button', { name: 'Excluir Residencial Aurora' }));
    clickTrigger(await screen.findByRole('button', { name: /Excluir$/ }));

    expect(await screen.findByText('Selecionado: Residencial Bosque')).toBeInTheDocument();
  });

  it('IT-035: excluir o último condomínio leva ao estado sem condomínio', async () => {
    serveSelectorAndList([AURORA], [AURORA]);
    renderWithProviders(
      <CondominiumProvider>
        <SelectorProbe />
        <CondominiumsPage />
      </CondominiumProvider>,
    );
    await screen.findByText('Selecionado: Residencial Aurora');

    mockDelete.mockResolvedValue(undefined);
    serveSelectorAndList([], []);

    clickTrigger(screen.getByRole('button', { name: 'Excluir Residencial Aurora' }));
    clickTrigger(await screen.findByRole('button', { name: /Excluir$/ }));

    // Nada quebra: o seletor fica sem opcao e a listagem explica a ausencia.
    expect(await screen.findByText('Selecionado: nenhum')).toBeInTheDocument();
    expect(await screen.findByText('Nenhum condomínio cadastrado')).toBeInTheDocument();
  });

  it('IT-036: 404 na exclusao recarrega a lista', async () => {
    serve([AURORA]);
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');
    const before = mockGetPaginated.mock.calls.length;

    mockDelete.mockRejectedValue(new ApiError('Condomínio não encontrado.', 404, 'NOT_FOUND'));
    serve([]);

    clickTrigger(screen.getByRole('button', { name: 'Excluir Residencial Aurora' }));
    clickTrigger(await screen.findByRole('button', { name: /Excluir$/ }));

    await waitFor(() => expect(mockGetPaginated.mock.calls.length).toBeGreaterThan(before));
    expect(await screen.findByText('Nenhum condomínio cadastrado')).toBeInTheDocument();
  });

  it('IT-037: dispensar a confirmação não dispara requisição', async () => {
    serve([AURORA]);
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');

    clickTrigger(screen.getByRole('button', { name: 'Excluir Residencial Aurora' }));
    clickTrigger(await screen.findByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Residencial Aurora')).toBeInTheDocument();
  });

  it('IT-038: duas confirmações seguidas disparam uma única exclusao', async () => {
    serve([AURORA]);
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');

    let release!: () => void;
    mockDelete.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    clickTrigger(screen.getByRole('button', { name: 'Excluir Residencial Aurora' }));
    const confirm = await screen.findByRole('button', { name: /Excluir$/ });
    clickTrigger(confirm);
    clickTrigger(confirmButton());

    await waitFor(() => expect(confirmButton()).toBeDisabled());
    expect(mockDelete).toHaveBeenCalledTimes(1);

    serve([]);
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Restauração de condomínio', () => {
  const deleted = makeCondominium({
    id: 'cond-3',
    name: 'Residencial Antigo',
    deletedAt: '2026-02-01T12:00:00.000Z',
  });

  it('IT-039: inclui removidos, restaura e o registro volta para a lista normal', async () => {
    serveWithDeleted([AURORA], [deleted]);
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');
    expect(lastListParams().includeDeleted).toBeUndefined();

    clickTrigger(screen.getByRole('checkbox', { name: 'Incluir removidos' }));
    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));
    await screen.findByText('Residencial Antigo');

    mockPost.mockResolvedValue(makeCondominium({ id: 'cond-3', name: 'Residencial Antigo' }));
    serveWithDeleted([AURORA, makeCondominium({ id: 'cond-3', name: 'Residencial Antigo' })], []);

    clickTrigger(screen.getByRole('button', { name: 'Restaurar Residencial Antigo' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith('/condominiums/cond-3/restore');
    await waitFor(() =>
      expect(within(rowOf('Residencial Antigo')).queryByText('Removido')).not.toBeInTheDocument(),
    );
  });

  it('IT-040: alternador ligado sem registros removidos mantem a lista e o próprio estado', async () => {
    serveWithDeleted([AURORA], []);
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');

    const toggle = screen.getByRole('checkbox', { name: 'Incluir removidos' });
    clickTrigger(toggle);

    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));
    expect(toggle).toBeChecked();
    expect(screen.getByText('Residencial Aurora')).toBeInTheDocument();
    expect(screen.queryByText('Removido')).not.toBeInTheDocument();
  });

  it('IT-041: linha removida se distingue de uma linha viva de mesmo nome', async () => {
    const live = makeCondominium({ id: 'cond-4', name: 'Residencial Gemeo' });
    const gone = makeCondominium({
      id: 'cond-5',
      name: 'Residencial Gemeo',
      deletedAt: '2026-02-01T12:00:00.000Z',
    });
    serveWithDeleted([live], [gone]);
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Gemeo');

    clickTrigger(screen.getByRole('checkbox', { name: 'Incluir removidos' }));
    await waitFor(() => expect(screen.getAllByText('Residencial Gemeo')).toHaveLength(2));

    const [liveRow, goneRow] = screen.getAllByRole('row').slice(1);
    // A marca e textual, e nao so cor: "Removido" e a acao de restaurar.
    expect(within(liveRow).queryByText('Removido')).not.toBeInTheDocument();
    expect(within(goneRow).getByText('Removido')).toBeInTheDocument();
    expect(within(goneRow).getByRole('button', { name: /Restaurar/ })).toBeInTheDocument();
    expect(within(liveRow).queryByRole('button', { name: /Restaurar/ })).not.toBeInTheDocument();
  });

  it('IT-042: 409 na restauração mostra a mensagem e o registro segue removido', async () => {
    serveWithDeleted([AURORA], [deleted]);
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');

    clickTrigger(screen.getByRole('checkbox', { name: 'Incluir removidos' }));
    await screen.findByText('Residencial Antigo');

    const message = 'Já existe um condomínio cadastrado com este CNPJ.';
    mockPost.mockRejectedValue(new ApiError(message, 409, 'CONFLICT'));

    clickTrigger(screen.getByRole('button', { name: 'Restaurar Residencial Antigo' }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(message));
    expect(within(rowOf('Residencial Antigo')).getByText('Removido')).toBeInTheDocument();
  });

  it('IT-043: paginar com o alternador ligado mantem includeDeleted em toda requisição', async () => {
    mockGetPaginated.mockImplementation(async (_url, config) => {
      const params = (config?.params ?? {}) as { page?: number; includeDeleted?: boolean };
      const page = params.page ?? 1;
      return {
        data: [makeCondominium({ id: `cond-p${page}`, name: `Condomínio pagina ${page}` })],
        meta: makeMeta({ page, perPage: 20, total: 25, totalPages: 2 }),
      };
    });
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Condomínio pagina 1');

    clickTrigger(screen.getByRole('checkbox', { name: 'Incluir removidos' }));
    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));

    clickTrigger(screen.getByRole('button', { name: 'Próxima página' }));
    await screen.findByText('Condomínio pagina 2');

    expect(lastListParams()).toMatchObject({ page: 2, includeDeleted: true });
    // Nenhuma requisicao apos ligar o alternador perdeu a inclusao.
    const afterToggle = mockGetPaginated.mock.calls
      .map(([, config]) => (config?.params ?? {}) as Record<string, unknown>)
      .filter((params) => params.page === 2);
    expect(afterToggle.every((params) => params.includeDeleted === true)).toBe(true);
  });
});

describe('Seletor do shell', () => {
  it('reflete também a restauração, e não so criação e exclusao', async () => {
    const gone = makeCondominium({
      id: 'cond-8',
      name: 'Residencial Antigo',
      deletedAt: '2026-02-01T12:00:00.000Z',
    });
    const restored = makeCondominium({ id: 'cond-8', name: 'Residencial Antigo' });
    mockGetPaginated.mockImplementation(async (_url, config) => {
      const params = (config?.params ?? {}) as { perPage?: number; includeDeleted?: boolean };
      if (params.perPage === 100)
        return { data: [AURORA], meta: makeMeta({ total: 1, perPage: 100 }) };
      const data = params.includeDeleted ? [AURORA, gone] : [AURORA];
      return { data, meta: makeMeta({ total: data.length }) };
    });

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

    clickTrigger(screen.getByRole('checkbox', { name: 'Incluir removidos' }));
    await screen.findByText('Residencial Antigo');

    mockPost.mockResolvedValue(restored);
    mockGetPaginated.mockImplementation(async (_url, config) => {
      const params = (config?.params ?? {}) as { perPage?: number };
      const data = [AURORA, restored];
      return { data, meta: makeMeta({ total: 2, perPage: params.perPage ?? 20 }) };
    });

    clickTrigger(screen.getByRole('button', { name: 'Restaurar Residencial Antigo' }));

    // O registro restaurado volta a ser selecionavel sem recarregar a pagina.
    await waitFor(() =>
      expect(within(selector).getByText('Residencial Antigo')).toBeInTheDocument(),
    );
  });
});

describe('Gating por permissao', () => {
  it('o operador ve a listagem sem cadastrar, editar, excluir ou restaurar', async () => {
    const gone = makeCondominium({
      id: 'cond-7',
      name: 'Residencial Antigo',
      deletedAt: '2026-02-01T12:00:00.000Z',
    });
    serveWithDeleted([AURORA], [gone]);
    renderWithProviders(<CondominiumsPage />, { role: 'STAFF' });
    await screen.findByText('Residencial Aurora');

    expect(screen.queryByRole('button', { name: 'Novo condomínio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();

    // Ver removidos e leitura, entao o alternador continua disponivel — o que
    // some e a acao de restaurar, que exige `update`.
    clickTrigger(screen.getByRole('checkbox', { name: 'Incluir removidos' }));
    await screen.findByText('Residencial Antigo');
    expect(within(rowOf('Residencial Antigo')).getByText('Removido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();

    // A leitura continua inteira.
    expect(screen.getByRole('link', { name: 'Ver Residencial Aurora' })).toBeInTheDocument();
  });

  it('quem edita mas não exclui mantem restaurar e perde excluir', async () => {
    serveWithDeleted(
      [AURORA],
      [
        makeCondominium({
          id: 'cond-6',
          name: 'Residencial Antigo',
          deletedAt: '2026-02-01T12:00:00.000Z',
        }),
      ],
    );
    renderWithProviders(<CondominiumsPage />, {
      permissions: ['condominium:read', 'condominium:update'],
    });
    await screen.findByText('Residencial Aurora');

    clickTrigger(screen.getByRole('checkbox', { name: 'Incluir removidos' }));
    await screen.findByText('Residencial Antigo');

    // Restaurar depende de `update`, nao de `delete` (ADR-006).
    expect(
      screen.getByRole('button', { name: 'Restaurar Residencial Antigo' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Residencial Aurora' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo condomínio' })).not.toBeInTheDocument();
  });
});
