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
import type { Visitor } from '@/types/visitor';
import { VisitorsPage } from './visitors-page';
import {
  insideCountRequests,
  lastListParams,
  makeVisitor,
  serveVisitors,
  type VisitorWorld,
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

/**
 * Mesmo custo medido nas demais telas: abrir um select do Radix no jsdom ocupa a
 * thread por dezenas de segundos, e o excedente escorre para o caso seguinte.
 * Dai o prazo largo, que vale para o arquivo inteiro.
 */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockGet = vi.mocked(apiGet);
const mockPost = vi.mocked(apiPost);
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

let world: VisitorWorld;

/** Visitantes com nomes previsiveis, para conferir qual pagina chegou. */
function makeRoster(count: number, offset = 0): Visitor[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeVisitor({
      id: `visitor-${position}`,
      name: `Visitante ${String(position).padStart(2, '0')}`,
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
function insideBadge(): string {
  const button = screen.getByRole('button', { name: /Dentro agora/ });
  return within(button).getByText(/^(\d+|—)$/).textContent ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de visitantes', () => {
  it('percorre busca e os filtros do servidor preservando os parametros', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    const user = createUser();
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    // Toda consulta nasce presa ao condominio escolhido no shell.
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'Joana');
    await waitFor(() => expect(lastListParams().search).toBe('Joana'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta.
    selectOption(screen.getByLabelText('Unidade'), 'Torre A - 101');
    expect(lastListParams().unitId).toBe('unit-1');

    selectOption(screen.getByLabelText('Status'), 'No condomínio');
    expect(lastListParams().status).toBe('CHECKED_IN');

    selectOption(screen.getByLabelText('Tipo'), 'Entrega');
    expect(lastListParams().type).toBe('DELIVERY');

    // Os controles se somam em vez de se substituirem.
    expect(lastListParams()).toMatchObject({
      condominiumId: 'cond-1',
      search: 'Joana',
      unitId: 'unit-1',
      status: 'CHECKED_IN',
      type: 'DELIVERY',
    });
  });

  it('o filtro de autorização própria envia o id de quem esta usando a tela', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    const user = createUser();
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    await user.click(screen.getByLabelText('Autorizadas por mim'));

    await waitFor(() => expect(lastListParams().authorizedById).toBe('user-1'));
  });

  it('ordenar por uma coluna envia sortOrder em maiusculas', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');

    clickTrigger(screen.getByRole('button', { name: 'Nome' }));
    await waitFor(() => expect(lastListParams().sortBy).toBe('name'));
    expect(lastListParams().sortOrder).toBe('ASC');

    // A tabela alterna a direcao; a traducao para a caixa da API e da camada de
    // dados, e e ela que precisa continuar valendo (ADR-009).
    clickTrigger(screen.getByRole('button', { name: 'Nome' }));
    await waitFor(() => expect(lastListParams().sortOrder).toBe('DESC'));
    expect(lastListParams().sortBy).toBe('name');
  });

  it('trezentos visitantes paginam no tamanho pedido', async () => {
    world = serveVisitors({ visitors: makeRoster(20), total: 300 });
    const user = createUser();
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Visitante 01');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams().perPage).toBe(20);

    world.visitors = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /próxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Visitante 21')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });

  it('campos ausentes viram placeholder, nunca a string "null"', async () => {
    world = serveVisitors({
      visitors: [
        makeVisitor({
          document: null,
          company: null,
          badgeNumber: null,
          expectedAt: null,
          checkedInAt: null,
        }),
      ],
    });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');

    expect(cellsOf('Documento')).toEqual(['—']);
    expect(cellsOf('Empresa')).toEqual(['—']);
    expect(cellsOf('Cracha')).toEqual(['—']);
    expect(cellsOf('Previsto para')).toEqual(['—']);
    expect(cellsOf('Entrada')).toEqual(['—']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('um visitante cuja unidade sumiu ainda rende a linha, com a falta explicita', async () => {
    world = serveVisitors({ visitors: [makeVisitor({ unit: null })] });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');

    expect(cellsOf('Unidade')).toEqual(['Unidade removida']);
    expect(dataRows()).toHaveLength(1);
  });

  it('nenhum controle e oferecido para filtro fora da whitelist do servidor', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');

    // Whitelist do servidor: condominiumId (vem do shell), unitId, status, type
    // e authorizedById. Qualquer outro controle pareceria funcionar enquanto o
    // backend o descarta em silencio.
    expect(screen.getByLabelText('Unidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Autorizadas por mim')).toBeInTheDocument();

    for (const absent of ['Empresa', 'Cracha', 'Placa', 'Documento', 'Telefone']) {
      expect(screen.queryByLabelText(absent)).not.toBeInTheDocument();
    }
  });
});

describe('Estados vazios de visitantes', () => {
  it('lista vazia oferece o cadastro', async () => {
    world = serveVisitors({ visitors: [] });
    renderWithProviders(<VisitorsPage />);

    expect(await screen.findByText('Nenhum visitante registrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar visitante' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum resultado para esta busca')).not.toBeInTheDocument();
  });

  it('busca sem resultado oferece limpar, e e distinta da lista vazia', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    const user = createUser();
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    world.visitors = [];
    await user.type(screen.getByLabelText('Buscar'), 'Ninguem');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    // Os dois vazios sao estados diferentes e dizem coisas diferentes.
    expect(screen.queryByText('Nenhum visitante registrado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar visitante' })).not.toBeInTheDocument();
  });
});

describe('Portaria: entrada e saída', () => {
  it('registrar entrada muda o status e a contagem de presentes acompanha', async () => {
    world = serveVisitors({ visitors: [makeVisitor()], inside: 0 });
    mockPost.mockImplementation(async (url) => {
      if (url !== '/visitors/visitor-1/check-in') throw new Error(`URL inesperada: ${url}`);
      world.visitors = [
        makeVisitor({ status: 'CHECKED_IN', checkedInAt: '2026-03-14T18:05:00.000Z' }),
      ];
      world.inside = 1;
      return world.visitors[0] as never;
    });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Previsto');
    // O numero vem do endpoint dedicado, e nao de `meta.total` da listagem.
    await waitFor(() => expect(insideBadge()).toBe('0'));
    expect(insideCountRequests().at(-1)).toMatchObject({ condominiumId: 'cond-1' });

    clickTrigger(screen.getByRole('button', { name: 'Registrar entrada de Joana Ribeiro' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/visitors/visitor-1/check-in', {}));
    expect(await screen.findByText('No condomínio')).toBeInTheDocument();
    // A invalidacao da acao alcanca listagem e contador de uma vez.
    await waitFor(() => expect(insideBadge()).toBe('1'));
  });

  it('registrar saída no mesmo visitante muda o status de volta e a contagem acompanha', async () => {
    world = serveVisitors({
      visitors: [makeVisitor({ status: 'CHECKED_IN', checkedInAt: '2026-03-14T18:05:00.000Z' })],
      inside: 1,
    });
    mockPost.mockImplementation(async (url) => {
      if (url !== '/visitors/visitor-1/check-out') throw new Error(`URL inesperada: ${url}`);
      world.visitors = [
        makeVisitor({
          status: 'CHECKED_OUT',
          checkedInAt: '2026-03-14T18:05:00.000Z',
          checkedOutAt: '2026-03-14T21:30:00.000Z',
        }),
      ];
      world.inside = 0;
      return world.visitors[0] as never;
    });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('No condomínio');
    await waitFor(() => expect(insideBadge()).toBe('1'));

    clickTrigger(screen.getByRole('button', { name: 'Registrar saída de Joana Ribeiro' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/visitors/visitor-1/check-out', {}));
    expect(await screen.findByText('Saiu')).toBeInTheDocument();
    await waitFor(() => expect(insideBadge()).toBe('0'));
  });

  it('saída de quem não entrou e recusada, e a mensagem aparece na linha', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    mockPost.mockRejectedValue(
      new ApiError(
        'Somente visitantes com entrada registrada podem ter saída.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    // A acao e oferecida sem olhar o status: quem decide a transicao e o
    // servidor, e a mensagem dele e a resposta (ADR-003).
    clickTrigger(screen.getByRole('button', { name: 'Registrar saída de Joana Ribeiro' }));

    const message = await screen.findByText(
      'Somente visitantes com entrada registrada podem ter saída.',
    );
    // A recusa fica na linha que a provocou, e nao num toast solto.
    expect(within(dataRows()[0]).getByRole('alert')).toBe(message);
    // O `onError` proprio substitui o toast global: a mesma recusa nao pode
    // aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
    expect(screen.getByText('Previsto')).toBeInTheDocument();
  });

  it('dois cliques em registrar entrada disparam uma requisição so', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    mockPost.mockImplementation(async () => {
      world.visitors = [makeVisitor({ status: 'CHECKED_IN' })];
      world.inside = 1;
      return world.visitors[0] as never;
    });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');

    const button = screen.getByRole('button', { name: 'Registrar entrada de Joana Ribeiro' });
    clickTrigger(button);
    clickTrigger(button);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });
});

describe('Exclusao e restauração de visitantes', () => {
  it('excluir pede confirmação antes de remover', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    mockDelete.mockImplementation(async () => {
      world.visitors = [];
    });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Joana Ribeiro' }));

    // O pedido so sai depois da confirmacao.
    expect(await screen.findByText('Excluir visitante?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/visitors/visitor-1'));
    await waitFor(() => expect(screen.queryByText('Joana Ribeiro')).not.toBeInTheDocument());
  });

  it('um 409 de impedimento mostra a mensagem do servidor e mantem o registro', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    mockDelete.mockRejectedValue(
      new ApiError(
        'Ha uma visita em andamento para este registro.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Joana Ribeiro' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    // A exclusao nao passa `onError`, entao herda o toast global — que e a
    // apresentacao certa para um 409 que traz so a mensagem do servidor.
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('Ha uma visita em andamento para este registro.'),
    );
    expect(screen.getByText('Joana Ribeiro')).toBeInTheDocument();
  });

  it('incluir removidos envia includeDeleted, e restaurar devolve o registro', async () => {
    world = serveVisitors({ visitors: [makeVisitor({ deletedAt: '2026-03-11T10:00:00.000Z' })] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.visitors = [makeVisitor({ deletedAt: null })];
      return world.visitors[0] as never;
    });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    await user.click(screen.getByLabelText('Incluir removidos'));

    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));
    expect(screen.getByText('Removido')).toBeInTheDocument();

    clickTrigger(await screen.findByRole('button', { name: 'Restaurar Joana Ribeiro' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/visitors/visitor-1/restore'));
    await waitFor(() => expect(screen.queryByText('Removido')).not.toBeInTheDocument());
  });
});

describe('Escopo e permissões de visitantes', () => {
  it('sem condomínio selecionado a tela explica a exigência e não consulta', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    renderWithProviders(<VisitorsPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condomínio')).toBeInTheDocument();
    // Nem a listagem, nem o seletor de unidade, nem o contador saem sem condominio.
    expect(mockGetPaginated).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('um operador sem update não recebe as ações de portaria', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    renderWithProviders(<VisitorsPage />, { role: 'STAFF', permissions: ['visitor:read'] });

    await screen.findByText('Joana Ribeiro');

    // Entrada e saida exigem `visitor:update`; a interface nao oferece o que o
    // servidor recusaria.
    expect(screen.queryByRole('button', { name: /^Registrar entrada/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Registrar saída/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo visitante' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
  });

  it('um operador não ve restaurar nas linhas removidas', async () => {
    world = serveVisitors({ visitors: [makeVisitor({ deletedAt: '2026-03-11T10:00:00.000Z' })] });
    const user = createUser();
    renderWithProviders(<VisitorsPage />, { role: 'STAFF', permissions: ['visitor:read'] });

    await screen.findByText('Joana Ribeiro');
    // Ver removidos e leitura; restaurar exige `update` (ADR-006).
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(await screen.findByText('Removido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });

  it('o seletor de unidade também fica preso ao condomínio do shell', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');

    const call = mockGetPaginated.mock.calls.find(([url]) => url === '/units');
    expect((call?.[1]?.params ?? {}) as Record<string, unknown>).toMatchObject({
      condominiumId: 'cond-1',
    });
  });
});

describe('Consulta por código de acesso', () => {
  /** Preenche o campo do balcao e dispara a consulta. */
  async function lookup(user: ReturnType<typeof createUser>, code: string): Promise<void> {
    await user.type(screen.getByLabelText('Código de acesso'), code);
    await user.click(screen.getByRole('button', { name: 'Consultar' }));
  }

  it('encontra a visita aguardando entrada e mostra os dados dela', async () => {
    const user = createUser();
    serveVisitors({
      visitors: [
        makeVisitor({
          id: 'visitor-1',
          name: 'Joana Ribeiro',
          accessCode: 'A1B2C3',
          status: 'EXPECTED',
        }),
      ],
    });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    await lookup(user, 'A1B2C3');

    const panel = screen.getByRole('region', { name: 'Consulta por código de acesso' });
    expect(await within(panel).findByText('Joana Ribeiro')).toBeInTheDocument();
  });

  it('o código vai em maiusculas, como o servidor o guarda', async () => {
    const user = createUser();
    serveVisitors({
      visitors: [makeVisitor({ accessCode: 'A1B2C3', status: 'EXPECTED' })],
    });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    // Digitado em minusculas; sem a normalizacao seria um 409 de caixa.
    await lookup(user, 'a1b2c3');

    const panel = screen.getByRole('region', { name: 'Consulta por código de acesso' });
    expect(await within(panel).findByText('Joana Ribeiro')).toBeInTheDocument();
  });

  it('código desconhecido e resposta da consulta, e não falha da tela', async () => {
    const user = createUser();
    serveVisitors({ visitors: [makeVisitor({ accessCode: 'A1B2C3', status: 'EXPECTED' })] });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    await lookup(user, 'ZZZZZZ');

    // 409 e o desfecho normal do balcao: aparece na propria consulta, sem toast.
    expect(
      await screen.findByText('Código de acesso inválido ou já utilizado.'),
    ).toBeInTheDocument();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('visita que já entrou também não e encontrada', async () => {
    const user = createUser();
    // O servidor procura apenas entre os `EXPECTED`; quem ja entrou "nao existe"
    // para esta rota, e a mensagem cobre os dois casos.
    serveVisitors({ visitors: [makeVisitor({ accessCode: 'A1B2C3', status: 'CHECKED_IN' })] });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    await lookup(user, 'A1B2C3');

    expect(
      await screen.findByText('Código de acesso inválido ou já utilizado.'),
    ).toBeInTheDocument();
  });

  it('código curto demais nem chega ao servidor', async () => {
    const user = createUser();
    serveVisitors({ visitors: [makeVisitor({ accessCode: 'A1B2C3', status: 'EXPECTED' })] });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    await user.type(screen.getByLabelText('Código de acesso'), 'A1');

    // O servidor exige de 4 a 12 caracteres; abaixo disso o botao nem habilita.
    expect(screen.getByRole('button', { name: 'Consultar' })).toBeDisabled();
  });

  it('a consulta não mexe nos filtros nem na paginação da lista', async () => {
    const user = createUser();
    serveVisitors({ visitors: [makeVisitor({ accessCode: 'A1B2C3', status: 'EXPECTED' })] });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    const before = lastListParams();
    await lookup(user, 'A1B2C3');
    // Escopado no painel: a linha da tabela oferece a mesma acao, com o mesmo
    // rotulo acessivel.
    const panel = screen.getByRole('region', { name: 'Consulta por código de acesso' });
    await within(panel).findByRole('button', { name: 'Registrar entrada de Joana Ribeiro' });

    // Sao gestos diferentes: o balcao devolve um visitante, a lista devolve uma
    // pagina. Um nao pode alterar o recorte do outro.
    expect(lastListParams()).toEqual(before);
  });

  it('registrar entrada a partir do resultado usa o fluxo de check-in', async () => {
    const user = createUser();
    serveVisitors({
      visitors: [makeVisitor({ id: 'visitor-1', accessCode: 'A1B2C3', status: 'EXPECTED' })],
    });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    await lookup(user, 'A1B2C3');

    const panel = screen.getByRole('region', { name: 'Consulta por código de acesso' });
    await user.click(
      await within(panel).findByRole('button', { name: 'Registrar entrada de Joana Ribeiro' }),
    );
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/visitors/visitor-1/check-in', {}));
  });

  it('sem visitor:update, o resultado e so leitura', async () => {
    const user = createUser();
    serveVisitors({ visitors: [makeVisitor({ accessCode: 'A1B2C3', status: 'EXPECTED' })] });
    renderWithProviders(<VisitorsPage />, { permissions: ['visitor:read'] });

    await screen.findByText('Joana Ribeiro');
    await lookup(user, 'A1B2C3');

    const panel = screen.getByRole('region', { name: 'Consulta por código de acesso' });
    await within(panel).findByText('Joana Ribeiro');
    expect(
      within(panel).queryByRole('button', { name: /Registrar entrada/ }),
    ).not.toBeInTheDocument();
  });
});
