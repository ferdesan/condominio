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
import { AnnouncementsPage } from '../announcements-page';
import { CONTENT_MAX_LENGTH } from '../announcement-schema';
import { makeAnnouncement, serveAnnouncements, type AnnouncementWorld } from '../test-utils';

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

/** Mesmo custo de portal do Radix descrito em `announcements-page.test.tsx`. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockToastError = vi.mocked(toast.error);

let world: AnnouncementWorld;

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
  clickTrigger(screen.getByRole('button', { name: 'Novo comunicado' }));
  await screen.findByLabelText('Titulo');
}

function submitCreate(): void {
  clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));
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

describe('Cadastro de comunicado', () => {
  it('cadastra e a lista atualiza sem refetch manual', async () => {
    world = serveAnnouncements({ announcements: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.announcements = [makeAnnouncement({ title: 'Assembleia ordinaria' })];
      return world.announcements[0] as never;
    });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Nenhum comunicado registrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Assembleia ordinaria');
    await user.type(within(dialog()).getByLabelText('Conteudo'), 'Dia 20, as 19h, no salao.');
    selectOption(within(dialog()).getByLabelText('Categoria'), 'Assembleia');
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/announcements');
    expect(lastCreateBody()).toMatchObject({
      condominiumId: 'cond-1',
      title: 'Assembleia ordinaria',
      content: 'Dia 20, as 19h, no salao.',
      category: 'ASSEMBLY',
      // Os padroes do servidor, espelhados pelo formulario.
      audience: 'ALL',
      pinned: false,
      // Fora de `BLOCKS` a lista de blocos alvo e nula, e nao ausente.
      targetBlockIds: null,
    });
    // O comunicado nasce rascunho: quem o move sao as acoes de linha, e mandar
    // `status` daqui criaria um segundo caminho para a mesma transicao.
    expect(lastCreateBody()).not.toHaveProperty('status');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // A invalidacao da fabrica traz a linha nova: ninguem pediu refetch aqui.
    expect(await screen.findByText('Assembleia ordinaria')).toBeInTheDocument();
  });

  it('conteudo longo e aceito e enviado inteiro', async () => {
    world = serveAnnouncements({ announcements: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.announcements = [makeAnnouncement({ title: 'Regimento interno' })];
      return world.announcements[0] as never;
    });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Nenhum comunicado registrado');
    await openCreateDialog();

    const content = within(dialog()).getByLabelText('Conteudo');
    // O conteudo e texto longo: o controle tem de aceitar o teto do servidor, e
    // nao os 2000 caracteres que o `Textarea` traz por padrao — senao o proprio
    // campo cortaria o comunicado antes do envio.
    expect(content).toHaveAttribute('maxlength', String(CONTENT_MAX_LENGTH));

    const longBody = 'Artigo primeiro. '.repeat(400);
    expect(longBody.length).toBeGreaterThan(2000);

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Regimento interno');
    fill(content, longBody);
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    // Inteiro: nem o campo nem a conversao do corpo podem truncar.
    expect(lastCreateBody().content).toBe(longBody.trim());
    expect(String(lastCreateBody().content)).toHaveLength(longBody.trim().length);
  });

  it('sem titulo o envio para no proprio campo', async () => {
    world = serveAnnouncements({ announcements: [] });
    const user = createUser();
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Nenhum comunicado registrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Conteudo'), 'Conteudo sem titulo.');
    submitCreate();

    const message = await screen.findByText('Informe o titulo do comunicado.');
    // A objecao pertence ao campo do titulo, e nao ao formulario inteiro.
    expect(message).toHaveAttribute('id', 'title-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('publico por blocos exige escolher um bloco, e envia os escolhidos', async () => {
    world = serveAnnouncements({ announcements: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.announcements = [makeAnnouncement()];
      return world.announcements[0] as never;
    });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Nenhum comunicado registrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Obra na Torre A');
    await user.type(within(dialog()).getByLabelText('Conteudo'), 'Comeca na segunda-feira.');
    selectOption(within(dialog()).getByLabelText('Publico'), 'Blocos especificos');
    submitCreate();

    // A regra e do servidor (`assertAudience`), mas ele a recusa como 409 sem
    // caminho de campo — dita no campo ela tem conserto obvio.
    const message = await screen.findByText(
      'Selecione ao menos um bloco para o publico-alvo escolhido.',
    );
    expect(message).toHaveAttribute('id', 'targetBlockIds-error');
    expect(mockPost).not.toHaveBeenCalled();

    await user.click(within(dialog()).getByLabelText('Torre A'));
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody()).toMatchObject({
      audience: 'BLOCKS',
      targetBlockIds: ['block-1'],
    });
  });

  it('um 422 com campo aparece no campo, e sem toast', async () => {
    world = serveAnnouncements({ announcements: [] });
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
        { field: 'title', message: 'Ja existe um comunicado com este titulo.' },
      ]),
    );
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Nenhum comunicado registrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Assembleia ordinaria');
    await user.type(within(dialog()).getByLabelText('Conteudo'), 'Dia 20, as 19h.');
    submitCreate();

    const message = await screen.findByText('Ja existe um comunicado com este titulo.');
    expect(message).toHaveAttribute('id', 'title-error');
    // O formulario define `onError`, entao substitui o toast global em vez de
    // somar a ele: a mesma recusa nao pode aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('um 409 sem campo aparece como mensagem do formulario, preservando o preenchido', async () => {
    world = serveAnnouncements({ announcements: [] });
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError(
        'Informe ao menos um bloco para o publico-alvo selecionado.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Nenhum comunicado registrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Assembleia ordinaria');
    await user.type(within(dialog()).getByLabelText('Conteudo'), 'Dia 20, as 19h.');
    submitCreate();

    expect(
      await screen.findByText('Informe ao menos um bloco para o publico-alvo selecionado.'),
    ).toBeInTheDocument();
    // O dialogo fica, com os valores no lugar, para a correcao.
    expect(within(dialog()).getByLabelText('Titulo')).toHaveValue('Assembleia ordinaria');
    expect(within(dialog()).getByLabelText('Conteudo')).toHaveValue('Dia 20, as 19h.');
  });

  it('dois envios em sequencia produzem um unico POST', async () => {
    world = serveAnnouncements({ announcements: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.announcements = [makeAnnouncement()];
      return world.announcements[0] as never;
    });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Nenhum comunicado registrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Assembleia ordinaria');
    await user.type(within(dialog()).getByLabelText('Conteudo'), 'Dia 20, as 19h.');

    const submit = within(dialog()).getByRole('button', { name: 'Cadastrar' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('o formulario grava no condominio em que abriu, mesmo se o shell mudar', async () => {
    world = serveAnnouncements({ announcements: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.announcements = [makeAnnouncement()];
      return world.announcements[0] as never;
    });
    renderWithProviders(
      <SwitchableShell>
        <AnnouncementsPage />
      </SwitchableShell>,
    );

    await screen.findByText('Nenhum comunicado registrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Titulo'), 'Assembleia ordinaria');
    await user.type(within(dialog()).getByLabelText('Conteudo'), 'Dia 20, as 19h.');

    // Por papel nao da: o dialogo modal marca o resto da pagina como
    // `aria-hidden`, e `getByRole` nao enxerga fora da arvore acessivel.
    clickTrigger(screen.getByText('Trocar condominio'));

    // A divergencia entre o que o dialogo grava e o que a tela mostra e nomeada,
    // em vez de silenciosamente reapontada (US-027.EC-3).
    expect(await screen.findByText(/continua valendo para/i)).toBeInTheDocument();

    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody()).toMatchObject({ condominiumId: 'cond-1' });
  });
});

describe('Edicao de comunicado', () => {
  it('editar emite um unico PATCH e a linha reflete', async () => {
    world = serveAnnouncements({ announcements: [makeAnnouncement()] });
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.announcements = [makeAnnouncement({ category: 'URGENT', pinned: true })];
      return world.announcements[0] as never;
    });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Manutencao do elevador');
    clickTrigger(screen.getByRole('button', { name: 'Editar Manutencao do elevador' }));
    await screen.findByLabelText('Titulo');

    // Os valores atuais chegam preenchidos.
    expect(within(dialog()).getByLabelText('Titulo')).toHaveValue('Manutencao do elevador');
    expect(within(dialog()).getByLabelText('Conteudo')).toHaveValue(
      'O elevador da Torre A ficara parado na terca-feira, das 8h as 12h.',
    );

    selectOption(within(dialog()).getByLabelText('Categoria'), 'Urgente');
    await user.click(within(dialog()).getByLabelText('Fixar no topo do mural'));
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0][0]).toBe('/announcements/announcement-1');
    expect(lastUpdateBody()).toMatchObject({ category: 'URGENT', pinned: true });
    expect(await screen.findByText('Urgente')).toBeInTheDocument();
    // A fixacao aparece com forma propria, e nao so com uma cor.
    expect(await screen.findByLabelText('Fixado')).toBeInTheDocument();
  });
});
