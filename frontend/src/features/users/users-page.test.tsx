import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPost } from '@/lib/api';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { User } from '@/types/user';
import { UsersPage } from './users-page';
import {
  allReadRequests,
  lastListParams,
  makeRole,
  makeUser,
  serveUsers,
  type UserWorld,
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
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

let world: UserWorld;

const NAME = 'Marina Alves';

/** Contas com nomes previsiveis, para conferir qual pagina chegou. */
function makeRoster(count: number, offset = 0): User[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeUser({
      id: `user-${position}`,
      name: `Conta ${String(position).padStart(2, '0')}`,
      email: `conta${position}@exemplo.com`,
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

/** Conteudo de uma coluna em todas as linhas, na ordem em que aparecem. */
function cellsOf(label: string): string[] {
  const index = columnIndex(label);
  return dataRows().map((row) => within(row).getAllByRole('cell')[index].textContent?.trim() ?? '');
}

/**
 * Espera as linhas chegarem.
 *
 * A tabela existe desde o primeiro quadro, com uma linha de "Carregando..." no
 * lugar dos dados; quem prova que a resposta chegou e o nome da conta.
 */
async function findRows(name: string = NAME): Promise<HTMLElement> {
  return screen.findByText(name);
}

/** Permissoes de quem pode tudo em usuarios **menos** `manage`. */
const UPDATE_WITHOUT_MANAGE = [
  'user:read',
  'user:create',
  'user:update',
  'user:delete',
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de usuarios', () => {
  it('percorre busca e os tres filtros preservando os parametros', async () => {
    world = serveUsers({ users: [makeUser()] });
    const user = createUser();
    renderWithProviders(<UsersPage />);

    await findRows();

    await user.type(screen.getByLabelText('Buscar'), 'marina');
    await waitFor(() => expect(lastListParams().search).toBe('marina'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta.
    selectOption(screen.getByLabelText('Status'), 'Ativo');
    expect(lastListParams().status).toBe('ACTIVE');

    selectOption(screen.getByLabelText('Papel'), 'SINDICO');
    expect(lastListParams().roleId).toBe('role-1');

    selectOption(screen.getByLabelText('Unidade'), /101/);
    expect(lastListParams().unitId).toBe('unit-1');

    // Os controles se somam em vez de se substituirem — e nenhum deles e de
    // condominio, porque este recurso e por tenant.
    expect(lastListParams()).toMatchObject({
      search: 'marina',
      status: 'ACTIVE',
      roleId: 'role-1',
      unitId: 'unit-1',
    });
    expect(lastListParams()).not.toHaveProperty('condominiumId');
  });

  it('ordenar por uma coluna envia sortOrder em maiusculas', async () => {
    world = serveUsers({ users: [makeUser()] });
    renderWithProviders(<UsersPage />);

    await findRows();

    clickTrigger(screen.getByRole('button', { name: 'Nome' }));
    await waitFor(() => expect(lastListParams().sortBy).toBe('name'));
    expect(lastListParams().sortOrder).toBe('ASC');

    // A tabela alterna a direcao; a traducao para a caixa da API e da camada de
    // dados, e e ela que precisa continuar valendo (ADR-009).
    clickTrigger(screen.getByRole('button', { name: 'Nome' }));
    await waitFor(() => expect(lastListParams().sortOrder).toBe('DESC'));
    expect(lastListParams().sortBy).toBe('name');
  });

  it('trezentas contas paginam no tamanho pedido', async () => {
    world = serveUsers({ users: makeRoster(20), total: 300 });
    const user = createUser();
    renderWithProviders(<UsersPage />);

    await screen.findByText('Conta 01');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams().perPage).toBe(20);

    world.users = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /proxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Conta 21')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });

  it('papel e condominios vinculados aparecem na listagem', async () => {
    world = serveUsers({
      users: [
        makeUser({
          role: makeRole({ name: 'SINDICO' }),
          condominiums: [
            { id: 'cond-1', name: 'Residencial Aurora' },
            { id: 'cond-2', name: 'Residencial Boreal' },
          ],
        }),
      ],
    });
    renderWithProviders(<UsersPage />);

    await findRows();

    // Os dois vem aninhados na resposta (`UserRepository.relations`), e nao por
    // consulta separada — entao a listagem pode exibi-los sem pedir mais nada.
    expect(cellsOf('Papel')).toEqual(['SINDICO']);
    expect(cellsOf('Condominios')).toEqual(['Residencial Aurora, Residencial Boreal']);
  });

  it('campos ausentes viram placeholder, nunca a string "null"', async () => {
    world = serveUsers({
      users: [makeUser({ phone: null, unitId: null, condominiums: [], role: null })],
    });
    renderWithProviders(<UsersPage />);

    await findRows();

    expect(cellsOf('Telefone')).toEqual(['—']);
    expect(cellsOf('Unidade')).toEqual(['Sem unidade']);
    expect(cellsOf('Papel')).toEqual(['Papel nao definido']);
    // Lista vazia significa acesso a todos do tenant, e nao a nenhum: um traco
    // aqui diria o oposto do que o registro significa.
    expect(cellsOf('Condominios')).toEqual(['Todos os condominios']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('a unidade vinculada e nomeada a partir da colecao carregada', async () => {
    world = serveUsers({ users: [makeUser({ unitId: 'unit-1' })] });
    renderWithProviders(<UsersPage />);

    await findRows();

    // A resposta de `/users` traz so o id: `UserRepository` carrega `role` e
    // `condominiums`, mas nao a unidade.
    await waitFor(() => expect(cellsOf('Unidade')).toEqual(['101 · Torre A']));
  });

  it('nenhum controle e oferecido para filtro fora da whitelist do servidor', async () => {
    world = serveUsers({ users: [makeUser()] });
    renderWithProviders(<UsersPage />);

    await findRows();

    // Whitelist do servidor: status, roleId e unitId. E so.
    for (const present of ['Status', 'Papel', 'Unidade']) {
      expect(screen.getByLabelText(present)).toBeInTheDocument();
    }
    // Nao ha filtro de condominio: `UserRepository` nao declara
    // `condominiumField` nem aceita a chave, entao o controle pareceria
    // funcionar enquanto o backend o descarta em silencio.
    for (const absent of ['Condominio', 'Condominios', 'E-mail']) {
      expect(screen.queryByLabelText(absent)).not.toBeInTheDocument();
    }

    // `condominiums` e uma relacao, e nao um campo: o servidor descartaria a
    // chave e voltaria a ordem padrao.
    const header = within(screen.getAllByRole('row')[0])
      .getAllByRole('columnheader')
      .find((item) => item.textContent?.trim().startsWith('Condominios'));
    expect(within(header as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Escopo de tenant da tela de usuarios', () => {
  it('sem condominio selecionado a tela funciona normalmente', async () => {
    world = serveUsers({ users: [makeUser()] });
    renderWithProviders(<UsersPage />, { condominium: null, condominiums: [] });

    // A lista sai sem depender de nenhuma escolha no shell: este recurso e por
    // tenant, e exigir um condominio bloquearia a tela por uma regra inexistente.
    expect(await findRows()).toBeInTheDocument();
    expect(dataRows()).toHaveLength(1);

    // E o estado de "selecione um condominio" das demais telas nao aparece aqui.
    expect(screen.queryByText('Selecione um condominio')).not.toBeInTheDocument();
  });

  it('nenhuma requisicao da tela envia condominiumId', async () => {
    world = serveUsers({ users: [makeUser()] });
    const user = createUser();
    renderWithProviders(<UsersPage />);

    await findRows();
    // Com filtros aplicados o risco e maior: e onde uma chave a mais entraria.
    selectOption(screen.getByLabelText('Status'), 'Ativo');
    await user.type(screen.getByLabelText('Buscar'), 'marina');
    await waitFor(() => expect(lastListParams().search).toBe('marina'));

    const requests = allReadRequests();
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.params).not.toHaveProperty('condominiumId');
    }
    // As tres rotas que a tela alcanca, e nenhuma outra.
    expect(new Set(requests.map((request) => request.url))).toEqual(
      new Set(['/users', '/roles', '/units']),
    );
  });
});

describe('Estados vazios de usuarios', () => {
  it('lista vazia oferece o convite', async () => {
    world = serveUsers({ users: [] });
    renderWithProviders(<UsersPage />);

    expect(await screen.findByText('Nenhum usuario cadastrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convidar usuario' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum resultado para esta busca')).not.toBeInTheDocument();
  });

  it('busca sem resultado oferece limpar, e e distinta da lista vazia', async () => {
    world = serveUsers({ users: [makeUser()] });
    const user = createUser();
    renderWithProviders(<UsersPage />);

    await findRows();
    world.users = [];
    await user.type(screen.getByLabelText('Buscar'), 'Nada');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    // Os dois vazios sao estados diferentes e dizem coisas diferentes.
    expect(screen.queryByText('Nenhum usuario cadastrado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Convidar usuario' })).not.toBeInTheDocument();
  });
});

describe('Reset de senha', () => {
  it('com manage, resetar senha e oferecido e pede confirmacao antes de disparar', async () => {
    world = serveUsers({ users: [makeUser()] });
    mockPost.mockResolvedValue({ temporaryPassword: 'Tmp-48219x' } as never);
    renderWithProviders(<UsersPage />, { permissions: ['user:manage'] });

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Resetar senha de ${NAME}` }));

    // Derrubar as sessoes de outra pessoa e irreversivel: o pedido so sai depois
    // da confirmacao.
    expect(await screen.findByText('Resetar a senha?')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Resetar senha' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/users/user-1/reset-password');
    // Corpo vazio: a tela nao oferece escolher a senha, entao o servidor gera a
    // temporaria — que e o unico caminho que nao passa senha em texto.
    expect(mockPost.mock.calls[0][1]).toEqual({});
  });

  it('a senha temporaria gerada aparece uma vez, para ser entregue', async () => {
    world = serveUsers({ users: [makeUser()] });
    mockPost.mockResolvedValue({ temporaryPassword: 'Tmp-48219x' } as never);
    renderWithProviders(<UsersPage />, { permissions: ['user:manage'] });

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Resetar senha de ${NAME}` }));
    clickTrigger(await screen.findByRole('button', { name: 'Resetar senha' }));

    // Ela volta uma unica vez — o servidor guarda so o hash —, entao precisa
    // aparecer antes que a tela siga adiante.
    expect(await screen.findByText('Tmp-48219x')).toBeInTheDocument();
    expect(screen.getByText('Senha temporaria gerada')).toBeInTheDocument();
  });

  it('dispensar a confirmacao nao dispara requisicao nenhuma', async () => {
    world = serveUsers({ users: [makeUser()] });
    renderWithProviders(<UsersPage />, { permissions: ['user:manage'] });

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Resetar senha de ${NAME}` }));

    expect(await screen.findByText('Resetar a senha?')).toBeInTheDocument();
    clickTrigger(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByText('Resetar a senha?')).not.toBeInTheDocument());
    expect(mockPost).not.toHaveBeenCalled();
    expect(screen.queryByText('Senha temporaria gerada')).not.toBeInTheDocument();
  });

  it('com update mas sem manage, resetar senha nao e oferecido', async () => {
    world = serveUsers({ users: [makeUser()] });
    renderWithProviders(<UsersPage />, { permissions: UPDATE_WITHOUT_MANAGE });

    await findRows();

    // O servidor exige `user:manage` na rota; um papel que corrige um telefone
    // ve editar e nao ve resetar (ADR-002).
    expect(screen.queryByRole('button', { name: /^Resetar senha/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Editar ${NAME}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Excluir ${NAME}` })).toBeInTheDocument();
  });

  it('a recusa do servidor aparece na linha, sem toast em dobro', async () => {
    world = serveUsers({ users: [makeUser()] });
    mockPost.mockRejectedValue(new ApiError('Usuario nao encontrado.', 404, 'NOT_FOUND'));
    renderWithProviders(<UsersPage />, { permissions: ['user:manage'] });

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Resetar senha de ${NAME}` }));
    clickTrigger(await screen.findByRole('button', { name: 'Resetar senha' }));

    const message = await screen.findByText('Usuario nao encontrado.');
    expect(message).toHaveAttribute('role', 'alert');
    // O `onError` proprio substitui o toast global: a mesma recusa nao pode
    // aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
    expect(screen.queryByText('Senha temporaria gerada')).not.toBeInTheDocument();
  });
});

describe('Exclusao e restauracao de usuarios', () => {
  it('excluir pede confirmacao antes de remover', async () => {
    world = serveUsers({ users: [makeUser()] });
    mockDelete.mockImplementation(async () => {
      world.users = [];
    });
    renderWithProviders(<UsersPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Excluir ${NAME}` }));

    // O pedido so sai depois da confirmacao.
    expect(await screen.findByText('Excluir usuario?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/users/user-1'));
    await waitFor(() => expect(screen.queryByText(NAME)).not.toBeInTheDocument());
  });

  it('um 409 de impedimento mostra a mensagem do servidor e mantem o registro', async () => {
    world = serveUsers({ users: [makeUser()] });
    mockDelete.mockRejectedValue(
      new ApiError(
        'Esta e a unica conta administradora ativa. Promova outro usuario antes de alterar esta.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    renderWithProviders(<UsersPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Excluir ${NAME}` }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    // A exclusao nao passa `onError`, entao herda o toast global — que e a
    // apresentacao certa para um 409 que traz so a mensagem do servidor.
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'Esta e a unica conta administradora ativa. Promova outro usuario antes de alterar esta.',
      ),
    );
    expect(screen.getByText(NAME)).toBeInTheDocument();
  });

  it('incluir removidos envia includeDeleted, e restaurar devolve o registro', async () => {
    world = serveUsers({ users: [makeUser({ deletedAt: '2026-03-11T10:00:00.000Z' })] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.users = [makeUser({ deletedAt: null })];
      return world.users[0] as never;
    });
    renderWithProviders(<UsersPage />);

    await findRows();
    await user.click(screen.getByLabelText('Incluir removidos'));

    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));
    expect(screen.getByText('Removido')).toBeInTheDocument();

    clickTrigger(await screen.findByRole('button', { name: `Restaurar ${NAME}` }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/users/user-1/restore'));
    await waitFor(() => expect(screen.queryByText('Removido')).not.toBeInTheDocument());
  });

  it('um operador nao ve restaurar nas linhas removidas', async () => {
    world = serveUsers({ users: [makeUser({ deletedAt: '2026-03-11T10:00:00.000Z' })] });
    const user = createUser();
    renderWithProviders(<UsersPage />, { role: 'STAFF', permissions: ['user:read'] });

    await findRows();
    // Ver removidos e leitura; restaurar exige `update` (ADR-006).
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(await screen.findByText('Removido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });

  it('um operador sem escrita nao recebe nenhuma acao', async () => {
    world = serveUsers({ users: [makeUser()] });
    renderWithProviders(<UsersPage />, { role: 'STAFF', permissions: ['user:read'] });

    await findRows();

    expect(screen.queryByRole('button', { name: 'Novo usuario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Resetar senha/ })).not.toBeInTheDocument();
    // A leitura continua: a lista aparece inteira.
    expect(dataRows()).toHaveLength(1);
    expect(mockGetPaginated).toHaveBeenCalled();
  });
});
