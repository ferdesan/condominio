import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { CondominiumContext, type CondominiumContextValue } from '@/providers/condominium-context';
import { makeCondominium, makeMeta, makeServiceProvider } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/render';
import type { ServiceProvider } from '@/types/api';
import { ServiceProvidersPage } from '../service-providers-page';

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

/** Mesmo custo de portal do Radix descrito em `service-providers-page.test.tsx`. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockToastError = vi.mocked(toast.error);

type World = { providers: ServiceProvider[] };
let world: World;

function serve(providers: ServiceProvider[]): void {
  world = { providers };
  mockGetPaginated.mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    if (url !== '/service-providers') throw new Error(`URL nao prevista no teste: ${url}`);
    const perPage = params.page === undefined ? 200 : Number(params.perPage ?? 20);
    return { data: world.providers, meta: makeMeta({ total: world.providers.length, perPage }) };
  });
}

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
  clickTrigger(screen.getByRole('button', { name: 'Novo prestador' }));
  await screen.findByLabelText('Razao social');
}

/** Abre o dialogo de edicao do registro e espera os valores carregados. */
async function openEditDialog(name: string): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: `Editar ${name}` }));
  await screen.findByLabelText('Razao social');
}

/** Preenche o minimo que o servidor exige, para que so a objecao sob teste sobre. */
async function fillRequired(user: ReturnType<typeof createUser>): Promise<void> {
  await user.type(within(dialog()).getByLabelText('Razao social'), 'Jardins e Cia');
  await user.type(within(dialog()).getByLabelText('Tipo de servico'), 'Jardinagem');
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

describe('Cadastro de prestador', () => {
  it('cadastra e a lista atualiza sem refetch manual', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.providers = [
        makeServiceProvider({ companyName: 'Jardins e Cia', serviceType: 'Jardinagem' }),
      ];
      return world.providers[0];
    });
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Nenhum prestador cadastrado');
    await openCreateDialog();
    await fillRequired(user);
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/service-providers');
    // O condominio vem do shell, nao do formulario; os padroes do servidor
    // entram sem que ninguem os toque.
    expect(lastCreateBody()).toMatchObject({
      condominiumId: 'cond-1',
      companyName: 'Jardins e Cia',
      serviceType: 'Jardinagem',
      status: 'ACTIVE',
      document: null,
      rating: null,
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // A invalidacao da fabrica traz a linha nova: ninguem pediu refetch aqui.
    expect(await screen.findByText('Jardins e Cia')).toBeInTheDocument();
  });

  it('um 422 com campo aparece no campo, e sem toast', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
        { field: 'document', message: 'Documento ja utilizado por outro prestador.' },
      ]),
    );
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Nenhum prestador cadastrado');
    await openCreateDialog();
    await fillRequired(user);
    submitCreate();

    const message = await screen.findByText('Documento ja utilizado por outro prestador.');
    // A objecao pertence ao campo apontado, e nao ao formulario inteiro.
    expect(message).toHaveAttribute('id', 'document-error');
    // O formulario define `onError`, entao substitui o toast global em vez de
    // somar a ele: a mesma recusa nao pode aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('um 409 sem campo aparece como mensagem do formulario, preservando o preenchido', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Documento informado e invalido.', 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Nenhum prestador cadastrado');
    await openCreateDialog();
    await fillRequired(user);
    await user.type(within(dialog()).getByLabelText('CPF ou CNPJ'), '12345678000100');
    submitCreate();

    expect(await screen.findByText('Documento informado e invalido.')).toBeInTheDocument();
    // O dialogo fica, com os valores no lugar, para a correcao.
    expect(within(dialog()).getByLabelText('Razao social')).toHaveValue('Jardins e Cia');
    expect(within(dialog()).getByLabelText('Tipo de servico')).toHaveValue('Jardinagem');
    expect(within(dialog()).getByLabelText('CPF ou CNPJ')).toHaveValue('12345678000100');
  });

  it('dois envios em sequencia produzem um unico POST', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.providers = [makeServiceProvider({ companyName: 'Jardins e Cia' })];
      return world.providers[0];
    });
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Nenhum prestador cadastrado');
    await openCreateDialog();
    await fillRequired(user);

    const submit = within(dialog()).getByRole('button', { name: 'Cadastrar' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('o formulario grava no condominio em que abriu, mesmo se o shell mudar', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.providers = [makeServiceProvider({ companyName: 'Jardins e Cia' })];
      return world.providers[0];
    });
    renderWithProviders(
      <SwitchableShell>
        <ServiceProvidersPage />
      </SwitchableShell>,
    );

    await screen.findByText('Nenhum prestador cadastrado');
    await openCreateDialog();
    await fillRequired(user);

    // Por papel nao da: o dialogo modal marca o resto da pagina como
    // `aria-hidden`, e `getByRole` nao enxerga fora da arvore acessivel.
    clickTrigger(screen.getByText('Trocar condominio'));

    // A divergencia entre o que o dialogo grava e o que a tela mostra e
    // nomeada, em vez de silenciosamente reapontada (US-027.EC-3).
    expect(await screen.findByText(/continua valendo para/i)).toBeInTheDocument();

    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody()).toMatchObject({ condominiumId: 'cond-1' });
  });
});

describe('Documento e avaliacao do prestador', () => {
  it('um CPF de 11 digitos e aceito', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.providers = [makeServiceProvider({ document: '12345678909' })];
      return world.providers[0];
    });
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Nenhum prestador cadastrado');
    await openCreateDialog();
    await fillRequired(user);
    await user.type(within(dialog()).getByLabelText('CPF ou CNPJ'), '123.456.789-09');
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    // A pontuacao e descartada, como o backend faz.
    expect(lastCreateBody()).toMatchObject({ document: '12345678909' });
  });

  it('um CNPJ de 14 digitos e aceito', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.providers = [makeServiceProvider()];
      return world.providers[0];
    });
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Nenhum prestador cadastrado');
    await openCreateDialog();
    await fillRequired(user);
    await user.type(within(dialog()).getByLabelText('CPF ou CNPJ'), '12.345.678/0001-99');
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody()).toMatchObject({ document: '12345678000199' });
  });

  it('um documento de 10 digitos e recusado no proprio campo', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Nenhum prestador cadastrado');
    await openCreateDialog();
    await fillRequired(user);
    await user.type(within(dialog()).getByLabelText('CPF ou CNPJ'), '1234567890');
    submitCreate();

    const message = await screen.findByText('Informe um CPF (11 digitos) ou um CNPJ (14 digitos).');
    expect(message).toHaveAttribute('id', 'document-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('uma avaliacao fora de 1 a 5 e recusada antes do envio', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Nenhum prestador cadastrado');
    await openCreateDialog();
    await fillRequired(user);
    await user.type(within(dialog()).getByLabelText('Avaliacao'), '9');
    submitCreate();

    const message = await screen.findByText('A avaliacao vai de 1 a 5.');
    expect(message).toHaveAttribute('id', 'rating-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('uma avaliacao dentro da faixa vai como inteiro', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.providers = [makeServiceProvider({ rating: 5 })];
      return world.providers[0];
    });
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Nenhum prestador cadastrado');
    await openCreateDialog();
    await fillRequired(user);
    await user.type(within(dialog()).getByLabelText('Avaliacao'), '5');

    // A previa ao lado do campo le a nota como avaliacao, e nao como numero.
    expect(within(dialog()).getByLabelText('5 de 5 — Excelente')).toBeInTheDocument();

    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    // A coluna e `int`: o formulario guarda texto, a requisicao leva numero.
    expect(lastCreateBody()).toMatchObject({ rating: 5 });
  });
});

describe('Edicao de prestador', () => {
  it('editar emite um unico PATCH e a linha reflete', async () => {
    serve([makeServiceProvider()]);
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.providers = [makeServiceProvider({ companyName: 'Limpeza Total S.A.' })];
      return world.providers[0];
    });
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Limpeza Total Ltda');
    await openEditDialog('Limpeza Total Ltda');

    // Os valores atuais chegam preenchidos.
    expect(within(dialog()).getByLabelText('Razao social')).toHaveValue('Limpeza Total Ltda');
    expect(within(dialog()).getByLabelText('Avaliacao')).toHaveValue(4);

    await user.clear(within(dialog()).getByLabelText('Razao social'));
    await user.type(within(dialog()).getByLabelText('Razao social'), 'Limpeza Total S.A.');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0][0]).toBe('/service-providers/provider-1');
    expect(lastUpdateBody()).toMatchObject({ companyName: 'Limpeza Total S.A.' });
    expect(await screen.findByText('Limpeza Total S.A.')).toBeInTheDocument();
  });

  it('termino anterior ao inicio e recusado no campo do termino', async () => {
    serve([makeServiceProvider()]);
    const user = createUser();
    renderWithProviders(<ServiceProvidersPage />);

    await screen.findByText('Limpeza Total Ltda');
    await openEditDialog('Limpeza Total Ltda');

    await user.clear(within(dialog()).getByLabelText('Termino'));
    await user.type(within(dialog()).getByLabelText('Termino'), '2025-12-31');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    const message = await screen.findByText(
      'O termino do contrato nao pode ser anterior ao inicio.',
    );
    expect(message).toHaveAttribute('id', 'contractEnd-error');
    expect(mockPatch).not.toHaveBeenCalled();
  });
});
