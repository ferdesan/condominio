import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPatch } from '@/lib/api';
import { CondominiumContext } from '@/providers/condominium-context';
import { makeBlock, makeCondominium, makeMeta, makeUnit } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/render';
import type { Block, Condominium, Unit } from '@/types/api';
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
const mockPatch = vi.mocked(apiPatch);
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

const TOWER_A = makeBlock({ id: 'block-1', name: 'Torre A', floors: 12 });
const TOWER_B = makeBlock({ id: 'block-2', name: 'Torre B', floors: 8 });

/** Blocos por condominio, para que a troca no shell tenha o que recarregar. */
function serve(
  options: {
    blocksByCondominium?: Record<string, Block[]>;
    units?: Unit[];
  } = {},
): void {
  const { blocksByCondominium = { 'cond-1': [TOWER_A, TOWER_B] }, units = [] } = options;
  mockGetPaginated.mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    if (url === '/blocks') {
      const blocks = blocksByCondominium[params.condominiumId as string] ?? [];
      return {
        data: blocks,
        meta: makeMeta({ total: blocks.length, perPage: params.perPage as number }),
      };
    }
    if (params.perPage === 1) {
      return { data: [], meta: makeMeta({ page: 1, perPage: 1, total: units.length }) };
    }
    return { data: units, meta: makeMeta({ total: units.length }) };
  });
}

/** Abre a gestao de blocos a partir da tela de unidades. */
async function openBlockManager(): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: 'Gerenciar blocos' }));
  await screen.findByText('Blocos do condomínio');
}

/** O dialogo do topo da pilha: o Radix esconde o de baixo dos leitores. */
function topDialog(): HTMLElement {
  return screen.getByRole('dialog');
}

function SwitchableShell({ first, second }: { first: Condominium; second: Condominium }) {
  const [selected, setSelected] = useState(first);
  return (
    <CondominiumContext.Provider
      value={{
        condominiums: [first, second],
        selected,
        selectedId: selected.id,
        select: () => setSelected(second),
        isLoading: false,
      }}
    >
      <button type="button" onClick={() => setSelected(second)}>
        Trocar condomínio
      </button>
      <UnitsPage />
    </CondominiumContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Gestao de blocos do condomínio', () => {
  it('IT-200: renomeia um bloco e exclui um vazio; a lista de unidades acompanha', async () => {
    const unit = makeUnit({ id: 'unit-1', number: '101', blockId: 'block-1', block: TOWER_A });
    serve({ units: [unit] });
    const user = createUser();
    renderWithProviders(<UnitsPage />);
    await screen.findByText('101');
    expect(screen.getByRole('cell', { name: 'Torre A' })).toBeInTheDocument();

    await openBlockManager();
    expect(within(topDialog()).getByText('Torre A')).toBeInTheDocument();
    expect(within(topDialog()).getByText(/Torre · 12 andares · 4 por andar/)).toBeInTheDocument();

    // Renomear: o nome novo precisa alcancar a listagem, que exibe o bloco.
    const renamed = makeBlock({ ...TOWER_A, name: 'Torre Central' });
    mockPatch.mockResolvedValue(renamed);
    clickTrigger(within(topDialog()).getByRole('button', { name: 'Editar bloco Torre A' }));
    await screen.findByLabelText('Nome');
    await user.clear(within(topDialog()).getByLabelText('Nome'));
    await user.type(within(topDialog()).getByLabelText('Nome'), 'Torre Central');
    serve({
      blocksByCondominium: { 'cond-1': [renamed, TOWER_B] },
      units: [makeUnit({ ...unit, block: renamed })],
    });
    clickTrigger(within(topDialog()).getByRole('button', { name: /Salvar bloco$/ }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/blocks/block-1',
        expect.objectContaining({ name: 'Torre Central' }),
      ),
    );
    await waitFor(() => expect(within(topDialog()).getByText('Torre Central')).toBeInTheDocument());

    // Excluir um bloco sem unidades.
    mockDelete.mockResolvedValue(undefined);
    serve({
      blocksByCondominium: { 'cond-1': [renamed] },
      units: [makeUnit({ ...unit, block: renamed })],
    });
    clickTrigger(within(topDialog()).getByRole('button', { name: 'Excluir bloco Torre B' }));
    clickTrigger(await screen.findByRole('button', { name: /^Excluir bloco$/ }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/blocks/block-2'));
    await waitFor(() => expect(within(topDialog()).queryByText('Torre B')).not.toBeInTheDocument());

    clickTrigger(within(topDialog()).getByRole('button', { name: 'Concluir' }));
    // A mutacao de bloco invalida tambem as unidades, que exibem o nome.
    expect(await screen.findByRole('cell', { name: 'Torre Central' })).toBeInTheDocument();
  });

  it('IT-201: recusa por unidades vinculadas aparece como o servidor escreveu', async () => {
    serve();
    const message = 'Bloco possui unidades vinculadas e não pode ser removido.';
    mockDelete.mockRejectedValue(new ApiError(message, 409, 'BUSINESS_RULE_VIOLATION'));
    renderWithProviders(<UnitsPage />);
    await screen.findByText('Nenhuma unidade cadastrada');

    await openBlockManager();
    clickTrigger(within(topDialog()).getByRole('button', { name: 'Excluir bloco Torre A' }));
    clickTrigger(await screen.findByRole('button', { name: /^Excluir bloco$/ }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(message));
    // O bloco continua la, e a confirmacao fecha sem sugerir que deu certo.
    expect(within(topDialog()).getByText('Torre A')).toBeInTheDocument();
  });

  it('IT-202: sem blocos, a gestao oferece a criação do primeiro', async () => {
    serve({ blocksByCondominium: { 'cond-1': [] } });
    renderWithProviders(<UnitsPage />);
    await screen.findByText('Nenhuma unidade cadastrada');

    await openBlockManager();

    expect(within(topDialog()).getByText('Nenhum bloco cadastrado')).toBeInTheDocument();
    expect(
      within(topDialog()).getByRole('button', { name: 'Criar primeiro bloco' }),
    ).toBeInTheDocument();
  });

  it('IT-203: renomear para um nome já usado aparece como conflito no formulário', async () => {
    serve();
    const message = 'Já existe um bloco com este nome neste condomínio.';
    mockPatch.mockRejectedValue(new ApiError(message, 409, 'CONFLICT'));
    const user = createUser();
    renderWithProviders(<UnitsPage />);
    await screen.findByText('Nenhuma unidade cadastrada');

    await openBlockManager();
    clickTrigger(within(topDialog()).getByRole('button', { name: 'Editar bloco Torre A' }));
    await screen.findByLabelText('Nome');
    await user.clear(within(topDialog()).getByLabelText('Nome'));
    await user.type(within(topDialog()).getByLabelText('Nome'), 'Torre B');
    clickTrigger(within(topDialog()).getByRole('button', { name: /Salvar bloco$/ }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Torre B');
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('IT-205: trocar de condomínio recarrega a gestao para o novo', async () => {
    const other = makeCondominium({ id: 'cond-2', name: 'Residencial Bosque' });
    const OUTRO = makeBlock({ id: 'block-9', condominiumId: 'cond-2', name: 'Ala Norte' });
    serve({ blocksByCondominium: { 'cond-1': [TOWER_A], 'cond-2': [OUTRO] } });
    renderWithProviders(<SwitchableShell first={makeCondominium()} second={other} />);
    await screen.findByText('Nenhuma unidade cadastrada');

    await openBlockManager();
    expect(within(topDialog()).getByText('Torre A')).toBeInTheDocument();

    // Com a gestao aberta, o Radix marca o resto da pagina como aria-hidden; a
    // troca vem do shell, que fica justamente nessa parte escondida.
    clickTrigger(screen.getByRole('button', { name: 'Trocar condomínio', hidden: true }));

    await waitFor(() => expect(within(topDialog()).getByText('Ala Norte')).toBeInTheDocument());
    expect(within(topDialog()).queryByText('Torre A')).not.toBeInTheDocument();
    expect(mockGetPaginated).toHaveBeenCalledWith(
      '/blocks',
      expect.objectContaining({ params: expect.objectContaining({ condominiumId: 'cond-2' }) }),
    );
  });

  it('IT-206: mudar os andares com unidades existentes e aceito e não mexe nelas', async () => {
    const unit = makeUnit({ id: 'unit-1', number: '101', blockId: 'block-1', block: TOWER_A });
    serve({ units: [unit] });
    const updated = makeBlock({ ...TOWER_A, floors: 20 });
    mockPatch.mockResolvedValue(updated);
    const user = createUser();
    renderWithProviders(<UnitsPage />);
    await screen.findByText('101');

    await openBlockManager();
    clickTrigger(within(topDialog()).getByRole('button', { name: 'Editar bloco Torre A' }));
    await screen.findByLabelText('Andares');
    await user.clear(within(topDialog()).getByLabelText('Andares'));
    await user.type(within(topDialog()).getByLabelText('Andares'), '20');
    serve({ blocksByCondominium: { 'cond-1': [updated, TOWER_B] }, units: [unit] });
    clickTrigger(within(topDialog()).getByRole('button', { name: /Salvar bloco$/ }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/blocks/block-1',
        expect.objectContaining({ floors: 20 }),
      ),
    );
    await waitFor(() =>
      expect(within(topDialog()).getByText(/Torre · 20 andares/)).toBeInTheDocument(),
    );

    clickTrigger(within(topDialog()).getByRole('button', { name: 'Concluir' }));
    // A contagem e so um padrao para geracoes futuras: nenhuma unidade e tocada.
    const row = (await screen.findByText('101')).closest('tr') as HTMLElement;
    expect(within(row).getByRole('cell', { name: 'Torre A' })).toBeInTheDocument();
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).not.toHaveBeenCalledWith(
      expect.stringContaining('/units/'),
      expect.anything(),
    );
  });

  it('com acesso apenas de leitura, nenhuma ação de escrita e oferecida', async () => {
    serve();
    renderWithProviders(<UnitsPage />, { permissions: ['unit:read', 'block:read'] });
    await screen.findByText('Nenhuma unidade cadastrada');

    await openBlockManager();

    expect(within(topDialog()).getByText('Torre A')).toBeInTheDocument();
    expect(
      within(topDialog()).queryByRole('button', { name: 'Editar bloco Torre A' }),
    ).not.toBeInTheDocument();
    expect(
      within(topDialog()).queryByRole('button', { name: 'Excluir bloco Torre A' }),
    ).not.toBeInTheDocument();
    expect(
      within(topDialog()).queryByRole('button', { name: 'Novo bloco' }),
    ).not.toBeInTheDocument();
  });
});
