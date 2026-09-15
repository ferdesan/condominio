import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiPatch, apiPost } from '@/lib/api';
import { makeCondominium } from '@/test/fixtures';
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
import { UsersPage } from '../users-page';
import { makeUser, serveUsers, type UserWorld } from '../test-utils';

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

/** Mesmo custo de portal do Radix descrito em `users-page.test.tsx`. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockToastError = vi.mocked(toast.error);

let world: UserWorld;

const NAME = 'Marina Alves';

const TWO_CONDOMINIUMS = [
  makeCondominium({ id: 'cond-1', name: 'Residencial Aurora' }),
  makeCondominium({ id: 'cond-2', name: 'Residencial Boreal' }),
];

/** Corpo da ultima criacao pedida. */
function lastCreateBody(): Record<string, unknown> {
  return (mockPost.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

/** Corpo da ultima atualizacao pedida. */
function lastUpdateBody(): Record<string, unknown> {
  return (mockPatch.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

/** Abre o dialogo de cadastro e espera o formulario aparecer. */
async function openCreateDialog(): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: 'Novo usuario' }));
  await screen.findByLabelText('Nome');
}

/** Abre o dialogo de edicao da conta em tela. */
async function openEditDialog(): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: `Editar ${NAME}` }));
  await screen.findByLabelText('E-mail');
}

function submitCreate(): void {
  clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));
}

function submitEdit(): void {
  clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));
}

function fill(field: HTMLElement, value: string): void {
  fireEvent.change(field, { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Cadastro de usuario', () => {
  it('cadastra e a lista atualiza sem refetch manual', async () => {
    world = serveUsers({ users: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.users = [makeUser({ id: 'user-9', name: 'Paulo Nunes' })];
      return world.users[0] as never;
    });
    renderWithProviders(<UsersPage />, { condominiums: TWO_CONDOMINIUMS });

    await screen.findByText('Nenhum usuario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Paulo Nunes');
    await user.type(within(dialog()).getByLabelText('E-mail'), 'paulo@exemplo.com');
    selectOption(within(dialog()).getByLabelText('Papel'), 'SINDICO');
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/users');
    expect(lastCreateBody()).toMatchObject({
      name: 'Paulo Nunes',
      email: 'paulo@exemplo.com',
      roleId: 'role-1',
      status: 'ACTIVE',
      // Sem vinculo a chave vai nula, e nao ausente: limpar precisa apagar.
      phone: null,
      document: null,
      unitId: null,
      // Vazio significa "todos os condominios do tenant", e e o que o servidor
      // grava quando a lista nao vem preenchida.
      condominiumIds: [],
    });
    // Este recurso e por tenant: nenhuma chave de condominio entra no corpo.
    expect(lastCreateBody()).not.toHaveProperty('condominiumId');
    // A senha nunca sai daqui: omitida, o servidor gera uma temporaria e exige a
    // troca no primeiro acesso.
    expect(lastCreateBody()).not.toHaveProperty('password');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // A invalidacao da fabrica traz a linha nova: ninguem pediu refetch aqui.
    expect(await screen.findByText('Paulo Nunes')).toBeInTheDocument();
  });

  it('a tela nao oferece nem exibe senha em texto', async () => {
    world = serveUsers({ users: [makeUser()] });
    renderWithProviders(<UsersPage />);

    await screen.findByText(NAME);
    await openEditDialog();

    // `updateUserSchema` sequer aceita o campo, e mesmo na criacao a tela o
    // omite: o reset administrativo, que exige `user:manage`, e a unica via.
    for (const absent of ['Senha', 'Nova senha', 'Confirmar senha']) {
      expect(within(dialog()).queryByLabelText(absent)).not.toBeInTheDocument();
    }
    expect(dialog().querySelector('input[type="password"]')).toBeNull();
  });

  it('o vinculo com condominios e escolhido no formulario, e nao herdado da tela', async () => {
    world = serveUsers({ users: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.users = [makeUser({ id: 'user-9', name: 'Paulo Nunes' })];
      return world.users[0] as never;
    });
    renderWithProviders(<UsersPage />, { condominiums: TWO_CONDOMINIUMS });

    await screen.findByText('Nenhum usuario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Paulo Nunes');
    await user.type(within(dialog()).getByLabelText('E-mail'), 'paulo@exemplo.com');
    selectOption(within(dialog()).getByLabelText('Papel'), 'SINDICO');
    await user.click(within(dialog()).getByLabelText('Residencial Boreal'));
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody().condominiumIds).toEqual(['cond-2']);
  });

  it('o aviso de escopo de condominio nao existe nesta tela', async () => {
    world = serveUsers({ users: [] });
    renderWithProviders(<UsersPage />, { condominiums: TWO_CONDOMINIUMS });

    await screen.findByText('Nenhum usuario cadastrado');
    await openCreateDialog();

    // O aviso nomeia a divergencia entre o predio do dialogo e o do shell. Aqui
    // nao ha o que divergir: o usuario pertence ao tenant, e os condominios sao
    // um vinculo escolhido no proprio formulario.
    expect(screen.queryByText(/continua valendo para/i)).not.toBeInTheDocument();
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sem nome o envio para no proprio campo', async () => {
    world = serveUsers({ users: [] });
    const user = createUser();
    renderWithProviders(<UsersPage />);

    await screen.findByText('Nenhum usuario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('E-mail'), 'paulo@exemplo.com');
    selectOption(within(dialog()).getByLabelText('Papel'), 'SINDICO');
    submitCreate();

    const message = await screen.findByText('Informe o nome do usuario.');
    // A objecao pertence ao campo do nome, e nao ao formulario inteiro.
    expect(message).toHaveAttribute('id', 'name-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('sem papel o envio para no proprio campo', async () => {
    world = serveUsers({ users: [] });
    const user = createUser();
    renderWithProviders(<UsersPage />);

    await screen.findByText('Nenhum usuario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Paulo Nunes');
    await user.type(within(dialog()).getByLabelText('E-mail'), 'paulo@exemplo.com');
    submitCreate();

    // `roleId` e obrigatorio em `createUserSchema`; o formulario o cobra antes
    // de gastar uma requisicao.
    const message = await screen.findByText('Selecione o papel de acesso.');
    expect(message).toHaveAttribute('id', 'roleId-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('dois cliques em cadastrar disparam uma requisicao so', async () => {
    world = serveUsers({ users: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.users = [makeUser()];
      return world.users[0] as never;
    });
    renderWithProviders(<UsersPage />);

    await screen.findByText('Nenhum usuario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Paulo Nunes');
    await user.type(within(dialog()).getByLabelText('E-mail'), 'paulo@exemplo.com');
    selectOption(within(dialog()).getByLabelText('Papel'), 'SINDICO');

    const submit = within(dialog()).getByRole('button', { name: 'Cadastrar' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });
});

describe('Edicao de usuario', () => {
  it('edita e a lista atualiza sem refetch manual', async () => {
    world = serveUsers({ users: [makeUser()] });
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.users = [makeUser({ name: 'Marina Alves Souza' })];
      return world.users[0] as never;
    });
    renderWithProviders(<UsersPage />);

    await screen.findByText(NAME);
    await openEditDialog();

    const name = within(dialog()).getByLabelText('Nome');
    // O formulario abre com o registro carregado, e nao em branco.
    expect(name).toHaveValue(NAME);
    // O CPF chega ja gravado em digitos; o corpo devolve digitos tambem.
    expect(within(dialog()).getByLabelText('CPF')).toHaveValue('12345678909');

    await user.clear(name);
    await user.type(name, 'Marina Alves Souza');
    submitEdit();

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0][0]).toBe('/users/user-1');
    expect(lastUpdateBody()).toMatchObject({
      name: 'Marina Alves Souza',
      document: '12345678909',
      condominiumIds: ['cond-1'],
    });
    expect(lastUpdateBody()).not.toHaveProperty('password');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Marina Alves Souza')).toBeInTheDocument();
  });

  it('o CPF vai em digitos, mesmo digitado com mascara', async () => {
    world = serveUsers({ users: [makeUser()] });
    mockPatch.mockImplementation(async () => {
      world.users = [makeUser()];
      return world.users[0] as never;
    });
    renderWithProviders(<UsersPage />);

    await screen.findByText(NAME);
    await openEditDialog();

    // O servidor guarda `varchar(11)` ja normalizado; mandar o mascarado o faria
    // recusar por comprimento.
    fill(within(dialog()).getByLabelText('CPF'), '529.982.247-25');
    submitEdit();

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(lastUpdateBody().document).toBe('52998224725');
  });

  it('um CPF incompleto para no proprio campo', async () => {
    world = serveUsers({ users: [makeUser()] });
    renderWithProviders(<UsersPage />);

    await screen.findByText(NAME);
    await openEditDialog();

    fill(within(dialog()).getByLabelText('CPF'), '5299822');
    submitEdit();

    const message = await screen.findByText('CPF deve conter 11 digitos.');
    expect(message).toHaveAttribute('id', 'document-error');
    expect(mockPatch).not.toHaveBeenCalled();
  });
});

describe('Erros do servidor no formulario de usuario', () => {
  it('um 422 aponta o campo e nao levanta toast', async () => {
    world = serveUsers({ users: [] });
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
        { field: 'email', message: 'E-mail invalido.' },
      ]),
    );
    renderWithProviders(<UsersPage />);

    await screen.findByText('Nenhum usuario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Paulo Nunes');
    await user.type(within(dialog()).getByLabelText('E-mail'), 'paulo@exemplo.com');
    selectOption(within(dialog()).getByLabelText('Papel'), 'SINDICO');
    submitCreate();

    const message = await screen.findByText('E-mail invalido.');
    expect(message).toHaveAttribute('id', 'email-error');
    // O `onError` do formulario substitui o toast global: a objecao ja esta no
    // campo e nao deve aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('um 409 vira mensagem do formulario e preserva o que foi preenchido', async () => {
    world = serveUsers({ users: [] });
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Ja existe um usuario com este e-mail nesta administradora.', 409, 'CONFLICT'),
    );
    renderWithProviders(<UsersPage />);

    await screen.findByText('Nenhum usuario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Paulo Nunes');
    await user.type(within(dialog()).getByLabelText('E-mail'), 'marina@exemplo.com');
    await user.type(within(dialog()).getByLabelText('Telefone'), '11977776666');
    selectOption(within(dialog()).getByLabelText('Papel'), 'SINDICO');
    submitCreate();

    // Um 409 vem sem caminho de campo: a mensagem pertence ao formulario inteiro.
    const alert = await within(dialog()).findByRole('alert');
    expect(alert).toHaveTextContent('Ja existe um usuario com este e-mail nesta administradora.');
    expect(mockToastError).not.toHaveBeenCalled();

    // Nada do que foi digitado se perde: refazer o preenchimento seria a punicao
    // errada para um conflito que nao e do usuario.
    expect(within(dialog()).getByLabelText('Nome')).toHaveValue('Paulo Nunes');
    expect(within(dialog()).getByLabelText('E-mail')).toHaveValue('marina@exemplo.com');
    expect(within(dialog()).getByLabelText('Telefone')).toHaveValue('11977776666');
  });
});
