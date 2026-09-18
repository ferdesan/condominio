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
import type { Correspondence } from '@/types/correspondence';
import { CorrespondencesPage } from './correspondences-page';
import {
  lastListParams,
  makeCorrespondence,
  pendingCountRequests,
  serveCorrespondences,
  type CorrespondenceWorld,
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

let world: CorrespondenceWorld;

/** Correspondencias com descricoes previsiveis, para conferir qual pagina chegou. */
function makeRoster(count: number, offset = 0): Correspondence[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeCorrespondence({
      id: `correspondence-${position}`,
      description: `Volume ${String(position).padStart(2, '0')}`,
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

/** O que o contador dedicado esta mostrando agora. */
function pendingBadge(): string {
  const button = screen.getByRole('button', { name: /Fila de retirada/ });
  return within(button).getByText(/^(\d+|—)$/).textContent ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de correspondências', () => {
  it('percorre busca e os quatro filtros preservando os parametros', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()] });
    const user = createUser();
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa média');
    // Toda consulta nasce presa ao condominio escolhido no shell.
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'Correios');
    await waitFor(() => expect(lastListParams().search).toBe('Correios'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta.
    selectOption(screen.getByLabelText('Unidade'), 'Torre A - 101');
    expect(lastListParams().unitId).toBe('unit-1');

    selectOption(screen.getByLabelText('Destinatário'), 'Carlos Pereira');
    expect(lastListParams().residentId).toBe('resident-1');

    selectOption(screen.getByLabelText('Status'), 'Entregue');
    expect(lastListParams().status).toBe('DELIVERED');

    selectOption(screen.getByLabelText('Tipo'), 'Encomenda');
    expect(lastListParams().type).toBe('PACKAGE');

    // Os controles se somam em vez de se substituirem.
    expect(lastListParams()).toMatchObject({
      condominiumId: 'cond-1',
      search: 'Correios',
      unitId: 'unit-1',
      residentId: 'resident-1',
      status: 'DELIVERED',
      type: 'PACKAGE',
    });
  });

  it('ordenar por uma coluna envia sortOrder em maiusculas', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()] });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa média');

    clickTrigger(screen.getByRole('button', { name: 'Descrição' }));
    await waitFor(() => expect(lastListParams().sortBy).toBe('description'));
    expect(lastListParams().sortOrder).toBe('ASC');

    // A tabela alterna a direcao; a traducao para a caixa da API e da camada de
    // dados, e e ela que precisa continuar valendo (ADR-009).
    clickTrigger(screen.getByRole('button', { name: 'Descrição' }));
    await waitFor(() => expect(lastListParams().sortOrder).toBe('DESC'));
    expect(lastListParams().sortBy).toBe('description');
  });

  it('trezentas correspondências paginam no tamanho pedido', async () => {
    world = serveCorrespondences({ correspondences: makeRoster(20), total: 300 });
    const user = createUser();
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Volume 01');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams().perPage).toBe(20);

    world.correspondences = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /próxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Volume 21')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });

  it('campos ausentes viram placeholder, nunca a string "null"', async () => {
    world = serveCorrespondences({
      correspondences: [
        makeCorrespondence({
          description: null,
          carrier: null,
          trackingCode: null,
          receivedBy: null,
          residentId: null,
        }),
      ],
    });
    renderWithProviders(<CorrespondencesPage />);

    // Sem descricao nao ha texto proprio pelo qual esperar: a linha em si e o
    // sinal de que a listagem chegou.
    await screen.findByText('Aguardando retirada');
    expect(dataRows()).toHaveLength(1);

    expect(cellsOf('Descrição')).toEqual(['—']);
    expect(cellsOf('Transportadora')).toEqual(['—']);
    expect(cellsOf('Rastreio')).toEqual(['—']);
    expect(cellsOf('Recebida por')).toEqual(['—']);
    // Sem destinatario nominal e um estado valido, e nao um dado faltando.
    expect(cellsOf('Destinatário')).toEqual(['Sem destinatário']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('uma correspondência cuja unidade sumiu ainda rende a linha, com a falta explicita', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence({ unit: null })] });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa média');

    expect(cellsOf('Unidade')).toEqual(['Unidade removida']);
    expect(dataRows()).toHaveLength(1);
  });

  it('nenhum controle e oferecido para filtro fora da whitelist do servidor', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()] });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa média');

    // Whitelist do servidor: condominiumId (vem do shell), unitId, residentId,
    // status e type. Qualquer outro controle pareceria funcionar enquanto o
    // backend o descarta em silencio.
    expect(screen.getByLabelText('Unidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Destinatário')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();

    for (const absent of ['Transportadora', 'Rastreio', 'Recebida por', 'Recebida em']) {
      expect(screen.queryByLabelText(absent)).not.toBeInTheDocument();
    }
  });
});

describe('Estados vazios de correspondências', () => {
  it('lista vazia oferece o cadastro', async () => {
    world = serveCorrespondences({ correspondences: [] });
    renderWithProviders(<CorrespondencesPage />);

    expect(await screen.findByText('Nenhuma correspondência registrada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar correspondência' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum resultado para esta busca')).not.toBeInTheDocument();
  });

  it('busca sem resultado oferece limpar, e e distinta da lista vazia', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()] });
    const user = createUser();
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa média');
    world.correspondences = [];
    await user.type(screen.getByLabelText('Buscar'), 'Nada');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    // Os dois vazios sao estados diferentes e dizem coisas diferentes.
    expect(screen.queryByText('Nenhuma correspondência registrada')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Registrar correspondência' }),
    ).not.toBeInTheDocument();
  });
});

describe('Baixa de entrega', () => {
  it('dar baixa muda o status e a contagem de pendentes cai', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()], pending: 1 });
    const user = createUser();
    mockPost.mockImplementation(async (url) => {
      if (url !== '/correspondences/correspondence-1/deliver') {
        throw new Error(`URL inesperada: ${url}`);
      }
      world.correspondences = [
        makeCorrespondence({
          status: 'DELIVERED',
          deliveredTo: 'Carlos Pereira',
          deliveredAt: '2026-03-12T18:00:00.000Z',
        }),
      ];
      world.pending = 0;
      return world.correspondences[0] as never;
    });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Aguardando retirada');
    // O numero vem do endpoint dedicado, e nao de `meta.total` da listagem.
    await waitFor(() => expect(pendingBadge()).toBe('1'));
    expect(pendingCountRequests().at(-1)).toMatchObject({ condominiumId: 'cond-1' });

    clickTrigger(screen.getByRole('button', { name: 'Dar baixa em Caixa média' }));

    // A baixa exige saber quem retirou, com no minimo tres caracteres, entao a
    // acao de linha pergunta antes de postar.
    await screen.findByLabelText('Quem retirou');
    await user.type(screen.getByLabelText('Quem retirou'), 'Carlos Pereira');
    clickTrigger(within(screen.getByRole('dialog')).getByRole('button', { name: 'Dar baixa' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/correspondences/correspondence-1/deliver');
    expect(mockPost.mock.calls[0][1]).toMatchObject({ deliveredTo: 'Carlos Pereira' });

    expect(await screen.findByText('Entregue')).toBeInTheDocument();
    // A invalidacao da acao alcanca listagem e contador de uma vez.
    await waitFor(() => expect(pendingBadge()).toBe('0'));
  });

  it('baixa em item já entregue e recusada, e a mensagem aparece', async () => {
    world = serveCorrespondences({
      correspondences: [makeCorrespondence({ status: 'DELIVERED', deliveredTo: 'Carlos Pereira' })],
      pending: 0,
    });
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Esta correspondência já foi entregue.', 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Entregue');
    // A acao e oferecida sem olhar o status: quem decide se a baixa vale e o
    // servidor, e a mensagem dele e a resposta (ADR-003).
    clickTrigger(screen.getByRole('button', { name: 'Dar baixa em Caixa média' }));

    await screen.findByLabelText('Quem retirou');
    await user.type(screen.getByLabelText('Quem retirou'), 'Carlos Pereira');
    clickTrigger(within(screen.getByRole('dialog')).getByRole('button', { name: 'Dar baixa' }));

    const message = await screen.findByText('Esta correspondência já foi entregue.');
    // A recusa aparece onde a acao foi tomada, e o registro continua como estava.
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toBe(message);
    // O `onError` proprio substitui o toast global: a mesma recusa nao pode
    // aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('duas confirmações seguidas da baixa produzem um único POST', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()], pending: 1 });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.correspondences = [makeCorrespondence({ status: 'DELIVERED' })];
      world.pending = 0;
      return world.correspondences[0] as never;
    });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa média');
    clickTrigger(screen.getByRole('button', { name: 'Dar baixa em Caixa média' }));

    await screen.findByLabelText('Quem retirou');
    await user.type(screen.getByLabelText('Quem retirou'), 'Carlos Pereira');

    const submit = within(screen.getByRole('dialog')).getByRole('button', { name: 'Dar baixa' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('a baixa sem dizer quem retirou para no próprio campo', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()], pending: 1 });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa média');
    clickTrigger(screen.getByRole('button', { name: 'Dar baixa em Caixa média' }));

    await screen.findByLabelText('Quem retirou');
    clickTrigger(within(screen.getByRole('dialog')).getByRole('button', { name: 'Dar baixa' }));

    const message = await screen.findByText('Informe quem retirou a correspondência.');
    expect(message).toHaveAttribute('id', 'deliveredTo-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('contagem de pendentes zero renderiza como zero, e não some', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()], pending: 0 });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa média');

    // A ausencia de fila e informacao: sumir com o numero faria parecer que o
    // contador nao carregou.
    await waitFor(() => expect(pendingBadge()).toBe('0'));
    expect(screen.getByRole('button', { name: /Fila de retirada/ })).toBeInTheDocument();
  });
});

describe('Exclusao e restauração de correspondências', () => {
  it('excluir pede confirmação antes de remover', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()] });
    mockDelete.mockImplementation(async () => {
      world.correspondences = [];
    });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa média');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Caixa média' }));

    // O pedido so sai depois da confirmacao.
    expect(await screen.findByText('Excluir correspondência?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith('/correspondences/correspondence-1'),
    );
    await waitFor(() => expect(screen.queryByText('Caixa média')).not.toBeInTheDocument());
  });

  it('um 409 de impedimento mostra a mensagem do servidor e mantem o registro', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()] });
    mockDelete.mockRejectedValue(
      new ApiError('Esta correspondência aguarda retirada.', 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa média');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Caixa média' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    // A exclusao nao passa `onError`, entao herda o toast global — que e a
    // apresentacao certa para um 409 que traz so a mensagem do servidor.
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('Esta correspondência aguarda retirada.'),
    );
    expect(screen.getByText('Caixa média')).toBeInTheDocument();
  });

  it('incluir removidos envia includeDeleted, e restaurar devolve o registro', async () => {
    world = serveCorrespondences({
      correspondences: [makeCorrespondence({ deletedAt: '2026-03-11T10:00:00.000Z' })],
    });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.correspondences = [makeCorrespondence({ deletedAt: null })];
      return world.correspondences[0] as never;
    });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa média');
    await user.click(screen.getByLabelText('Incluir removidos'));

    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));
    expect(screen.getByText('Removido')).toBeInTheDocument();

    clickTrigger(await screen.findByRole('button', { name: 'Restaurar Caixa média' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/correspondences/correspondence-1/restore'),
    );
    await waitFor(() => expect(screen.queryByText('Removido')).not.toBeInTheDocument());
  });
});

describe('Escopo e permissões de correspondências', () => {
  it('sem condomínio selecionado a tela explica a exigência e não consulta', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()] });
    renderWithProviders(<CorrespondencesPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condomínio')).toBeInTheDocument();
    // Nem a listagem, nem os seletores de vinculo, nem o contador saem sem
    // condominio.
    expect(mockGetPaginated).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('um operador sem update não recebe a baixa de entrega', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()] });
    renderWithProviders(<CorrespondencesPage />, {
      role: 'STAFF',
      permissions: ['correspondence:read'],
    });

    await screen.findByText('Caixa média');

    // A baixa exige `correspondence:update`; a interface nao oferece o que o
    // servidor recusaria.
    expect(screen.queryByRole('button', { name: /^Dar baixa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova correspondência' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
  });

  it('um operador não ve restaurar nas linhas removidas', async () => {
    world = serveCorrespondences({
      correspondences: [makeCorrespondence({ deletedAt: '2026-03-11T10:00:00.000Z' })],
    });
    const user = createUser();
    renderWithProviders(<CorrespondencesPage />, {
      role: 'STAFF',
      permissions: ['correspondence:read'],
    });

    await screen.findByText('Caixa média');
    // Ver removidos e leitura; restaurar exige `update` (ADR-006).
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(await screen.findByText('Removido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });

  it('os seletores de vinculo também ficam presos ao condomínio do shell', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()] });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa média');

    for (const url of ['/units', '/residents']) {
      const call = mockGetPaginated.mock.calls.find(([called]) => called === url);
      expect((call?.[1]?.params ?? {}) as Record<string, unknown>).toMatchObject({
        condominiumId: 'cond-1',
      });
    }
  });
});
