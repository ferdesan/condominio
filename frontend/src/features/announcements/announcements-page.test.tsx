import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGet, apiGetPaginated, apiPost } from '@/lib/api';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Announcement } from '@/types/announcement';
import { AnnouncementsPage } from './announcements-page';
import {
  lastListParams,
  makeAnnouncement,
  serveAnnouncements,
  type AnnouncementWorld,
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

let world: AnnouncementWorld;

/** Comunicados com titulos previsiveis, para conferir qual pagina chegou. */
function makeRoster(count: number, offset = 0): Announcement[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeAnnouncement({
      id: `announcement-${position}`,
      title: `Aviso ${String(position).padStart(2, '0')}`,
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

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de comunicados', () => {
  it('percorre busca e os quatro filtros preservando os parametros', async () => {
    world = serveAnnouncements({ announcements: [makeAnnouncement()] });
    const user = createUser();
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Manutencao do elevador');
    // Toda consulta nasce presa ao condominio escolhido no shell.
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'elevador');
    await waitFor(() => expect(lastListParams().search).toBe('elevador'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta.
    selectOption(screen.getByLabelText('Status'), 'Rascunho');
    expect(lastListParams().status).toBe('DRAFT');

    selectOption(screen.getByLabelText('Categoria'), 'Assembleia');
    expect(lastListParams().category).toBe('ASSEMBLY');

    selectOption(screen.getByLabelText('Publico'), 'Proprietarios');
    expect(lastListParams().audience).toBe('OWNERS');

    selectOption(screen.getByLabelText('Fixacao'), 'Somente fixados');
    expect(lastListParams().pinned).toBe('true');

    // Os controles se somam em vez de se substituirem.
    expect(lastListParams()).toMatchObject({
      condominiumId: 'cond-1',
      search: 'elevador',
      status: 'DRAFT',
      category: 'ASSEMBLY',
      audience: 'OWNERS',
      pinned: 'true',
    });
  });

  it('ordenar por uma coluna envia sortOrder em maiusculas', async () => {
    world = serveAnnouncements({ announcements: [makeAnnouncement()] });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Manutencao do elevador');

    clickTrigger(screen.getByRole('button', { name: 'Titulo' }));
    await waitFor(() => expect(lastListParams().sortBy).toBe('title'));
    expect(lastListParams().sortOrder).toBe('ASC');

    // A tabela alterna a direcao; a traducao para a caixa da API e da camada de
    // dados, e e ela que precisa continuar valendo (ADR-009).
    clickTrigger(screen.getByRole('button', { name: 'Titulo' }));
    await waitFor(() => expect(lastListParams().sortOrder).toBe('DESC'));
    expect(lastListParams().sortBy).toBe('title');
  });

  it('trezentos comunicados paginam no tamanho pedido', async () => {
    world = serveAnnouncements({ announcements: makeRoster(20), total: 300 });
    const user = createUser();
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Aviso 01');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams().perPage).toBe(20);

    world.announcements = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /proxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Aviso 21')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });

  it('campos ausentes viram placeholder, nunca a string "null"', async () => {
    world = serveAnnouncements({
      announcements: [makeAnnouncement({ publishedAt: null, authorName: null, authorId: null })],
    });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Manutencao do elevador');

    // Um rascunho ainda nao tem data de publicacao: o placeholder neutro diz a
    // ausencia sem inventar um valor.
    expect(cellsOf('Publicado em')).toEqual(['—']);
    // Autor ausente e um estado nomeado, e nao um dado faltando.
    expect(cellsOf('Autor')).toEqual(['Autor nao registrado']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('nenhum controle e oferecido para filtro fora da whitelist do servidor', async () => {
    world = serveAnnouncements({ announcements: [makeAnnouncement()] });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Manutencao do elevador');

    // Whitelist do servidor: condominiumId (vem do shell), status, category,
    // audience e pinned. Qualquer outro controle pareceria funcionar enquanto o
    // backend o descarta em silencio.
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
    expect(screen.getByLabelText('Publico')).toBeInTheDocument();
    expect(screen.getByLabelText('Fixacao')).toBeInTheDocument();

    for (const absent of ['Autor', 'Publicado em', 'Conteudo']) {
      expect(screen.queryByLabelText(absent)).not.toBeInTheDocument();
    }

    // `publishedAt` e a ordem padrao do servidor, mas nao esta no conjunto
    // ordenavel dele — uma coluna que se oferecesse para ordenar seria
    // descartada em silencio e a lista voltaria igual.
    const header = within(screen.getAllByRole('row')[0])
      .getAllByRole('columnheader')
      .find((item) => item.textContent?.trim().startsWith('Publicado em'));
    expect(within(header as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Estados vazios de comunicados', () => {
  it('lista vazia oferece o cadastro', async () => {
    world = serveAnnouncements({ announcements: [] });
    renderWithProviders(<AnnouncementsPage />);

    expect(await screen.findByText('Nenhum comunicado registrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Redigir comunicado' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum resultado para esta busca')).not.toBeInTheDocument();
  });

  it('busca sem resultado oferece limpar, e e distinta da lista vazia', async () => {
    world = serveAnnouncements({ announcements: [makeAnnouncement()] });
    const user = createUser();
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Manutencao do elevador');
    world.announcements = [];
    await user.type(screen.getByLabelText('Buscar'), 'Nada');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    // Os dois vazios sao estados diferentes e dizem coisas diferentes.
    expect(screen.queryByText('Nenhum comunicado registrado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Redigir comunicado' })).not.toBeInTheDocument();
  });
});

describe('Ciclo de vida do comunicado', () => {
  it('um rascunho oferece publicar e nao oferece arquivar', async () => {
    world = serveAnnouncements({ announcements: [makeAnnouncement({ status: 'DRAFT' })] });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Manutencao do elevador');

    expect(
      screen.getByRole('button', { name: 'Publicar Manutencao do elevador' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Arquivar/ })).not.toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });

  it('um publicado oferece arquivar e nao oferece publicar', async () => {
    world = serveAnnouncements({
      announcements: [
        makeAnnouncement({ status: 'PUBLISHED', publishedAt: '2026-03-11T10:00:00.000Z' }),
      ],
    });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Manutencao do elevador');

    expect(
      screen.getByRole('button', { name: 'Arquivar Manutencao do elevador' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Publicar/ })).not.toBeInTheDocument();
    expect(screen.getByText('Publicado')).toBeInTheDocument();
  });

  it('um arquivado nao oferece nenhuma das duas', async () => {
    world = serveAnnouncements({
      announcements: [
        makeAnnouncement({ status: 'ARCHIVED', publishedAt: '2026-03-11T10:00:00.000Z' }),
      ],
    });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Manutencao do elevador');

    // O ciclo e fechado: o servidor recusa publicar o arquivado, e arquivar de
    // novo nao teria efeito. Editar continua oferecido.
    expect(screen.queryByRole('button', { name: /^Publicar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Arquivar/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Editar Manutencao do elevador' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Arquivado')).toBeInTheDocument();
  });

  it('publicar muda o status na lista', async () => {
    world = serveAnnouncements({ announcements: [makeAnnouncement({ status: 'DRAFT' })] });
    mockPost.mockImplementation(async (url) => {
      if (url !== '/announcements/announcement-1/publish') {
        throw new Error(`URL inesperada: ${url}`);
      }
      world.announcements = [
        makeAnnouncement({ status: 'PUBLISHED', publishedAt: '2026-03-12T09:00:00.000Z' }),
      ];
      return world.announcements[0] as never;
    });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Rascunho');
    clickTrigger(screen.getByRole('button', { name: 'Publicar Manutencao do elevador' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/announcements/announcement-1/publish');

    // A invalidacao da acao traz a lista nova: o status acompanha, e agora e a
    // vez de arquivar.
    expect(await screen.findByText('Publicado')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Arquivar Manutencao do elevador' }),
      ).toBeInTheDocument(),
    );
  });

  it('arquivar muda o status na lista', async () => {
    world = serveAnnouncements({
      announcements: [
        makeAnnouncement({ status: 'PUBLISHED', publishedAt: '2026-03-11T10:00:00.000Z' }),
      ],
    });
    mockPost.mockImplementation(async (url) => {
      if (url !== '/announcements/announcement-1/archive') {
        throw new Error(`URL inesperada: ${url}`);
      }
      world.announcements = [
        makeAnnouncement({ status: 'ARCHIVED', publishedAt: '2026-03-11T10:00:00.000Z' }),
      ];
      return world.announcements[0] as never;
    });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Publicado');
    clickTrigger(screen.getByRole('button', { name: 'Arquivar Manutencao do elevador' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/announcements/announcement-1/archive');
    expect(await screen.findByText('Arquivado')).toBeInTheDocument();
  });

  it('a recusa do servidor numa transicao aparece na linha, e o status nao muda', async () => {
    // O rascunho foi publicado por outra pessoa enquanto esta lista estava
    // aberta: a tela ainda o mostra como rascunho, e o servidor recusa.
    world = serveAnnouncements({ announcements: [makeAnnouncement({ status: 'DRAFT' })] });
    mockPost.mockRejectedValue(
      new ApiError('Comunicado ja esta publicado.', 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Rascunho');
    clickTrigger(screen.getByRole('button', { name: 'Publicar Manutencao do elevador' }));

    const message = await screen.findByText('Comunicado ja esta publicado.');
    // A recusa aparece onde a acao foi tomada, e o registro continua como estava.
    expect(message).toHaveAttribute('role', 'alert');
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    // O `onError` proprio substitui o toast global: a mesma recusa nao pode
    // aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('dois cliques em publicar disparam uma requisicao so', async () => {
    world = serveAnnouncements({ announcements: [makeAnnouncement({ status: 'DRAFT' })] });
    mockPost.mockImplementation(async () => {
      world.announcements = [makeAnnouncement({ status: 'PUBLISHED' })];
      return world.announcements[0] as never;
    });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Rascunho');
    const button = screen.getByRole('button', { name: 'Publicar Manutencao do elevador' });
    clickTrigger(button);
    clickTrigger(button);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });
});

describe('Exclusao e restauracao de comunicados', () => {
  it('excluir pede confirmacao antes de remover', async () => {
    world = serveAnnouncements({ announcements: [makeAnnouncement()] });
    mockDelete.mockImplementation(async () => {
      world.announcements = [];
    });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Manutencao do elevador');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Manutencao do elevador' }));

    // O pedido so sai depois da confirmacao.
    expect(await screen.findByText('Excluir comunicado?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/announcements/announcement-1'));
    await waitFor(() =>
      expect(screen.queryByText('Manutencao do elevador')).not.toBeInTheDocument(),
    );
  });

  it('um 409 de impedimento mostra a mensagem do servidor e mantem o registro', async () => {
    world = serveAnnouncements({ announcements: [makeAnnouncement()] });
    mockDelete.mockRejectedValue(
      new ApiError('Comunicado publicado nao pode ser excluido.', 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Manutencao do elevador');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Manutencao do elevador' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    // A exclusao nao passa `onError`, entao herda o toast global — que e a
    // apresentacao certa para um 409 que traz so a mensagem do servidor.
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('Comunicado publicado nao pode ser excluido.'),
    );
    expect(screen.getByText('Manutencao do elevador')).toBeInTheDocument();
  });

  it('incluir removidos envia includeDeleted, e restaurar devolve o registro', async () => {
    world = serveAnnouncements({
      announcements: [makeAnnouncement({ deletedAt: '2026-03-11T10:00:00.000Z' })],
    });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.announcements = [makeAnnouncement({ deletedAt: null })];
      return world.announcements[0] as never;
    });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Manutencao do elevador');
    await user.click(screen.getByLabelText('Incluir removidos'));

    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));
    expect(screen.getByText('Removido')).toBeInTheDocument();

    clickTrigger(await screen.findByRole('button', { name: 'Restaurar Manutencao do elevador' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/announcements/announcement-1/restore'),
    );
    await waitFor(() => expect(screen.queryByText('Removido')).not.toBeInTheDocument());
  });
});

describe('Escopo e permissoes de comunicados', () => {
  it('sem condominio selecionado a tela explica a exigencia e nao consulta', async () => {
    world = serveAnnouncements({ announcements: [makeAnnouncement()] });
    renderWithProviders(<AnnouncementsPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condominio')).toBeInTheDocument();
    // Nem a listagem nem a colecao de blocos saem sem condominio.
    expect(mockGetPaginated).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('um operador sem update nao recebe as acoes do ciclo', async () => {
    world = serveAnnouncements({ announcements: [makeAnnouncement({ status: 'DRAFT' })] });
    renderWithProviders(<AnnouncementsPage />, {
      role: 'STAFF',
      permissions: ['announcement:read'],
    });

    await screen.findByText('Manutencao do elevador');

    // Publicar e arquivar exigem `announcement:update`; a interface nao oferece
    // o que o servidor recusaria.
    expect(screen.queryByRole('button', { name: /^Publicar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Arquivar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo comunicado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
  });

  it('um operador nao ve restaurar nas linhas removidas', async () => {
    world = serveAnnouncements({
      announcements: [makeAnnouncement({ deletedAt: '2026-03-11T10:00:00.000Z' })],
    });
    const user = createUser();
    renderWithProviders(<AnnouncementsPage />, {
      role: 'STAFF',
      permissions: ['announcement:read'],
    });

    await screen.findByText('Manutencao do elevador');
    // Ver removidos e leitura; restaurar exige `update` (ADR-006).
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(await screen.findByText('Removido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });

  it('a colecao de blocos tambem fica presa ao condominio do shell', async () => {
    world = serveAnnouncements({ announcements: [makeAnnouncement()] });
    renderWithProviders(<AnnouncementsPage />);

    await screen.findByText('Manutencao do elevador');

    const call = mockGetPaginated.mock.calls.find(([url]) => url === '/blocks');
    expect((call?.[1]?.params ?? {}) as Record<string, unknown>).toMatchObject({
      condominiumId: 'cond-1',
    });
  });
});
