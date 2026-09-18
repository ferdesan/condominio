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
import { IncidentsPage } from '../incidents-page';
import { makeIncident, serveIncidents, type IncidentWorld } from '../test-utils';

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

/** Mesmo custo de portal do Radix descrito em `incidents-page.test.tsx`. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockToastError = vi.mocked(toast.error);

let world: IncidentWorld;

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
  clickTrigger(screen.getByRole('button', { name: 'Nova ocorrência' }));
  await screen.findByLabelText('Título');
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

describe('Cadastro de ocorrência', () => {
  it('cadastra e a lista atualiza sem refetch manual', async () => {
    world = serveIncidents({ incidents: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.incidents = [makeIncident({ title: 'Portao travado' })];
      return world.incidents[0] as never;
    });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Nenhuma ocorrência registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Título'), 'Portao travado');
    await user.type(
      within(dialog()).getByLabelText('Descrição'),
      'O portao da entrada não fecha desde ontem a noite.',
    );
    await user.type(within(dialog()).getByLabelText('Local'), 'Entrada principal');
    selectOption(within(dialog()).getByLabelText('Categoria'), 'Segurança');
    selectOption(within(dialog()).getByLabelText('Prioridade'), 'Crítica');
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/incidents');
    expect(lastCreateBody()).toMatchObject({
      condominiumId: 'cond-1',
      title: 'Portao travado',
      description: 'O portao da entrada não fecha desde ontem a noite.',
      location: 'Entrada principal',
      category: 'SECURITY',
      priority: 'CRITICAL',
    });
    // O protocolo e o status sao do servidor: `createIncidentSchema` nao aceita
    // nem um nem outro, e a ocorrencia nasce aberta.
    expect(lastCreateBody()).not.toHaveProperty('protocol');
    expect(lastCreateBody()).not.toHaveProperty('status');
    // Responsavel tambem nao: quem o grava e `/assign`, que exige `manage`.
    expect(lastCreateBody()).not.toHaveProperty('assignedToId');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // A invalidacao da fabrica traz a linha nova: ninguem pediu refetch aqui.
    expect(await screen.findByText('Portao travado')).toBeInTheDocument();
  });

  it('o protocolo aparece, mas não e preenchido a mao', async () => {
    world = serveIncidents({ incidents: [] });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Nenhuma ocorrência registrada');
    await openCreateDialog();

    const protocol = within(dialog()).getByLabelText('Protocolo');
    // Quem o gera e o servidor, em `nextProtocol`: editavel, o campo prometeria
    // um controle que nao existe.
    expect(protocol).toHaveAttribute('readonly');
    expect(protocol).toHaveValue('');
    expect(
      within(dialog()).getByText('Será gerado pelo servidor ao registrar a ocorrência.'),
    ).toBeInTheDocument();
  });

  it('sem descrição o envio para no próprio campo', async () => {
    world = serveIncidents({ incidents: [] });
    const user = createUser();
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Nenhuma ocorrência registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Título'), 'Portao travado');
    submitCreate();

    const message = await screen.findByText('Descreva a ocorrência.');
    // A objecao pertence ao campo da descricao, e nao ao formulario inteiro.
    expect(message).toHaveAttribute('id', 'description-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('um 422 com campo aparece no campo, e sem toast', async () => {
    world = serveIncidents({ incidents: [] });
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
        { field: 'title', message: 'Use no máximo 180 caracteres.' },
      ]),
    );
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Nenhuma ocorrência registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Título'), 'Portao travado');
    await user.type(within(dialog()).getByLabelText('Descrição'), 'Não fecha desde ontem.');
    submitCreate();

    const message = await screen.findByText('Use no máximo 180 caracteres.');
    expect(message).toHaveAttribute('id', 'title-error');
    // O formulario define `onError`, entao substitui o toast global em vez de
    // somar a ele: a mesma recusa nao pode aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('um 409 sem campo aparece como mensagem do formulário, preservando o preenchido', async () => {
    world = serveIncidents({ incidents: [] });
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError(
        'Ocorrências encerradas não podem ser alteradas.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Nenhuma ocorrência registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Título'), 'Portao travado');
    await user.type(within(dialog()).getByLabelText('Descrição'), 'Não fecha desde ontem.');
    await user.type(within(dialog()).getByLabelText('Local'), 'Entrada principal');
    submitCreate();

    expect(
      await screen.findByText('Ocorrências encerradas não podem ser alteradas.'),
    ).toBeInTheDocument();
    // O dialogo fica, com os valores no lugar, para a correcao.
    expect(within(dialog()).getByLabelText('Título')).toHaveValue('Portao travado');
    expect(within(dialog()).getByLabelText('Descrição')).toHaveValue('Não fecha desde ontem.');
    expect(within(dialog()).getByLabelText('Local')).toHaveValue('Entrada principal');
  });

  it('dois envios em sequência produzem um único POST', async () => {
    world = serveIncidents({ incidents: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.incidents = [makeIncident()];
      return world.incidents[0] as never;
    });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Nenhuma ocorrência registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Título'), 'Portao travado');
    await user.type(within(dialog()).getByLabelText('Descrição'), 'Não fecha desde ontem.');

    const submit = within(dialog()).getByRole('button', { name: 'Cadastrar' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('o formulário grava no condomínio em que abriu, mesmo se o shell mudar', async () => {
    world = serveIncidents({ incidents: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.incidents = [makeIncident()];
      return world.incidents[0] as never;
    });
    renderWithProviders(
      <SwitchableShell>
        <IncidentsPage />
      </SwitchableShell>,
    );

    await screen.findByText('Nenhuma ocorrência registrada');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Título'), 'Portao travado');
    await user.type(within(dialog()).getByLabelText('Descrição'), 'Não fecha desde ontem.');

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

describe('Edição de ocorrência', () => {
  it('editar emite um único PATCH e a linha reflete', async () => {
    world = serveIncidents({ incidents: [makeIncident()] });
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.incidents = [makeIncident({ location: 'Garagem G2', priority: 'CRITICAL' })];
      return world.incidents[0] as never;
    });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    clickTrigger(screen.getByRole('button', { name: 'Editar OC-2026-000001' }));
    await screen.findByLabelText('Título');

    // Os valores atuais chegam preenchidos, e o protocolo gerado aparece.
    expect(within(dialog()).getByLabelText('Título')).toHaveValue('Vazamento na garagem');
    expect(within(dialog()).getByLabelText('Local')).toHaveValue('Garagem G1');
    expect(within(dialog()).getByLabelText('Protocolo')).toHaveValue('OC-2026-000001');

    await user.clear(within(dialog()).getByLabelText('Local'));
    await user.type(within(dialog()).getByLabelText('Local'), 'Garagem G2');
    selectOption(within(dialog()).getByLabelText('Prioridade'), 'Crítica');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0][0]).toBe('/incidents/incident-1');
    expect(lastUpdateBody()).toMatchObject({ location: 'Garagem G2', priority: 'CRITICAL' });
    // O protocolo nao vai no corpo: o servidor e dono dele.
    expect(lastUpdateBody()).not.toHaveProperty('protocol');
    expect(await screen.findByText('Garagem G2')).toBeInTheDocument();
  });

  it('apagar o local envia null, e não a chave ausente', async () => {
    world = serveIncidents({ incidents: [makeIncident()] });
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.incidents = [makeIncident({ location: null })];
      return world.incidents[0] as never;
    });
    renderWithProviders(<IncidentsPage />);

    await screen.findByText('Vazamento na garagem');
    clickTrigger(screen.getByRole('button', { name: 'Editar OC-2026-000001' }));
    await screen.findByLabelText('Título');

    await user.clear(within(dialog()).getByLabelText('Local'));
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    // Omitir a chave deixaria o valor antigo de pe: apagar precisa de `null`.
    expect(lastUpdateBody()).toMatchObject({ location: null });
  });
});
