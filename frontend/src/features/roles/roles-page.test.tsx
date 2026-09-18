import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/render';
import { RolesPage } from './roles-page';
import {
  CATALOG,
  lastCreateBody,
  lastListParams,
  lastUpdateBody,
  makeRole,
  makeRoleWorld,
  serveRoles,
  type RoleWorld,
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

const mockGet = vi.mocked(apiGet);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockDelete = vi.mocked(apiDelete);

const MANAGE = ['role:read', 'role:create', 'role:update', 'role:delete'];
const READ_ONLY = ['role:read'];

let world: RoleWorld;

beforeEach(() => {
  vi.clearAllMocks();
  world = makeRoleWorld();
  serveRoles(world);
});

function render(permissions: string[] = MANAGE, extra: Record<string, unknown> = {}) {
  return renderWithProviders(<RolesPage />, { permissions, ...extra });
}

/** Abre o dialogo de cadastro e espera a matriz montar. */
async function openCreateDialog(): Promise<HTMLElement> {
  clickTrigger(await screen.findByRole('button', { name: 'Novo papel' }));
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByLabelText('Nome');
  return dialog;
}

describe('Listagem', () => {
  it('lista os papéis com origem e contagem de permissões', async () => {
    render();

    expect(await screen.findByText('SINDICO')).toBeInTheDocument();
    expect(screen.getByText('PORTARIA NOTURNA')).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
    expect(screen.getByText('Personalizado')).toBeInTheDocument();
  });

  it('busca aplica o termo e o filtro de origem aplica o parametro', async () => {
    const user = createUser();
    render();

    await screen.findByText('SINDICO');
    await user.type(screen.getByLabelText('Buscar'), 'portaria');

    await waitFor(() => expect(lastListParams()).toMatchObject({ search: 'portaria' }));
  });

  it('não dispara requisição escopada a condomínio', async () => {
    render();

    await screen.findByText('SINDICO');
    // Papel e por tenant: `RoleRepository` nao declara campo de condominio e a
    // whitelist de filtros tem uma chave so.
    expect(JSON.stringify(lastListParams())).not.toContain('condominium');
  });

  it('papel com acesso total mostra a tarja no lugar da contagem', async () => {
    world.roles = [makeRole({ id: 'role-1', name: 'SUPER ADMIN', permissions: ['*'] })];
    render();

    expect(await screen.findByText('Acesso total')).toBeInTheDocument();
  });

  it('sem resultado de busca, o estado vazio oferece limpar', async () => {
    const user = createUser();
    render();

    await screen.findByText('SINDICO');
    world.roles = [];
    await user.type(screen.getByLabelText('Buscar'), 'inexistente');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
  });
});

describe('Catálogo de permissões', () => {
  it('a matriz e montada a partir de GET /roles/permissions', async () => {
    render();

    await screen.findByText('SINDICO');
    await openCreateDialog();

    // A asserção é sobre a chamada: uma lista escrita no cliente divergiria do
    // servidor no primeiro recurso novo.
    expect(mockGet).toHaveBeenCalledWith('/roles/permissions');
  });

  it('as celulas saem do catálogo recebido, e não de uma lista local', async () => {
    // Um catalogo com um recurso so: se a tela tivesse lista propria, a matriz
    // mostraria os vinte e nove recursos do sistema.
    world.catalog = ['*', 'charge:read', 'charge:create'];
    render();

    await screen.findByText('SINDICO');
    const dialog = await openCreateDialog();

    expect(within(dialog).getByLabelText('Ver Cobranças')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Criar Cobranças')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Ver Reservas')).not.toBeInTheDocument();
  });

  it('ação ausente no catálogo rende traco, e não caixa desmarcada', async () => {
    // "Nao se aplica" e diferente de "existe e nao foi concedida".
    world.catalog = ['charge:read'];
    render();

    await screen.findByText('SINDICO');
    const dialog = await openCreateDialog();

    expect(within(dialog).getByLabelText('Ver Cobranças')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Excluir Cobranças')).not.toBeInTheDocument();
    expect(within(dialog).getAllByLabelText('Não se aplica').length).toBeGreaterThan(0);
  });

  it('falha no catálogo aparece no dialogo, sem matriz inventada', async () => {
    // Um 4xx de proposito: o `retry` do QueryProvider nao repete erro de cliente.
    mockGet.mockRejectedValue(new ApiError('Serviço indisponível.', 422, 'UNPROCESSABLE_ENTITY'));
    render();

    await screen.findByText('SINDICO');
    clickTrigger(screen.getByRole('button', { name: 'Novo papel' }));
    const dialog = await screen.findByRole('dialog');

    expect(
      await within(dialog).findByText(/Não foi possível carregar o catálogo/),
    ).toBeInTheDocument();
  });
});

describe('Cadastro', () => {
  it('envia nome, descrição e as permissões marcadas', async () => {
    const user = createUser();
    render();

    await screen.findByText('SINDICO');
    const dialog = await openCreateDialog();

    await user.type(within(dialog).getByLabelText('Nome'), 'PORTARIA DIURNA');
    await user.click(within(dialog).getByLabelText('Ver Cobranças'));
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/roles', expect.anything()));
    expect(lastCreateBody()).toEqual({
      name: 'PORTARIA DIURNA',
      description: null,
      permissions: ['charge:read'],
    });
  });

  it('sem nenhuma permissao marcada, não chega ao servidor', async () => {
    const user = createUser();
    render();

    await screen.findByText('SINDICO');
    const dialog = await openCreateDialog();

    await user.type(within(dialog).getByLabelText('Nome'), 'PAPEL VAZIO');
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    expect(
      await within(dialog).findByText('Selecione ao menos uma permissao.'),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('nome com acento e barrado antes de chegar ao servidor', async () => {
    const user = createUser();
    render();

    await screen.findByText('SINDICO');
    const dialog = await openCreateDialog();

    // A expressao de `createRoleSchema` e `/^[A-Za-z0-9_ -]+$/` — sem acento.
    // Barrar aqui evita um 422 cuja mensagem nao explicaria o porquê.
    await user.type(within(dialog).getByLabelText('Nome'), 'ZELADORIA SÃO JOÃO');
    await user.click(within(dialog).getByLabelText('Ver Cobranças'));
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    expect(
      await within(dialog).findByText(
        'Use apenas letras sem acento, números, espaco, hifen ou underscore.',
      ),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('o mesmo nome sem acento passa', async () => {
    const user = createUser();
    render();

    await screen.findByText('SINDICO');
    const dialog = await openCreateDialog();

    await user.type(within(dialog).getByLabelText('Nome'), 'ZELADORIA SAO JOAO');
    await user.click(within(dialog).getByLabelText('Ver Cobranças'));
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(lastCreateBody()).toMatchObject({ name: 'ZELADORIA SAO JOAO' });
  });

  it('nome duplicado (409) vira mensagem de formulário e preserva o marcado', async () => {
    const user = createUser();
    mockPost.mockRejectedValue(new ApiError('Já existe um papel com este nome.', 409, 'CONFLICT'));
    render();

    await screen.findByText('SINDICO');
    const dialog = await openCreateDialog();

    await user.type(within(dialog).getByLabelText('Nome'), 'SINDICO');
    await user.click(within(dialog).getByLabelText('Ver Cobranças'));
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    expect(
      await within(dialog).findByText('Já existe um papel com este nome.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Ver Cobranças')).toBeChecked();
  });

  it('duplo clique em cadastrar dispara uma requisição so', async () => {
    const user = createUser();
    render();

    await screen.findByText('SINDICO');
    const dialog = await openCreateDialog();

    await user.type(within(dialog).getByLabelText('Nome'), 'PORTARIA DIURNA');
    await user.click(within(dialog).getByLabelText('Ver Cobranças'));
    const submit = within(dialog).getByRole('button', { name: 'Cadastrar' });
    await user.click(submit);
    await user.click(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});

describe('O curinga', () => {
  it('não e oferecido a quem não e SUPER_ADMIN', async () => {
    render(MANAGE, { user: { role: 'ADMIN' } });

    await screen.findByText('SINDICO');
    const dialog = await openCreateDialog();

    // `roleService.assertPermissions` recusa a concessao; oferecer o controle
    // seria oferecer uma recusa.
    expect(within(dialog).queryByLabelText('Acesso total (*)')).not.toBeInTheDocument();
  });

  it('e oferecido a SUPER_ADMIN e vai no corpo', async () => {
    const user = createUser();
    render(MANAGE, { user: { role: 'SUPER_ADMIN' } });

    await screen.findByText('SINDICO');
    const dialog = await openCreateDialog();

    await user.type(within(dialog).getByLabelText('Nome'), 'OPERADOR PLATAFORMA');
    await user.click(within(dialog).getByLabelText('Acesso total (*)'));
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(lastCreateBody().permissions).toContain('*');
  });

  it('a recusa de concede-lo aparece como mensagem', async () => {
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError(
        'A permissao total (*) e exclusiva de operadores da plataforma.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    render(MANAGE, { user: { role: 'SUPER_ADMIN' } });

    await screen.findByText('SINDICO');
    const dialog = await openCreateDialog();

    await user.type(within(dialog).getByLabelText('Nome'), 'OPERADOR PLATAFORMA');
    await user.click(within(dialog).getByLabelText('Acesso total (*)'));
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    expect(await within(dialog).findByText(/exclusiva de operadores/)).toBeInTheDocument();
  });
});

describe('Papel do sistema', () => {
  it('abre com nome e permissões travados, e so a descrição editável', async () => {
    render();

    await screen.findByText('SINDICO');
    clickTrigger(screen.getByRole('button', { name: 'Editar SINDICO' }));
    const dialog = await screen.findByRole('dialog');

    expect(await within(dialog).findByLabelText('Nome')).toBeDisabled();
    expect(within(dialog).getByLabelText('Descrição')).toBeEnabled();
    expect(within(dialog).getByLabelText('Ver Cobranças')).toBeDisabled();
  });

  it('salva so a descrição — a chave permissions nem viaja', async () => {
    const user = createUser();
    render();

    await screen.findByText('SINDICO');
    clickTrigger(screen.getByRole('button', { name: 'Editar SINDICO' }));
    const dialog = await screen.findByRole('dialog');

    const description = await within(dialog).findByLabelText('Descrição');
    await user.clear(description);
    await user.type(description, 'Síndico do predio.');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    // `beforeUpdate` olha a *presenca* da chave, e nao o conteudo: reenviar as
    // mesmas permissoes seria recusado com 409.
    expect(lastUpdateBody()).toEqual({ description: 'Síndico do predio.' });
    expect(lastUpdateBody()).not.toHaveProperty('permissions');
    expect(lastUpdateBody()).not.toHaveProperty('name');
  });

  it('não oferece excluir, porque o servidor sempre recusa', async () => {
    render();

    await screen.findByText('SINDICO');
    expect(screen.queryByRole('button', { name: 'Excluir SINDICO' })).not.toBeInTheDocument();
    // O personalizado continua oferecendo.
    expect(screen.getByRole('button', { name: 'Excluir PORTARIA NOTURNA' })).toBeInTheDocument();
  });
});

describe('Ver permissões', () => {
  it('abre sem entrar em edição, e a matriz e somente leitura', async () => {
    render();

    await screen.findByText('SINDICO');
    clickTrigger(screen.getByRole('button', { name: 'Ver permissões de SINDICO' }));
    const dialog = await screen.findByRole('dialog');

    expect(await within(dialog).findByText('Permissões de SINDICO')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Ver Condomínios')).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
  });

  it('e oferecida mesmo sem permissao de escrita', async () => {
    render(READ_ONLY);

    await screen.findByText('SINDICO');
    expect(screen.getByRole('button', { name: 'Ver permissões de SINDICO' })).toBeInTheDocument();
  });

  it('reflete o que o papel tem, marcado e desmarcado', async () => {
    render();

    await screen.findByText('SINDICO');
    clickTrigger(screen.getByRole('button', { name: 'Ver permissões de SINDICO' }));
    const dialog = await screen.findByRole('dialog');

    // A fixture concede `condominium:read` e `reservation:manage`.
    expect(await within(dialog).findByLabelText('Ver Condomínios')).toBeChecked();
    expect(within(dialog).getByLabelText('Gerenciar Reservas')).toBeChecked();
    expect(within(dialog).getByLabelText('Excluir Condomínios')).not.toBeChecked();
  });
});

describe('Exclusao', () => {
  it('confirma antes de excluir', async () => {
    const user = createUser();
    render();

    await screen.findByText('PORTARIA NOTURNA');
    await user.click(screen.getByRole('button', { name: 'Excluir PORTARIA NOTURNA' }));

    expect(await screen.findByText('Excluir este papel?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/roles/role-2'));
  });

  it('recusa por usuários vinculados aparece na linha, e o papel fica', async () => {
    const user = createUser();
    mockDelete.mockRejectedValue(
      new ApiError(
        'Existem 3 usuário(s) com este papel. Reatribua-os antes de remover.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    render();

    await screen.findByText('PORTARIA NOTURNA');
    await user.click(screen.getByRole('button', { name: 'Excluir PORTARIA NOTURNA' }));
    await user.click(await screen.findByRole('button', { name: 'Excluir' }));

    expect(await screen.findByText(/Existem 3 usuário\(s\) com este papel/)).toBeInTheDocument();
    expect(screen.getByText('PORTARIA NOTURNA')).toBeInTheDocument();
  });
});

describe('Removidos', () => {
  it('o filtro envia includeDeleted e restaurar devolve o registro', async () => {
    const user = createUser();
    // O mundo passa a ter o papel removido antes do clique: ligar o filtro muda
    // a chave da consulta, entao a busca sai nova em vez de servir o cache do
    // recorte anterior.
    world.roles = [
      makeRole({
        id: 'role-2',
        name: 'PORTARIA NOTURNA',
        isSystem: false,
        deletedAt: '2026-02-01T10:00:00.000Z',
      }),
    ];
    render();

    await screen.findByText('PORTARIA NOTURNA');
    await user.click(screen.getByLabelText('Incluir removidos'));

    await waitFor(() => expect(lastListParams()).toMatchObject({ includeDeleted: true }));

    await user.click(await screen.findByRole('button', { name: 'Restaurar PORTARIA NOTURNA' }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/roles/role-2/restore'));
  });

  it('linha removida mostra a tarja e não oferece editar nem excluir', async () => {
    world.roles = [
      makeRole({
        id: 'role-2',
        name: 'PORTARIA NOTURNA',
        isSystem: false,
        deletedAt: '2026-02-01T10:00:00.000Z',
      }),
    ];
    render();

    expect(await screen.findByText('Removido')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Editar PORTARIA NOTURNA' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Excluir PORTARIA NOTURNA' }),
    ).not.toBeInTheDocument();
  });
});

describe('Permissao', () => {
  it('sem role:create, nao oferece cadastrar', async () => {
    render(READ_ONLY);

    await screen.findByText('SINDICO');
    expect(screen.queryByRole('button', { name: 'Novo papel' })).not.toBeInTheDocument();
  });

  it('sem role:update nem role:delete, so resta ver permissoes', async () => {
    render(READ_ONLY);

    await screen.findByText('SINDICO');
    expect(screen.queryByRole('button', { name: 'Editar SINDICO' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Excluir PORTARIA NOTURNA' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver permissões de SINDICO' })).toBeInTheDocument();
  });
});

describe('Catálogo completo', () => {
  it('agrupa os recursos em seções nomeadas', async () => {
    world.catalog = CATALOG;
    render();

    await screen.findByText('SINDICO');
    const dialog = await openCreateDialog();

    // Cobrancas em Financeiro, Reservas em Convivencia, Papeis em Administracao.
    expect(within(dialog).getByRole('heading', { name: 'Financeiro' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Convivência' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Administração' })).toBeInTheDocument();
  });

  it('recurso desconhecido aparece em Outros, e não some', async () => {
    world.catalog = ['recurso-novo:read', 'recurso-novo:manage'];
    render();

    await screen.findByText('SINDICO');
    const dialog = await openCreateDialog();

    expect(within(dialog).getByRole('heading', { name: 'Outros' })).toBeInTheDocument();
    // Sem rotulo cadastrado, o identificador tecnico aparece — visivelmente
    // incompleto, e nunca silenciosamente ausente.
    expect(within(dialog).getByLabelText('Ver recurso-novo')).toBeInTheDocument();
  });
});
