import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiPatch, apiPost } from '@/lib/api';
import { CondominiumContext, type CondominiumContextValue } from '@/providers/condominium-context';
import { makeCondominium } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import { CorrespondencesPage } from '../correspondences-page';
import { makeCorrespondence, serveCorrespondences, type CorrespondenceWorld } from '../test-utils';

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

/** Mesmo custo de portal do Radix descrito em `correspondences-page.test.tsx`. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockToastError = vi.mocked(toast.error);

let world: CorrespondenceWorld;

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
  clickTrigger(screen.getByRole('button', { name: 'Nova correspondencia' }));
  await screen.findByLabelText('Descricao');
}

function submitCreate(): void {
  clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));
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

describe('Cadastro de correspondencia', () => {
  it('cadastra e a lista atualiza sem refetch manual', async () => {
    world = serveCorrespondences({ correspondences: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.correspondences = [makeCorrespondence({ description: 'Envelope registrado' })];
      world.pending = 1;
      return world.correspondences[0] as never;
    });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Nenhuma correspondencia registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Descricao'), 'Envelope registrado');
    selectOption(within(dialog()).getByLabelText('Unidade'), 'Torre A - 101');
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/correspondences');
    expect(lastCreateBody()).toMatchObject({
      condominiumId: 'cond-1',
      unitId: 'unit-1',
      description: 'Envelope registrado',
      // O destinatario nominal e opcional: a portaria nem sempre o identifica.
      residentId: null,
      // Os padroes do servidor, espelhados pelo formulario.
      type: 'PACKAGE',
      status: 'PENDING',
    });
    // O recebimento abre preenchido com o instante em que o formulario abriu.
    expect(typeof lastCreateBody().receivedAt).toBe('string');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // A invalidacao da fabrica traz a linha nova: ninguem pediu refetch aqui.
    expect(await screen.findByText('Envelope registrado')).toBeInTheDocument();
  });

  it('sem unidade destinataria o envio para no proprio campo', async () => {
    world = serveCorrespondences({ correspondences: [] });
    const user = createUser();
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Nenhuma correspondencia registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Descricao'), 'Envelope registrado');
    submitCreate();

    const message = await screen.findByText('Selecione a unidade destinataria.');
    // A objecao pertence ao campo da unidade, e nao ao formulario inteiro.
    expect(message).toHaveAttribute('id', 'unitId-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('um 422 com campo aparece no campo, e sem toast', async () => {
    world = serveCorrespondences({ correspondences: [] });
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
        { field: 'trackingCode', message: 'Codigo de rastreio ja registrado.' },
      ]),
    );
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Nenhuma correspondencia registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Descricao'), 'Envelope registrado');
    selectOption(within(dialog()).getByLabelText('Unidade'), 'Torre A - 101');
    await user.type(within(dialog()).getByLabelText('Codigo de rastreio'), 'BR123456789BR');
    submitCreate();

    const message = await screen.findByText('Codigo de rastreio ja registrado.');
    expect(message).toHaveAttribute('id', 'trackingCode-error');
    // O formulario define `onError`, entao substitui o toast global em vez de
    // somar a ele: a mesma recusa nao pode aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('um 409 sem campo aparece como mensagem do formulario, preservando o preenchido', async () => {
    world = serveCorrespondences({ correspondences: [] });
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError(
        'A unidade informada pertence a outro condominio.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Nenhuma correspondencia registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Descricao'), 'Envelope registrado');
    selectOption(within(dialog()).getByLabelText('Unidade'), 'Torre A - 101');
    await user.type(within(dialog()).getByLabelText('Transportadora'), 'Correios');
    submitCreate();

    expect(
      await screen.findByText('A unidade informada pertence a outro condominio.'),
    ).toBeInTheDocument();
    // O dialogo fica, com os valores no lugar, para a correcao.
    expect(within(dialog()).getByLabelText('Descricao')).toHaveValue('Envelope registrado');
    expect(within(dialog()).getByLabelText('Transportadora')).toHaveValue('Correios');
  });

  it('dois envios em sequencia produzem um unico POST', async () => {
    world = serveCorrespondences({ correspondences: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.correspondences = [makeCorrespondence()];
      return world.correspondences[0] as never;
    });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Nenhuma correspondencia registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Descricao'), 'Envelope registrado');
    selectOption(within(dialog()).getByLabelText('Unidade'), 'Torre A - 101');

    const submit = within(dialog()).getByRole('button', { name: 'Cadastrar' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('o formulario grava no condominio em que abriu, mesmo se o shell mudar', async () => {
    world = serveCorrespondences({ correspondences: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.correspondences = [makeCorrespondence()];
      return world.correspondences[0] as never;
    });
    renderWithProviders(
      <SwitchableShell>
        <CorrespondencesPage />
      </SwitchableShell>,
    );

    await screen.findByText('Nenhuma correspondencia registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Descricao'), 'Envelope registrado');
    selectOption(within(dialog()).getByLabelText('Unidade'), 'Torre A - 101');

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

describe('Edicao de correspondencia', () => {
  it('editar emite um unico PATCH e a linha reflete', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()] });
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.correspondences = [makeCorrespondence({ carrier: 'Jadlog' })];
      return world.correspondences[0] as never;
    });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa media');
    clickTrigger(screen.getByRole('button', { name: 'Editar Caixa media' }));
    await screen.findByLabelText('Descricao');

    // Os valores atuais chegam preenchidos.
    expect(within(dialog()).getByLabelText('Descricao')).toHaveValue('Caixa media');
    expect(within(dialog()).getByLabelText('Codigo de rastreio')).toHaveValue('BR123456789BR');

    await user.clear(within(dialog()).getByLabelText('Transportadora'));
    await user.type(within(dialog()).getByLabelText('Transportadora'), 'Jadlog');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0][0]).toBe('/correspondences/correspondence-1');
    expect(lastUpdateBody()).toMatchObject({ carrier: 'Jadlog' });
    expect(await screen.findByText('Jadlog')).toBeInTheDocument();
  });

  it('desfazer o destinatario envia null, e nao a chave ausente', async () => {
    world = serveCorrespondences({ correspondences: [makeCorrespondence()] });
    mockPatch.mockImplementation(async () => {
      world.correspondences = [makeCorrespondence({ residentId: null })];
      return world.correspondences[0] as never;
    });
    renderWithProviders(<CorrespondencesPage />);

    await screen.findByText('Caixa media');
    clickTrigger(screen.getByRole('button', { name: 'Editar Caixa media' }));
    await screen.findByLabelText('Descricao');

    selectOption(within(dialog()).getByLabelText('Destinatario'), 'Sem destinatario');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    // Omitir a chave deixaria o vinculo antigo de pe: apagar precisa de `null`.
    expect(lastUpdateBody()).toMatchObject({ residentId: null });
    await waitFor(() => expect(screen.getByText('Sem destinatario')).toBeInTheDocument());
  });
});
