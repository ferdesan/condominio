import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiGetPaginated, apiPatch, apiPost, apiDelete } from '@/lib/api';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { AuditLog } from '@/types/audit';
import { AuditPage } from './audit-page';
import {
  allReadRequests,
  historyRequests,
  lastListParams,
  makeAuditLog,
  serveAudit,
  type AuditWorld,
} from './test-utils';

// O duble fica so na camada de transporte (ADR-010).
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
const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockDelete = vi.mocked(apiDelete);

let world: AuditWorld;

const DESCRIPTION = 'Unidade 101 atualizada';

/**
 * Toda escrita que a tela poderia oferecer por engano, pelo nome acessivel. Os
 * padroes sao deliberadamente largos — qualquer "Editar ...", nao apenas os
 * conhecidos —, porque uma acao nova que escape do rotulo previsto aqui passaria
 * despercebida, e e justamente isso que este arquivo precisa impedir.
 */
const WRITE_ACTIONS = [
  /^Nov[ao] /,
  /^Cadastrar/,
  /^Criar/,
  /^Adicionar/,
  /^Editar/,
  /^Excluir/,
  /^Remover filtro/,
  /^Remover/,
  /^Restaurar/,
  /^Salvar/,
  /^Apagar/,
];

/** Entradas com descricoes previsiveis, para conferir qual pagina chegou. */
function makeTrail(count: number, offset = 0): AuditLog[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeAuditLog({
      id: `audit-${position}`,
      resourceId: `unit-${position}`,
      description: `Entrada ${String(position).padStart(2, '0')}`,
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

function writeActionsOnScreen(): string[] {
  return screen
    .queryAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '')
    .map((label) => label.trim())
    .filter((label) => WRITE_ACTIONS.some((pattern) => pattern.test(label)));
}

/**
 * Espera as linhas chegarem.
 *
 * A tabela existe desde o primeiro quadro, com uma linha de "Carregando..." no
 * lugar dos dados; quem prova que a resposta chegou e o texto da entrada.
 */
async function findRows(text: string = DESCRIPTION): Promise<HTMLElement> {
  return screen.findByText(text);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem da trilha', () => {
  it('lista paginada pede a proxima pagina com os parametros certos', async () => {
    world = serveAudit({ logs: makeTrail(20), total: 300 });
    const user = createUser();
    renderWithProviders(<AuditPage />);

    await screen.findByText('Entrada 01');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams().perPage).toBe(20);
    expect(lastListParams().page).toBe(1);

    world.logs = makeTrail(20, 20);
    await user.click(screen.getByRole('button', { name: /proxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Entrada 21')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });

  it('percorre busca e os dois filtros preservando os parametros', async () => {
    world = serveAudit({ logs: [makeAuditLog()] });
    const user = createUser();
    renderWithProviders(<AuditPage />);

    await findRows();

    await user.type(screen.getByLabelText('Buscar'), 'marina');
    await waitFor(() => expect(lastListParams().search).toBe('marina'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta.
    selectOption(screen.getByLabelText('Acao'), 'Alteracao');
    expect(lastListParams().action).toBe('UPDATE');

    selectOption(screen.getByLabelText('Recurso'), 'Unidade');
    expect(lastListParams().resource).toBe('unit');

    // Os controles se somam em vez de se substituirem.
    expect(lastListParams()).toMatchObject({
      search: 'marina',
      action: 'UPDATE',
      resource: 'unit',
    });
  });

  it('ordenar por uma coluna envia sortOrder em maiusculas', async () => {
    world = serveAudit({ logs: [makeAuditLog()] });
    renderWithProviders(<AuditPage />);

    await findRows();

    clickTrigger(screen.getByRole('button', { name: 'Quando' }));
    await waitFor(() => expect(lastListParams().sortBy).toBe('createdAt'));
    expect(lastListParams().sortOrder).toBe('ASC');

    // A tabela alterna a direcao; a traducao para a caixa da API e da camada de
    // dados, e e ela que precisa continuar valendo (ADR-009).
    clickTrigger(screen.getByRole('button', { name: 'Quando' }));
    await waitFor(() => expect(lastListParams().sortOrder).toBe('DESC'));
    expect(lastListParams().sortBy).toBe('createdAt');
  });

  it('funciona sem condominio selecionado e nao pede a selecao', async () => {
    world = serveAudit({ logs: [makeAuditLog()] });
    renderWithProviders(<AuditPage />, { condominium: null });

    // A trilha e por tenant: a lista sai assim que a tela monta, sem depender de
    // nenhuma escolha no shell.
    await findRows();

    expect(screen.queryByText(/selecione um condominio/i)).not.toBeInTheDocument();
    // Nenhuma requisicao carrega a chave: `AuditRepository` a descartaria em
    // silencio, e envia-la prometeria um recorte inexistente.
    for (const request of allReadRequests()) {
      expect(request.params, request.url).not.toHaveProperty('condominiumId');
    }
  });

  it('lista vazia renderiza estado vazio, e nao tabela em branco', async () => {
    world = serveAudit({ logs: [] });
    renderWithProviders(<AuditPage />);

    expect(await screen.findByText('Nenhuma atividade registrada')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('busca sem resultado oferece limpar, em vez do vazio de lista nova', async () => {
    world = serveAudit({ logs: [] });
    const user = createUser();
    renderWithProviders(<AuditPage />);

    await screen.findByText('Nenhuma atividade registrada');
    await user.type(screen.getByLabelText('Buscar'), 'inexistente');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
  });
});

describe('Conteudo de uma entrada', () => {
  it('mostra quem agiu, o que mudou e quando, de forma legivel', async () => {
    world = serveAudit({ logs: [makeAuditLog()] });
    renderWithProviders(<AuditPage />);

    await findRows();

    // Quem agiu.
    expect(cellsOf('Autor')[0]).toBe('Marina Alves');
    // O que aconteceu, por extenso e nao pelo identificador do servidor.
    expect(cellsOf('Acao')[0]).toBe('Alteracao');
    expect(cellsOf('Recurso')[0]).toBe('Unidade');
    expect(cellsOf('Descricao')[0]).toBe(DESCRIPTION);
    // Quais campos mudaram, ja na listagem.
    expect(cellsOf('Campos alterados')[0]).toBe('status, monthlyFee');
    // Quando: data e hora completas, sem depender do fuso da maquina que roda o
    // teste — o que importa e que a coluna diga um instante legivel.
    expect(cellsOf('Quando')[0]).toMatch(/^\d{2}\/\d{2}\/\d{4} as \d{2}:\d{2}/);
  });

  it('entrada sem autor e atribuida ao sistema, e nao a um traco', async () => {
    world = serveAudit({
      logs: [makeAuditLog({ userId: null, userName: null, description: 'Carga inicial' })],
    });
    renderWithProviders(<AuditPage />);

    await findRows('Carga inicial');
    expect(cellsOf('Autor')[0]).toBe('Sistema');
  });

  it('acao sem campos alterados diz isso, em vez de deixar a celula vazia', async () => {
    world = serveAudit({
      logs: [
        makeAuditLog({
          action: 'LOGIN',
          resource: 'auth',
          resourceId: null,
          changes: null,
          description: 'Entrada realizada',
        }),
      ],
    });
    renderWithProviders(<AuditPage />);

    await findRows('Entrada realizada');
    expect(cellsOf('Campos alterados')[0]).toBe('Nenhum campo alterado');
    expect(cellsOf('Acao')[0]).toBe('Entrada no sistema');
  });
});

describe('Historico de um registro', () => {
  it('abrir os detalhes consulta a rota por recurso e identificador', async () => {
    world = serveAudit({
      logs: [makeAuditLog()],
      history: [
        makeAuditLog(),
        makeAuditLog({
          id: 'audit-0',
          action: 'CREATE',
          userName: 'Joana Ribeiro',
          description: 'Unidade 101 criada',
        }),
      ],
    });
    renderWithProviders(<AuditPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: /^Ver detalhes de Alteracao em Unidade/ }));

    const dialog = await screen.findByRole('dialog');
    // A rota do historico e por recurso e identificador, e nao a listagem
    // filtrada: e um endpoint proprio, com recorte e ordem do servidor.
    await waitFor(() => expect(historyRequests()).toContain('/audit-logs/unit/unit-1'));

    // A entrada aberta nao se repete no proprio historico.
    expect(await within(dialog).findByText('Joana Ribeiro')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Marina Alves')).toHaveLength(1);
  });

  it('os detalhes mostram a diferenca entre antes e depois', async () => {
    world = serveAudit({ logs: [makeAuditLog()], history: [makeAuditLog()] });
    renderWithProviders(<AuditPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: /^Ver detalhes de Alteracao em Unidade/ }));

    const dialog = await screen.findByRole('dialog');
    const changes = within(dialog).getByText('status').closest('li');
    expect(changes).not.toBeNull();
    // O par antes/depois e o conteudo que importa: so o valor final nao diz o
    // que a entrada registrou.
    expect(changes?.textContent).toContain('VACANT');
    expect(changes?.textContent).toContain('OCCUPIED');

    const fee = within(dialog).getByText('monthlyFee').closest('li');
    expect(fee?.textContent).toContain('800');
    expect(fee?.textContent).toContain('850');
  });

  it('acao sem registro alvo nao consulta historico nenhum', async () => {
    world = serveAudit({
      logs: [
        makeAuditLog({
          action: 'LOGIN_FAILED',
          resource: 'auth',
          resourceId: null,
          changes: null,
          description: 'Senha invalida',
        }),
      ],
    });
    renderWithProviders(<AuditPage />);

    await findRows('Senha invalida');
    clickTrigger(screen.getByRole('button', { name: /^Ver detalhes de Falha de entrada/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/nao aponta para um registro especifico/i)).toBeInTheDocument();
    // Pedir o historico de um identificador vazio seria um 400 no servidor.
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('Trilha somente leitura', () => {
  it('nao oferece criar, editar, excluir nem restaurar em lugar nenhum', async () => {
    world = serveAudit({
      logs: [
        makeAuditLog(),
        makeAuditLog({
          id: 'audit-2',
          action: 'DELETE',
          resourceId: 'unit-2',
          description: 'Unidade 202 removida',
        }),
      ],
    });
    renderWithProviders(<AuditPage />);

    await findRows();

    expect(writeActionsOnScreen()).toEqual([]);
    // E nenhuma rota de escrita e alcancada: a trilha e append-only no servidor.
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('o dialogo de detalhes tambem nao oferece escrita', async () => {
    world = serveAudit({ logs: [makeAuditLog()], history: [makeAuditLog()] });
    renderWithProviders(<AuditPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: /^Ver detalhes de Alteracao em Unidade/ }));

    await screen.findByRole('dialog');
    expect(writeActionsOnScreen()).toEqual([]);
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('papel sem audit-log:read nao alcanca a tela nem dispara a consulta', async () => {
    world = serveAudit({ logs: [makeAuditLog()] });
    renderWithProviders(<AuditPage />, { permissions: ['dashboard:read'] });

    expect(await screen.findByText('Acesso negado')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // A tela nao pede o que o servidor negaria.
    expect(mockGetPaginated).not.toHaveBeenCalled();
  });
});
