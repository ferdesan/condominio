import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPost } from '@/lib/api';
import { makeBlock, makeMeta, makeUnit } from '@/test/fixtures';
import { clickTrigger, renderWithProviders, screen, waitFor, within } from '@/test/render';
import type { Unit } from '@/types/api';
import { UnitsPage } from '../units-page';

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

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockDelete = vi.mocked(apiDelete);
const mockPost = vi.mocked(apiPost);
const mockToastError = vi.mocked(toast.error);

const TOWER_A = makeBlock({ id: 'block-1', name: 'Torre A' });
const UNIT_101 = makeUnit({ id: 'unit-1', number: '101', block: TOWER_A });

const RESIDENTS_BLOCKER = 'Unidade possui moradores ativos e nao pode ser removida.';
const CHARGES_BLOCKER = 'Unidade possui cobrancas em aberto e nao pode ser removida.';

function serve(units: Unit[]): void {
  mockGetPaginated.mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    if (url === '/blocks') return { data: [TOWER_A], meta: makeMeta({ total: 1 }) };
    if (params.perPage === 1) {
      const status = params.status as string | undefined;
      const live = units.filter((unit) => !unit.deletedAt);
      const matching = status ? live.filter((unit) => unit.status === status) : live;
      return {
        data: matching.slice(0, 1),
        meta: makeMeta({ page: 1, perPage: 1, total: matching.length }),
      };
    }
    const visible = params.includeDeleted ? units : units.filter((unit) => !unit.deletedAt);
    return { data: visible, meta: makeMeta({ total: visible.length }) };
  });
}

/** O cartao de total, que a exclusao precisa mover. */
function totalIndicator(): HTMLElement {
  return screen
    .getByText('Total de unidades')
    .closest('div.app-surface') as HTMLElement;
}

/** Abre a confirmacao de exclusao da unidade e confirma. */
async function deleteUnit(number: string): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: `Excluir unidade ${number}` }));
  clickTrigger(await screen.findByRole('button', { name: /^Excluir$/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Exclusao e restauracao de unidade', () => {
  it('IT-074: exclui a unidade e o total do condominio acompanha', async () => {
    serve([UNIT_101, makeUnit({ id: 'unit-2', number: '102', block: TOWER_A })]);
    mockDelete.mockResolvedValue(undefined);
    renderWithProviders(<UnitsPage />);
    await screen.findByText('101');
    await waitFor(() => expect(within(totalIndicator()).getByText('2')).toBeInTheDocument());

    serve([makeUnit({ id: 'unit-2', number: '102', block: TOWER_A })]);
    await deleteUnit('101');

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/units/unit-1'));
    await waitFor(() => expect(screen.queryByText('101')).not.toBeInTheDocument());
    // O indicador vem de outra consulta e so muda porque a mutacao a invalidou.
    await waitFor(() => expect(within(totalIndicator()).getByText('1')).toBeInTheDocument());
  });

  it('IT-075: recusa por moradores ativos aparece como o servidor escreveu', async () => {
    serve([UNIT_101]);
    mockDelete.mockRejectedValue(new ApiError(RESIDENTS_BLOCKER, 409, 'BUSINESS_RULE_VIOLATION'));
    renderWithProviders(<UnitsPage />);
    await screen.findByText('101');

    await deleteUnit('101');

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(RESIDENTS_BLOCKER));
    // A confirmacao fecha sem sugerir que deu certo, e a unidade continua la.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('101')).toBeInTheDocument();
  });

  it('IT-076: recusa por cobrancas em aberto aparece como o servidor escreveu', async () => {
    serve([UNIT_101]);
    mockDelete.mockRejectedValue(new ApiError(CHARGES_BLOCKER, 409, 'BUSINESS_RULE_VIOLATION'));
    renderWithProviders(<UnitsPage />);
    await screen.findByText('101');

    await deleteUnit('101');

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(CHARGES_BLOCKER));
    expect(screen.getByText('101')).toBeInTheDocument();
  });

  it('IT-077: resolvido o primeiro impedimento, o segundo aparece e nenhuma exclusao passa', async () => {
    serve([UNIT_101]);
    mockDelete.mockRejectedValueOnce(
      new ApiError(RESIDENTS_BLOCKER, 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderWithProviders(<UnitsPage />);
    await screen.findByText('101');

    await deleteUnit('101');
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(RESIDENTS_BLOCKER));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Os moradores saíram; o servidor agora reporta o outro impedimento.
    mockDelete.mockRejectedValueOnce(
      new ApiError(CHARGES_BLOCKER, 409, 'BUSINESS_RULE_VIOLATION'),
    );
    await deleteUnit('101');

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(CHARGES_BLOCKER));
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(screen.getByText('101')).toBeInTheDocument();
  });

  it('IT-078: conflito ao restaurar mostra a mensagem e a unidade segue removida', async () => {
    const deleted = makeUnit({
      id: 'unit-1',
      number: '101',
      block: TOWER_A,
      deletedAt: '2026-02-01T12:00:00.000Z',
    });
    serve([deleted]);
    const message = 'Ja existe uma unidade com este numero neste bloco.';
    mockPost.mockRejectedValue(new ApiError(message, 409, 'CONFLICT'));
    renderWithProviders(<UnitsPage />);
    await screen.findByText('Nenhuma unidade cadastrada');

    clickTrigger(screen.getByLabelText('Incluir removidas'));
    await screen.findByText('101');
    expect(screen.getByText('Removida')).toBeInTheDocument();

    clickTrigger(screen.getByRole('button', { name: 'Restaurar unidade 101' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/units/unit-1/restore'));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(message));
    // Continua marcada como removida, e a acao oferecida segue sendo restaurar.
    expect(screen.getByText('Removida')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurar unidade 101' })).toBeInTheDocument();
  });

  it('IT-079: excluir a ultima unidade zera o total, que e o que destrava o condominio', async () => {
    serve([UNIT_101]);
    mockDelete.mockResolvedValue(undefined);
    renderWithProviders(<UnitsPage />);
    await screen.findByText('101');

    serve([]);
    await deleteUnit('101');

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/units/unit-1'));
    // Sem unidades, o servidor deixa de recusar a exclusao do condominio; o que
    // esta tela mostra dessa condicao e o total zerado e a lista vazia.
    expect(await screen.findByText('Nenhuma unidade cadastrada')).toBeInTheDocument();
    await waitFor(() => expect(within(totalIndicator()).getByText('0')).toBeInTheDocument());
  });
});

describe('Permissoes nas acoes de linha', () => {
  it('sem permissao de exclusao a acao nao e oferecida, e restaurar segue a de edicao', async () => {
    const deleted = makeUnit({
      id: 'unit-2',
      number: '102',
      block: TOWER_A,
      deletedAt: '2026-02-01T12:00:00.000Z',
    });
    serve([UNIT_101, deleted]);
    renderWithProviders(<UnitsPage />, { permissions: ['unit:read', 'block:read'] });
    await screen.findByText('101');

    clickTrigger(screen.getByLabelText('Incluir removidas'));
    await screen.findByText('102');

    expect(screen.queryByRole('button', { name: 'Excluir unidade 101' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar unidade 101' })).not.toBeInTheDocument();
    // Restaurar exige `update`, nao `delete` — e sem ele tambem some (ADR-006).
    expect(
      screen.queryByRole('button', { name: 'Restaurar unidade 102' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova unidade' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar unidades/ })).not.toBeInTheDocument();
  });
});
