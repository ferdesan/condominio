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
  chooseOption,
  waitFor,
  within,
} from '@/test/render';
import { VisitorsPage } from '../visitors-page';
import { makeVisitor, serveVisitors, type VisitorWorld } from '../test-utils';

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

/** Mesmo custo de portal do Radix descrito em `visitors-page.test.tsx`. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockToastError = vi.mocked(toast.error);

let world: VisitorWorld;

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
  clickTrigger(screen.getByRole('button', { name: 'Novo visitante' }));
  await screen.findByLabelText('Nome');
}

function submitCreate(): void {
  clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));
}

/** Preenche o minimo que o servidor exige: nome e unidade de destino. */
async function fillRequired(name = 'Pedro Nunes'): Promise<void> {
  const user = createUser();
  await user.type(within(dialog()).getByLabelText('Nome'), name);
  chooseOption(within(dialog()).getByLabelText('Unidade'), 'Torre A - 101');
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
        Trocar condomínio
      </button>
      {children}
    </CondominiumContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Cadastro de visitante', () => {
  it('cadastra e a lista atualiza sem refetch manual', async () => {
    world = serveVisitors({ visitors: [] });
    mockPost.mockImplementation(async () => {
      world.visitors = [makeVisitor({ name: 'Pedro Nunes' })];
      return world.visitors[0] as never;
    });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Nenhum visitante registrado');
    await openCreateDialog();
    await fillRequired();
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/visitors');
    expect(lastCreateBody()).toMatchObject({
      condominiumId: 'cond-1',
      unitId: 'unit-1',
      name: 'Pedro Nunes',
      // Os padroes do servidor, espelhados pelo formulario.
      type: 'VISITOR',
      status: 'EXPECTED',
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // A invalidacao da fabrica traz a linha nova: ninguem pediu refetch aqui.
    expect(await screen.findByText('Pedro Nunes')).toBeInTheDocument();
  });

  it('sem unidade de destino o envio para no próprio campo', async () => {
    world = serveVisitors({ visitors: [] });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Nenhum visitante registrado');
    await openCreateDialog();

    const user = createUser();
    await user.type(within(dialog()).getByLabelText('Nome'), 'Pedro Nunes');
    submitCreate();

    const message = await screen.findByText('Selecione a unidade de destino.');
    // A objecao pertence ao campo da unidade, e nao ao formulario inteiro.
    expect(message).toHaveAttribute('id', 'unitId-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('o fim do período antes do início e recusado no campo, sem ir ao servidor', async () => {
    world = serveVisitors({ visitors: [] });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Nenhum visitante registrado');
    await openCreateDialog();
    await fillRequired();

    const user = createUser();
    await user.type(within(dialog()).getByLabelText('Previsto a partir de'), '2026-03-14T18:00');
    await user.type(within(dialog()).getByLabelText('Previsto até'), '2026-03-14T17:00');
    submitCreate();

    // O servidor recusa isto como regra de negocio, sem apontar campo; dito aqui,
    // tem conserto obvio.
    const message = await screen.findByText('O fim do período deve ser depois do início.');
    expect(message).toHaveAttribute('id', 'expectedUntil-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('um 422 com campo aparece no campo, e sem toast', async () => {
    world = serveVisitors({ visitors: [] });
    mockPost.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
        { field: 'badgeNumber', message: 'Cracha já esta em uso por outro visitante.' },
      ]),
    );
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Nenhum visitante registrado');
    await openCreateDialog();
    await fillRequired();

    const user = createUser();
    await user.type(within(dialog()).getByLabelText('Cracha'), 'C-014');
    submitCreate();

    const message = await screen.findByText('Cracha já esta em uso por outro visitante.');
    expect(message).toHaveAttribute('id', 'badgeNumber-error');
    // O formulario define `onError`, entao substitui o toast global em vez de
    // somar a ele: a mesma recusa nao pode aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('um 409 sem campo aparece como mensagem do formulário, preservando o preenchido', async () => {
    world = serveVisitors({ visitors: [] });
    mockPost.mockRejectedValue(
      new ApiError(
        'A unidade informada pertence a outro condomínio.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Nenhum visitante registrado');
    await openCreateDialog();
    await fillRequired();

    const user = createUser();
    await user.type(within(dialog()).getByLabelText('Empresa'), 'Entrega Rapida');
    submitCreate();

    expect(
      await screen.findByText('A unidade informada pertence a outro condomínio.'),
    ).toBeInTheDocument();
    // O dialogo fica, com os valores no lugar, para a correcao.
    expect(within(dialog()).getByLabelText('Nome')).toHaveValue('Pedro Nunes');
    expect(within(dialog()).getByLabelText('Empresa')).toHaveValue('Entrega Rapida');
  });

  it('dois envios em sequência produzem um único POST', async () => {
    world = serveVisitors({ visitors: [] });
    mockPost.mockImplementation(async () => {
      world.visitors = [makeVisitor({ name: 'Pedro Nunes' })];
      return world.visitors[0] as never;
    });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Nenhum visitante registrado');
    await openCreateDialog();
    await fillRequired();

    const submit = within(dialog()).getByRole('button', { name: 'Cadastrar' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('o formulário grava no condomínio em que abriu, mesmo se o shell mudar', async () => {
    world = serveVisitors({ visitors: [] });
    mockPost.mockImplementation(async () => {
      world.visitors = [makeVisitor({ name: 'Pedro Nunes' })];
      return world.visitors[0] as never;
    });
    renderWithProviders(
      <SwitchableShell>
        <VisitorsPage />
      </SwitchableShell>,
    );

    await screen.findByText('Nenhum visitante registrado');
    await openCreateDialog();
    await fillRequired();

    // Por papel nao da: o dialogo modal marca o resto da pagina como
    // `aria-hidden`, e `getByRole` nao enxerga fora da arvore acessivel.
    clickTrigger(screen.getByText('Trocar condomínio'));

    // A divergencia entre o que o dialogo grava e o que a tela mostra e nomeada,
    // em vez de silenciosamente reapontada (US-027.EC-3).
    expect(await screen.findByText(/continua valendo para/i)).toBeInTheDocument();

    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody()).toMatchObject({ condominiumId: 'cond-1' });
  });
});

describe('Edição de visitante', () => {
  it('editar emite um único PATCH e a linha reflete', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    mockPatch.mockImplementation(async () => {
      world.visitors = [makeVisitor({ company: 'Correios' })];
      return world.visitors[0] as never;
    });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    clickTrigger(screen.getByRole('button', { name: 'Editar Joana Ribeiro' }));
    await screen.findByLabelText('Nome');

    // Os valores atuais chegam preenchidos.
    expect(within(dialog()).getByLabelText('Nome')).toHaveValue('Joana Ribeiro');
    expect(within(dialog()).getByLabelText('Cracha')).toHaveValue('C-014');

    const user = createUser();
    await user.clear(within(dialog()).getByLabelText('Empresa'));
    await user.type(within(dialog()).getByLabelText('Empresa'), 'Correios');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0][0]).toBe('/visitors/visitor-1');
    expect(lastUpdateBody()).toMatchObject({ company: 'Correios' });
    expect(await screen.findByText('Correios')).toBeInTheDocument();
  });

  it('limpar um campo opcional envia null, e não a chave ausente', async () => {
    world = serveVisitors({ visitors: [makeVisitor()] });
    mockPatch.mockImplementation(async () => {
      world.visitors = [makeVisitor({ badgeNumber: null })];
      return world.visitors[0] as never;
    });
    renderWithProviders(<VisitorsPage />);

    await screen.findByText('Joana Ribeiro');
    clickTrigger(screen.getByRole('button', { name: 'Editar Joana Ribeiro' }));
    await screen.findByLabelText('Nome');

    const user = createUser();
    await user.clear(within(dialog()).getByLabelText('Cracha'));
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    // Omitir a chave deixaria o cracha antigo de pe: apagar precisa de `null`.
    expect(lastUpdateBody()).toMatchObject({ badgeNumber: null });
  });
});
