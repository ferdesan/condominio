import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiGetPaginated, apiPost } from '@/lib/api';
import { makeBlock, makeMeta, makeUnit } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/render';
import type { Block, Unit } from '@/types/api';
import { UnitsPage } from '../units-page';
import { BulkGenerateDialog } from './bulk-generate-dialog';

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
const mockPost = vi.mocked(apiPost);
const mockToastError = vi.mocked(toast.error);

const TOWER_A = makeBlock({ id: 'block-1', name: 'Torre A' });

/**
 * Responde a listagem, os blocos e as contagens. `blockUnits` e quantas unidades
 * o bloco escolhido ja tem — e o que o dialogo consulta para avisar da sobreposicao.
 */
function serve(units: Unit[] = [], blockUnits = 0, blocks: Block[] = [TOWER_A]): void {
  mockGetPaginated.mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    if (url === '/blocks') return { data: blocks, meta: makeMeta({ total: blocks.length }) };
    if (params.perPage === 1) {
      const total = params.blockId ? blockUnits : units.length;
      return { data: [], meta: makeMeta({ page: 1, perPage: 1, total }) };
    }
    return { data: units, meta: makeMeta({ total: units.length }) };
  });
}

/** O dialogo montado sozinho, com um unico bloco — que ja vem escolhido. */
function renderDialog(onClose: () => void = () => undefined) {
  return renderWithProviders(
    <BulkGenerateDialog
      condominiumId="cond-1"
      blocks={[TOWER_A]}
      blocksLoading={false}
      onClose={onClose}
    />,
  );
}

/** O botao de confirmacao traz a contagem projetada no proprio rotulo. */
function confirmButton(): HTMLElement {
  return within(screen.getByRole('dialog')).getByRole('button', { name: /^(Carregando)?\s*Gerar/ });
}

async function fillGrid(floors: string, unitsPerFloor: string): Promise<void> {
  const user = createUser();
  await user.clear(screen.getByLabelText('Andares'));
  await user.type(screen.getByLabelText('Andares'), floors);
  await user.clear(screen.getByLabelText('Unidades por andar'));
  await user.type(screen.getByLabelText('Unidades por andar'), unitsPerFloor);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Geração de unidades em lote', () => {
  it('IT-060: mostra a projeção, gera e relata quantas o servidor criou', async () => {
    serve([], 0);
    renderWithProviders(<UnitsPage />);
    await screen.findByText('Nenhuma unidade cadastrada');

    clickTrigger(screen.getByRole('button', { name: 'Gerar unidades em lote' }));
    await screen.findByLabelText('Andares');
    await fillGrid('3', '4');

    // A contagem projetada aparece antes de confirmar, no texto e no botao.
    expect(await screen.findByText(/Serão geradas/)).toHaveTextContent(
      'Serão geradas 12 unidades, de 101 a 304.',
    );
    expect(confirmButton()).toHaveAccessibleName('Gerar 12 unidades');

    mockPost.mockResolvedValue({ created: 12 });
    serve(
      Array.from({ length: 12 }, (_, i) => makeUnit({ id: `u-${i}`, number: `10${i}` })),
      12,
    );
    clickTrigger(confirmButton());

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith('/units/bulk', {
      condominiumId: 'cond-1',
      blockId: 'block-1',
      floors: 3,
      unitsPerFloor: 4,
      startFloor: 1,
      numberPattern: '{floor}{index}',
      type: 'APARTMENT',
      monthlyFee: 0,
      area: null,
    });

    // O numero relatado e o que o servidor devolveu, nao o pedido.
    expect(await screen.findByText('12 unidades criadas.')).toBeInTheDocument();

    clickTrigger(screen.getByRole('button', { name: 'Concluir' }));
    // A lista recarrega sozinha: a mutacao invalida a chave do recurso.
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('IT-061: recusa por números já existentes e um desfecho, não uma falha', async () => {
    serve([], 4);
    const message = 'Nenhuma unidade nova foi gerada: todos os números já existem.';
    mockPost.mockRejectedValue(new ApiError(message, 409, 'BUSINESS_RULE_VIOLATION'));
    renderDialog();
    await fillGrid('2', '2');

    clickTrigger(confirmButton());

    const outcome = await screen.findByText(message);
    expect(outcome).toBeInTheDocument();
    // Regiao de status, nao de alerta: o operador nao deve procurar um defeito.
    expect(outcome.closest('[role="status"]')).not.toBeNull();
    expect(outcome.closest('[role="alert"]')).toBeNull();
    expect(screen.getByText(/Nada foi alterado/)).toBeInTheDocument();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('IT-062: zero andares e recusado sem requisição', async () => {
    serve([], 0);
    renderDialog();
    await fillGrid('0', '4');

    clickTrigger(confirmButton());

    expect(
      await screen.findByText('O número de andares deve estar entre 1 e 100.'),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('IT-063: gerar sobre um bloco povoado avisa da sobreposição antes de confirmar', async () => {
    serve([], 6);
    renderDialog();

    expect(await screen.findByText(/Este bloco já possui 6 unidades/)).toBeInTheDocument();
    expect(screen.getByText(/Números que já existem serão pulados/)).toBeInTheDocument();
    // O aviso vem antes de qualquer envio.
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('IT-064: a maior grade permitida e enviada e a tela indica progresso', async () => {
    serve([], 0);
    let resolveBulk: (value: { created: number }) => void = () => undefined;
    mockPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBulk = resolve;
        }),
    );
    renderDialog();
    await fillGrid('100', '50');

    expect(confirmButton()).toHaveAccessibleName('Gerar 5.000 unidades');
    clickTrigger(confirmButton());

    // Enquanto o lote esta no ar a tela diz o que esta acontecendo.
    expect(await screen.findByText('Gerando 5.000 unidades...')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith(
      '/units/bulk',
      expect.objectContaining({ floors: 100, unitsPerFloor: 50 }),
    );

    resolveBulk({ created: 5000 });
    expect(await screen.findByText('5.000 unidades criadas.')).toBeInTheDocument();
  });

  it('IT-065: duas confirmações seguidas produzem uma única requisição', async () => {
    serve([], 0);
    mockPost.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ created: 4 }), 50)),
    );
    renderDialog();
    await fillGrid('2', '2');

    clickTrigger(confirmButton());
    clickTrigger(confirmButton());

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('IT-066: falha de rede recarrega a lista em vez de presumir o desfecho', async () => {
    serve([], 0);
    mockPost.mockRejectedValue(new ApiError('Falha de conexao.', 0, 'NETWORK_ERROR'));
    renderDialog();
    await fillGrid('2', '2');

    const callsBefore = mockGetPaginated.mock.calls.length;
    clickTrigger(confirmButton());

    expect(await screen.findByText('Falha de conexao.')).toBeInTheDocument();
    // Nenhuma contagem e anunciada; o que existe de fato vem da lista recarregada.
    expect(screen.queryByText(/unidades criadas/)).not.toBeInTheDocument();
    await waitFor(() => expect(mockGetPaginated.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('IT-067: padrão que produz número de 21 caracteres e recusado sem requisição', async () => {
    serve([], 0);
    const user = createUser();
    renderDialog();
    await fillGrid('100', '50');
    await user.clear(screen.getByLabelText('Padrão de numeração'));
    // `userEvent` le `{` como descritor de tecla; `{{` digita a chave literal.
    await user.type(
      screen.getByLabelText('Padrão de numeração'),
      'UNIDADE-CENTRAL-{{floor}{{index}',
    );
    expect(screen.getByLabelText('Padrão de numeração')).toHaveValue(
      'UNIDADE-CENTRAL-{floor}{index}',
    );
    await user.clear(screen.getByLabelText('Andar inicial'));
    await user.type(screen.getByLabelText('Andar inicial'), '100');

    clickTrigger(confirmButton());

    // O numero tambem aparece na projecao; o que importa e a mensagem do campo.
    const fieldError = await screen.findByText(/21 caracteres/);
    expect(fieldError).toHaveAttribute('role', 'alert');
    expect(fieldError).toHaveTextContent('UNIDADE-CENTRAL-19950');
    expect(mockPost).not.toHaveBeenCalled();
  });
});
