import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiPatch, apiPost } from '@/lib/api';
import { CondominiumContext, type CondominiumContextValue } from '@/providers/condominium-context';
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
import { MaintenancesPage } from '../maintenances-page';
import { DESCRIPTION_MAX_LENGTH } from '../maintenance-schema';
import { makeMaintenance, serveMaintenances, type MaintenanceWorld } from '../test-utils';

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

/** Mesmo custo de portal do Radix descrito em `maintenances-page.test.tsx`. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockToastError = vi.mocked(toast.error);

let world: MaintenanceWorld;

const TITLE = 'Revisao do elevador social';

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
  clickTrigger(screen.getByRole('button', { name: 'Nova manutencao' }));
  await screen.findByLabelText('Titulo');
}

/** Abre o dialogo de edicao da ordem em tela. */
async function openEditDialog(): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: `Editar ${TITLE}` }));
  await screen.findByLabelText('Titulo');
}

function submitCreate(): void {
  clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));
}

function submitEdit(): void {
  clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));
}

/**
 * Texto longo entra pelo evento nativo, e nao tecla a tecla: `user.type` de
 * milhares de caracteres levaria minutos e o que se quer provar aqui e o corpo
 * enviado, nao a digitacao.
 */
function fill(field: HTMLElement, value: string): void {
  fireEvent.change(field, { target: { value } });
}

/**
 * Shell com condominio trocavel. O contexto de dentro vence o que
 * `renderWithProviders` monta, que e fixo por chamada e nao serviria para
 * observar a troca.
 */
function SwitchableShell({ children }: { children: ReactNode }) {
  const condominiums = [
    makeCondominium({ id: 'cond-1', name: 'Residencial Aurora' }),
    makeCondominium({ id: 'cond-2', name: 'Residencial Boreal' }),
  ];
  const [selectedId, setSelectedId] = useState('cond-1');
  const value: CondominiumContextValue = {
    condominiums,
    selected: condominiums.find((item) => item.id === selectedId) ?? null,
    selectedId,
    select: setSelectedId,
    isLoading: false,
  };
  return (
    <CondominiumContext.Provider value={value}>
      <button type="button" onClick={() => setSelectedId('cond-2')}>
        Trocar condominio
      </button>
      {children}
    </CondominiumContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Cadastro de manutencao', () => {
  it('cadastra e a lista atualiza sem refetch manual', async () => {
    world = serveMaintenances({ maintenances: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.maintenances = [makeMaintenance({ title: 'Troca do para-raios' })];
      return world.maintenances[0] as never;
    });
    renderWithProviders(<MaintenancesPage />);

    await screen.findByText('Nenhuma manutencao registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Troca do para-raios');
    fill(within(dialog()).getByLabelText('Agendamento'), '2026-05-12T14:30');
    selectOption(within(dialog()).getByLabelText('Tipo'), 'Inspecao');
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/maintenances');
    expect(lastCreateBody()).toMatchObject({
      condominiumId: 'cond-1',
      title: 'Troca do para-raios',
      scheduledFor: '2026-05-12T14:30',
      type: 'INSPECTION',
      // Os padroes do servidor, espelhados pelo formulario.
      recurrence: 'NONE',
      // Sem vinculo a chave vai nula, e nao ausente: limpar precisa apagar.
      description: null,
      assetName: null,
      serviceProviderId: null,
      responsibleId: null,
    });
    // A ordem nasce agendada: quem a move sao as acoes de linha, e mandar
    // `status` daqui criaria um segundo caminho para as mesmas transicoes.
    expect(lastCreateBody()).not.toHaveProperty('status');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // A invalidacao da fabrica traz a linha nova: ninguem pediu refetch aqui.
    expect(await screen.findByText('Troca do para-raios')).toBeInTheDocument();
  });

  it('descricao longa e aceita e enviada inteira', async () => {
    world = serveMaintenances({ maintenances: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.maintenances = [makeMaintenance({ title: 'Laudo do gerador' })];
      return world.maintenances[0] as never;
    });
    renderWithProviders(<MaintenancesPage />);

    await screen.findByText('Nenhuma manutencao registrada');
    await openCreateDialog();

    const description = within(dialog()).getByLabelText('Descricao');
    // O teto do servidor e 5000; o `Textarea` traz 2000 por padrao e cortaria o
    // texto antes do envio, sem acusar nada.
    expect(description).toHaveAttribute('maxlength', String(DESCRIPTION_MAX_LENGTH));

    const longBody = 'Conferir o item. '.repeat(200);
    expect(longBody.length).toBeGreaterThan(2000);

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Laudo do gerador');
    fill(within(dialog()).getByLabelText('Agendamento'), '2026-05-12T14:30');
    fill(description, longBody);
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    // Inteira: nem o campo nem a conversao do corpo podem truncar.
    expect(lastCreateBody().description).toBe(longBody.trim());
  });

  it('sem titulo o envio para no proprio campo', async () => {
    world = serveMaintenances({ maintenances: [] });
    renderWithProviders(<MaintenancesPage />);

    await screen.findByText('Nenhuma manutencao registrada');
    await openCreateDialog();

    fill(within(dialog()).getByLabelText('Agendamento'), '2026-05-12T14:30');
    submitCreate();

    const message = await screen.findByText('Informe o titulo da manutencao.');
    // A objecao pertence ao campo do titulo, e nao ao formulario inteiro.
    expect(message).toHaveAttribute('id', 'title-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('sem agendamento o envio para no proprio campo', async () => {
    world = serveMaintenances({ maintenances: [] });
    const user = createUser();
    renderWithProviders(<MaintenancesPage />);

    await screen.findByText('Nenhuma manutencao registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Troca do para-raios');
    submitCreate();

    // `scheduledFor` e obrigatorio em `createMaintenanceSchema`; o formulario o
    // cobra antes de gastar uma requisicao.
    const message = await screen.findByText('Informe quando a manutencao esta agendada.');
    expect(message).toHaveAttribute('id', 'scheduledFor-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('os dois vinculos sao escopados ao condominio', async () => {
    world = serveMaintenances({ maintenances: [] });
    world.users = [
      world.users[0],
      {
        ...world.users[0],
        id: 'user-3',
        name: 'Paulo Nunes',
        condominiums: [{ id: 'cond-9', name: 'Residencial Boreal' }],
      },
    ];
    renderWithProviders(<MaintenancesPage />);

    await screen.findByText('Nenhuma manutencao registrada');
    await openCreateDialog();

    // O prestador e escopado pelo servidor (`condominiumId` esta na whitelist);
    // o responsavel e recortado no cliente, porque `/users` e por tenant.
    selectOption(within(dialog()).getByLabelText('Prestador'), 'Limpeza Total');
    selectOption(within(dialog()).getByLabelText('Responsavel'), 'Joana Ribeiro');
    expect(screen.queryByRole('option', { name: 'Paulo Nunes' })).not.toBeInTheDocument();

    await createUser().type(within(dialog()).getByLabelText('Titulo'), 'Limpeza da fachada');
    fill(within(dialog()).getByLabelText('Agendamento'), '2026-05-12T14:30');
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody()).toMatchObject({
      serviceProviderId: 'provider-1',
      responsibleId: 'user-2',
    });
  });

  it('dois cliques em cadastrar disparam uma requisicao so', async () => {
    world = serveMaintenances({ maintenances: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.maintenances = [makeMaintenance()];
      return world.maintenances[0] as never;
    });
    renderWithProviders(<MaintenancesPage />);

    await screen.findByText('Nenhuma manutencao registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Troca do para-raios');
    fill(within(dialog()).getByLabelText('Agendamento'), '2026-05-12T14:30');

    const submit = within(dialog()).getByRole('button', { name: 'Cadastrar' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });
});

describe('Edicao de manutencao', () => {
  it('edita e a lista atualiza sem refetch manual', async () => {
    world = serveMaintenances({ maintenances: [makeMaintenance()] });
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.maintenances = [makeMaintenance({ title: 'Revisao anual do elevador' })];
      return world.maintenances[0] as never;
    });
    renderWithProviders(<MaintenancesPage />);

    await screen.findByText(TITLE);
    await openEditDialog();

    const title = within(dialog()).getByLabelText('Titulo');
    // O formulario abre com o registro carregado, e nao em branco.
    expect(title).toHaveValue(TITLE);
    await user.clear(title);
    await user.type(title, 'Revisao anual do elevador');
    submitEdit();

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0][0]).toBe('/maintenances/maintenance-1');
    expect(lastUpdateBody()).toMatchObject({ title: 'Revisao anual do elevador' });
    // `status` nunca vai pelo PATCH: `prepareUpdate` so barra o retorno a partir
    // de `COMPLETED`, entao ele aceitaria pular direto para concluida sem
    // registrar `completedAt` nem abrir a proxima ordem recorrente.
    expect(lastUpdateBody()).not.toHaveProperty('status');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Revisao anual do elevador')).toBeInTheDocument();
  });

  it('trocar de condominio com o formulario aberto avisa, e nao muda o destino', async () => {
    world = serveMaintenances({ maintenances: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.maintenances = [makeMaintenance()];
      return world.maintenances[0] as never;
    });
    renderWithProviders(
      <SwitchableShell>
        <MaintenancesPage />
      </SwitchableShell>,
    );

    await screen.findByText('Nenhuma manutencao registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Troca do para-raios');
    fill(within(dialog()).getByLabelText('Agendamento'), '2026-05-12T14:30');

    // Por papel nao da: o dialogo modal marca o resto da pagina como
    // `aria-hidden`, e `getByRole` nao enxerga fora da arvore acessivel.
    clickTrigger(screen.getByText('Trocar condominio'));

    // O aviso nomeia a divergencia; o formulario continua valendo para o predio
    // em que foi aberto (US-027.EC-3).
    expect(await screen.findByText(/continua valendo para/i)).toBeInTheDocument();
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody().condominiumId).toBe('cond-1');
  });
});

describe('Erros do servidor no formulario de manutencao', () => {
  it('um 422 aponta o campo e nao levanta toast', async () => {
    world = serveMaintenances({ maintenances: [] });
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
        { field: 'title', message: 'Informe o titulo da manutencao.' },
      ]),
    );
    renderWithProviders(<MaintenancesPage />);

    await screen.findByText('Nenhuma manutencao registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Ab');
    fill(within(dialog()).getByLabelText('Agendamento'), '2026-05-12T14:30');
    submitCreate();

    const message = await screen.findByText('Informe o titulo da manutencao.');
    expect(message).toHaveAttribute('id', 'title-error');
    // O `onError` do formulario substitui o toast global: a objecao ja esta no
    // campo e nao deve aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('um 409 vira mensagem do formulario e preserva o que foi preenchido', async () => {
    world = serveMaintenances({ maintenances: [] });
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Prestador de servico nao encontrado.', 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderWithProviders(<MaintenancesPage />);

    await screen.findByText('Nenhuma manutencao registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Troca do para-raios');
    fill(within(dialog()).getByLabelText('Descricao'), 'Substituir o captor e o cabo de descida.');
    fill(within(dialog()).getByLabelText('Agendamento'), '2026-05-12T14:30');
    submitCreate();

    // Um 409 vem sem caminho de campo: a mensagem pertence ao formulario inteiro.
    const alert = await within(dialog()).findByRole('alert');
    expect(alert).toHaveTextContent('Prestador de servico nao encontrado.');
    expect(mockToastError).not.toHaveBeenCalled();

    // Nada do que foi digitado se perde: refazer o preenchimento seria a punicao
    // errada para um conflito que nao e do usuario.
    expect(within(dialog()).getByLabelText('Titulo')).toHaveValue('Troca do para-raios');
    expect(within(dialog()).getByLabelText('Descricao')).toHaveValue(
      'Substituir o captor e o cabo de descida.',
    );
    expect(within(dialog()).getByLabelText('Agendamento')).toHaveValue('2026-05-12T14:30');
  });
});
