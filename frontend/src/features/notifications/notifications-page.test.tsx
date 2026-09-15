import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError, apiGetPaginated, apiPost, apiPatch, apiDelete } from '@/lib/api';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { AppNotification } from '@/types/notification';
import { NotificationsPage } from './notifications-page';
import {
  allReadRequests,
  lastListParams,
  makeNotification,
  serveNotifications,
  type NotificationWorld,
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
const mockPatch = vi.mocked(apiPatch);
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

let world: NotificationWorld;

const TITLE = 'Reserva aprovada';
const READ_AT = '2026-03-11T09:00:00.000Z';

/** Permissoes de quem le a central mas nao pode registrar leitura. */
const READ_WITHOUT_UPDATE = ['notification:read'];

/** Notificacoes com assuntos previsiveis, para conferir qual pagina chegou. */
function makeInbox(count: number, offset = 0): AppNotification[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeNotification({
      id: `notification-${position}`,
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

/** O indicador de nao lidas, que e a unica regiao nomeada da tela. */
function summary(): HTMLElement {
  return screen.getByRole('region', { name: 'Resumo da central' });
}

/**
 * Espera as linhas chegarem.
 *
 * A tabela existe desde o primeiro quadro, com uma linha de "Carregando..." no
 * lugar dos dados; quem prova que a resposta chegou e o assunto da notificacao.
 */
async function findRows(title: string = TITLE): Promise<HTMLElement> {
  return screen.findByText(title);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem da central', () => {
  it('distingue lida de nao lida por texto, e nao so por cor', async () => {
    world = serveNotifications({
      notifications: [
        makeNotification(),
        makeNotification({ id: 'notification-2', title: 'Encomenda na portaria', readAt: READ_AT }),
      ],
      unread: 1,
    });
    renderWithProviders(<NotificationsPage />);

    await findRows();

    // A tarja nomeia o estado: cor sozinha nao distingue lida de nao lida.
    expect(cellsOf('Situacao')).toEqual(['Nao lida', 'Lida']);
  });

  it('lista paginada pede a proxima pagina com os parametros certos', async () => {
    world = serveNotifications({ notifications: makeInbox(20), unread: 20, total: 300 });
    const user = createUser();
    renderWithProviders(<NotificationsPage />);

    await screen.findByText('Aviso 01');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams().perPage).toBe(20);

    world.notifications = makeInbox(20, 20);
    await user.click(screen.getByRole('button', { name: /proxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Aviso 21')).toBeInTheDocument();
  });

  it('busca e filtro de tipo se somam, e nenhum recorte por condominio e enviado', async () => {
    world = serveNotifications({ notifications: [makeNotification()], unread: 1 });
    const user = createUser();
    renderWithProviders(<NotificationsPage />);

    await findRows();

    await user.type(screen.getByLabelText('Buscar'), 'reserva');
    await waitFor(() => expect(lastListParams().search).toBe('reserva'));

    selectOption(screen.getByLabelText('Tipo'), 'Reserva');
    expect(lastListParams().type).toBe('RESERVATION');

    expect(lastListParams()).toMatchObject({ search: 'reserva', type: 'RESERVATION' });
    // A central e da pessoa: recortar por condominio esconderia justamente as
    // notificacoes do tenant inteiro, que tem a coluna nula.
    for (const request of allReadRequests()) {
      expect(request.params, request.url).not.toHaveProperty('condominiumId');
    }
    expect(lastListParams()).not.toHaveProperty('userId');
  });

  it('lista vazia renderiza estado vazio, e nao tabela em branco', async () => {
    world = serveNotifications({ notifications: [], unread: 0 });
    renderWithProviders(<NotificationsPage />);

    expect(await screen.findByText('Nenhuma notificacao ate agora')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('Contagem de nao lidas', () => {
  it('vem do endpoint dedicado, e nao do total da listagem', async () => {
    // O total da lista e um; a contagem e tres. Se a tela lesse `meta.total`,
    // mostraria o numero errado.
    world = serveNotifications({ notifications: [makeNotification()], unread: 3 });
    renderWithProviders(<NotificationsPage />);

    await findRows();

    expect(await within(summary()).findByText('3')).toBeInTheDocument();
    expect(allReadRequests().map((request) => request.url)).toContain(
      '/notifications/unread-count',
    );
  });

  it('contagem zero aparece como zero, e nao some', async () => {
    world = serveNotifications({
      notifications: [makeNotification({ readAt: READ_AT })],
      unread: 0,
    });
    renderWithProviders(<NotificationsPage />);

    await findRows();

    // Zero e um resultado: esconder o indicador trocaria "nada pendente" por
    // "nao sabemos", que sao coisas diferentes para quem acabou de limpar a fila.
    expect(await within(summary()).findByText('0')).toBeInTheDocument();
  });
});

describe('Marcar como lida', () => {
  it('reduz a contagem e muda a aparencia da entrada', async () => {
    world = serveNotifications({ notifications: [makeNotification()], unread: 3 });
    mockPost.mockImplementation(async () => {
      world.notifications = [makeNotification({ readAt: READ_AT })];
      world.unread = 2;
      return { updated: 1 } as never;
    });
    renderWithProviders(<NotificationsPage />);

    await findRows();
    expect(await within(summary()).findByText('3')).toBeInTheDocument();

    clickTrigger(screen.getByRole('button', { name: `Marcar ${TITLE} como lida` }));

    // A invalidacao alcanca a lista e a contagem, que voltam coerentes.
    expect(await within(summary()).findByText('2')).toBeInTheDocument();
    await waitFor(() => expect(cellsOf('Situacao')).toEqual(['Lida']));
    expect(mockPost).toHaveBeenCalledWith('/notifications/read', { ids: ['notification-1'] });
  });

  it('dois cliques em sequencia disparam uma requisicao so', async () => {
    world = serveNotifications({ notifications: [makeNotification()], unread: 1 });
    mockPost.mockImplementation(async () => {
      world.notifications = [makeNotification({ readAt: READ_AT })];
      world.unread = 0;
      return { updated: 1 } as never;
    });
    renderWithProviders(<NotificationsPage />);

    await findRows();
    const button = screen.getByRole('button', { name: `Marcar ${TITLE} como lida` });
    clickTrigger(button);
    clickTrigger(button);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('marcar todas manda o corpo sem ids, que e o que o servidor le como "todas"', async () => {
    world = serveNotifications({
      notifications: [
        makeNotification(),
        makeNotification({ id: 'notification-2', title: 'Encomenda na portaria' }),
      ],
      unread: 2,
    });
    mockPost.mockImplementation(async () => {
      world.notifications = world.notifications.map((item) => ({ ...item, readAt: READ_AT }));
      world.unread = 0;
      return { updated: 2 } as never;
    });
    renderWithProviders(<NotificationsPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: 'Marcar todas como lidas' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/notifications/read', {}));
    expect(await within(summary()).findByText('0')).toBeInTheDocument();
  });

  it('a recusa do servidor aparece na linha, sem duplicar em toast', async () => {
    world = serveNotifications({ notifications: [makeNotification()], unread: 1 });
    mockPost.mockRejectedValue(new ApiError('Notificacao ja marcada como lida.', 409, 'CONFLICT'));
    renderWithProviders(<NotificationsPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Marcar ${TITLE} como lida` }));

    const message = await screen.findByText('Notificacao ja marcada como lida.');
    expect(message).toHaveAttribute('role', 'alert');
    // O `onError` proprio substitui o toast global: a mesma recusa nao pode
    // aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('sem notification:update, marcar nao e oferecido em lugar nenhum', async () => {
    world = serveNotifications({ notifications: [makeNotification()], unread: 1 });
    renderWithProviders(<NotificationsPage />, { permissions: READ_WITHOUT_UPDATE });

    await findRows();

    expect(
      screen.queryByRole('button', { name: `Marcar ${TITLE} como lida` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Marcar todas como lidas' }),
    ).not.toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe('Tela de origem', () => {
  /** Monta a central junto dos destinos que o teste quer alcancar. */
  function renderWithDestinations(paths: string[]) {
    return renderWithProviders(
      <Routes>
        <Route path="/notificacoes" element={<NotificationsPage />} />
        {paths.map((path) => (
          <Route key={path} path={path} element={<p>{`Cheguei em ${path}`}</p>} />
        ))}
      </Routes>,
      { route: '/notificacoes' },
    );
  }

  it('entrada apontando para uma tela existente navega ate ela', async () => {
    world = serveNotifications({
      notifications: [
        makeNotification({
          title: 'Comunicado publicado',
          type: 'ANNOUNCEMENT',
          actionUrl: '/comunicados',
        }),
      ],
      unread: 1,
    });
    const user = createUser();
    renderWithDestinations(['/comunicados']);

    await findRows('Comunicado publicado');
    await user.click(screen.getByRole('link', { name: 'Abrir origem de Comunicado publicado' }));

    expect(await screen.findByText('Cheguei em /comunicados')).toBeInTheDocument();
  });

  it('entrada apontando para rota inexistente cai na listagem do modulo', async () => {
    // `/reservas/{id}` e o que o servidor grava, e essa rota nao existe: por
    // ADR-004 a reserva vive em dialogo sobre a listagem.
    world = serveNotifications({ notifications: [makeNotification()], unread: 1 });
    const user = createUser();
    renderWithDestinations(['/reservas']);

    await findRows();
    const link = screen.getByRole('link', { name: `Abrir origem de ${TITLE}` });
    expect(link).toHaveAttribute('href', '/reservas');

    await user.click(link);
    // Nem tela em branco, nem link quebrado: o destino e a lista do modulo.
    expect(await screen.findByText('Cheguei em /reservas')).toBeInTheDocument();
  });

  it('entrada sem actionUrl nao oferece link', async () => {
    world = serveNotifications({
      notifications: [makeNotification({ title: 'Aviso geral', actionUrl: null })],
      unread: 1,
    });
    renderWithProviders(<NotificationsPage />);

    await findRows('Aviso geral');

    expect(screen.queryByRole('link', { name: /^Abrir origem/ })).not.toBeInTheDocument();
    expect(screen.getByText('Sem tela de origem')).toBeInTheDocument();
  });

  it('entrada apontando para modulo que nao existe no menu tambem nao oferece link', async () => {
    world = serveNotifications({
      notifications: [
        makeNotification({ title: 'Relatorio pronto', actionUrl: '/relatorios/2026-03' }),
      ],
      unread: 1,
    });
    renderWithProviders(<NotificationsPage />);

    await findRows('Relatorio pronto');

    // Prometer navegacao e entregar 404 e pior do que dizer que nao ha destino.
    expect(screen.queryByRole('link', { name: /^Abrir origem/ })).not.toBeInTheDocument();
    expect(screen.getByText('Sem tela de origem')).toBeInTheDocument();
  });
});

describe('Central somente leitura', () => {
  it('nao oferece criar, editar, excluir nem restaurar', async () => {
    world = serveNotifications({ notifications: [makeNotification()], unread: 1 });
    renderWithProviders(<NotificationsPage />);

    await findRows();

    const writeActions = screen
      .queryAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '')
      .map((label) => label.trim())
      .filter((label) => /^(Nov[ao] |Cadastrar|Criar|Editar|Excluir|Restaurar|Salvar)/.test(label));

    expect(writeActions).toEqual([]);
    expect(mockPatch).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    // A unica escrita possivel e a marcacao de leitura, que so sai por clique.
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockGetPaginated).toHaveBeenCalled();
  });
});
