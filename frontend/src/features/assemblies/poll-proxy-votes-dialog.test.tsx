/**
 * Dialogo de gestao de votos por unidade (US-005 / ADR-003 / ADR-005 / ADR-007).
 *
 * IT-373 e IT-374 atravessam o percurso real (lista → Deliberacoes → Gestao);
 * os demais casos montam o dialogo direto, porque o alvo e o proprio componente
 * e o percurso so agrega custo de portal do Radix.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import { AssembliesPage } from './assemblies-page';
import { PollProxyVotesDialog } from './components/poll-proxy-votes-dialog';
import {
  makeAssembly,
  makeOpenPoll,
  makePoll,
  makePollResults,
  serveAssemblies,
  type AssemblyWorld,
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

const mockGet = vi.mocked(apiGet);
const mockPost = vi.mocked(apiPost);
const mockToastError = vi.mocked(toast.error);

let world: AssemblyWorld;

const TITLE = 'AGO 2026';
const POLL_TITLE = 'Aprovação das contas de 2025';

const PENDING = { unitId: 'unit-1', unitNumber: '101', status: 'PENDING' as const };
const VOTED = { unitId: 'unit-2', unitNumber: '102', status: 'VOTED' as const };
const NOT_ELIGIBLE = { unitId: 'unit-3', unitNumber: '103', status: 'NOT_ELIGIBLE' as const };

/** O dialogo mais recente — o painel de deliberacoes abre a gestao sobre si. */
function topDialog(): HTMLElement {
  const dialogs = screen.getAllByRole('dialog');
  return dialogs[dialogs.length - 1];
}

/** Monta o dialogo de gestao direto, sem a lista de assembleias. */
function renderProxy(poll = makeOpenPoll(), onClose = vi.fn()) {
  return renderWithProviders(<PollProxyVotesDialog poll={poll} onClose={onClose} />);
}

/** Caminho real ate a gestao de uma deliberacao aberta. */
async function openManagementFromPage(): Promise<{ panel: HTMLElement; management: HTMLElement }> {
  clickTrigger(screen.getByRole('button', { name: `Deliberações de ${TITLE}` }));
  const panel = await screen.findByRole('dialog');
  await within(panel).findByText(POLL_TITLE);
  clickTrigger(within(panel).getByRole('button', { name: `Gestão ${POLL_TITLE}` }));

  const management = await waitFor(() => {
    expect(screen.getByText('Gestão de votos')).toBeInTheDocument();
    return topDialog();
  });
  return { panel, management };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Gestão — lista de status e registro', () => {
  it('IT-373: a gestao lista unidades por status sem expor a alternativa escolhida', async () => {
    world = serveAssemblies({
      assemblies: [makeAssembly()],
      polls: [makeOpenPoll()],
      voteStatus: [PENDING, VOTED, NOT_ELIGIBLE],
    });
    renderWithProviders(<AssembliesPage />);

    await screen.findByText(TITLE);
    const { management } = await openManagementFromPage();

    expect(mockGet).toHaveBeenCalledWith('/polls/poll-1/vote-status');
    expect(await within(management).findByText('101')).toBeInTheDocument();
    expect(within(management).getByText('Pendente')).toBeInTheDocument();
    expect(within(management).getByText('102')).toBeInTheDocument();
    expect(within(management).getByText('Já votou')).toBeInTheDocument();
    expect(within(management).getByText('103')).toBeInTheDocument();
    expect(within(management).getByText('Não elegível')).toBeInTheDocument();

    // O payload de status e so unidade + status (ADR-005); a interface nao
    // fabrica `optionId` nem exibe a escolha de quem ja votou.
    expect(world.voteStatus.every((row) => !('optionId' in row))).toBe(true);
    const votedRow = within(management).getByText('102').closest('li');
    expect(votedRow).not.toBeNull();
    expect(within(votedRow as HTMLElement).queryByRole('radio')).not.toBeInTheDocument();
    expect(within(votedRow as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });

  it('IT-374: registrar voto de unidade pendente atualiza a linha e a apuracao', async () => {
    const user = createUser();
    world = serveAssemblies({
      assemblies: [makeAssembly()],
      polls: [makeOpenPoll()],
      voteStatus: [PENDING],
      results: makePollResults(),
    });
    renderWithProviders(<AssembliesPage />);

    await screen.findByText(TITLE);
    clickTrigger(screen.getByRole('button', { name: `Deliberações de ${TITLE}` }));
    const panel = await screen.findByRole('dialog');
    await within(panel).findByText(POLL_TITLE);

    // A apuracao abre antes da gestao: depois, o texto fica atras do dialogo
    // de topo, mas `getByText` ignora `aria-hidden`.
    clickTrigger(
      within(panel).getByRole('button', { name: `Ver apuração de ${POLL_TITLE}` }),
    );
    expect(await within(panel).findByText('30 de 48 unidades')).toBeInTheDocument();

    clickTrigger(within(panel).getByRole('button', { name: `Gestão ${POLL_TITLE}` }));
    const management = await waitFor(() => {
      expect(screen.getByText('Gestão de votos')).toBeInTheDocument();
      return topDialog();
    });
    // O skeleton some so quando o status chega; o radio so existe depois.
    await within(management).findByText('101');

    await user.click(within(management).getByLabelText('Aprovo da unidade 101'));
    await user.click(
      within(management).getByRole('button', { name: 'Registrar voto da unidade 101' }),
    );

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/polls/poll-1/votes', {
        unitId: 'unit-1',
        optionId: 'option-1',
      }),
    );
    expect(await within(management).findByText('Já votou')).toBeInTheDocument();
    expect(await screen.findByText('31 de 48 unidades')).toBeInTheDocument();
    expect(within(management).queryByRole('button', { name: 'Registrar voto da unidade 101' })).not.toBeInTheDocument();
  });

  it('IT-375: segundo envio para unidade ja votada mostra conflito e mantem a lista fiel', async () => {
    const user = createUser();
    world = serveAssemblies({ voteStatus: [PENDING] });
    mockPost.mockImplementationOnce(async () => makePollResults() as never);
    mockPost.mockImplementationOnce(async () => {
      // A mesma unidade muda de status; trocar o `unitId` sumiria a linha e
      // o alerta ficaria orfa sem dono no refetch.
      world.voteStatus = world.voteStatus.map((row) =>
        row.unitId === PENDING.unitId ? { ...row, status: 'VOTED' as const } : row,
      );
      throw new ApiError('Esta unidade ja possui voto registrado.', 409, 'CONFLICT');
    });
    renderProxy();

    await within(topDialog()).findByText('101');
    await user.click(screen.getByLabelText('Aprovo da unidade 101'));
    await user.click(screen.getByRole('button', { name: 'Registrar voto da unidade 101' }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));

    // O `onSuccess` limpa a escolha; a linha segue PENDING porque o primeiro
    // mock nao mexeu no mundo — e o segundo envio e o que o servidor recusa.
    await waitFor(() =>
      expect(screen.getByLabelText('Aprovo da unidade 101')).not.toBeChecked(),
    );
    await user.click(screen.getByLabelText('Aprovo da unidade 101'));
    await user.click(screen.getByRole('button', { name: 'Registrar voto da unidade 101' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta unidade ja possui voto registrado.',
    );
    expect(mockToastError).not.toHaveBeenCalled();
    expect(await screen.findByText('Já votou')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar voto da unidade 101' })).not.toBeInTheDocument();
  });

  it('IT-378: deliberacao nao-OPEN mostra a mensagem clara e nao oferece envio', async () => {
    world = serveAssemblies({ voteStatus: [PENDING] });
    renderProxy(makePoll());

    expect(
      await screen.findByText(
        'A votação não está aberta. O registro de voto por unidade fica disponível quando a votação abrir.',
      ),
    ).toBeInTheDocument();
    // A lista continua legivel (read-only no servidor para qualquer status).
    expect(await screen.findByText('101')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Registrar voto/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('IT-379: unidade NOT_ELIGIBLE nao oferece selecao nem envio', async () => {
    world = serveAssemblies({ voteStatus: [NOT_ELIGIBLE] });
    renderProxy();

    expect(await screen.findByText('103')).toBeInTheDocument();
    expect(screen.getByText('Não elegível')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Registrar voto/ })).not.toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('IT-381: sem alternativa escolhida o envio fica desabilitado', async () => {
    world = serveAssemblies({ voteStatus: [PENDING] });
    renderProxy();

    const submit = await screen.findByRole('button', {
      name: 'Registrar voto da unidade 101',
    });
    expect(submit).toBeDisabled();
    expect(mockPost).not.toBeCalled();

    const user = createUser();
    await user.click(screen.getByLabelText('Aprovo da unidade 101'));
    expect(submit).not.toBeDisabled();
    // So a selecao habilita; o POST so sai no clique.
    expect(mockPost).not.toBeCalled();
  });

  it('IT-382: dois envios sequenciais — o primeiro 200, o segundo 409 reconcilia a lista', async () => {
    const user = createUser();
    world = serveAssemblies({ voteStatus: [PENDING] });
    mockPost.mockImplementationOnce(async () => makePollResults() as never);
    mockPost.mockImplementationOnce(async () => {
      world.voteStatus = world.voteStatus.map((row) =>
        row.unitId === PENDING.unitId ? { ...row, status: 'VOTED' as const } : row,
      );
      throw new ApiError('Esta unidade ja possui voto registrado.', 409, 'CONFLICT');
    });
    renderProxy();

    await within(topDialog()).findByText('101');
    await user.click(screen.getByLabelText('Aprovo da unidade 101'));
    await user.click(screen.getByRole('button', { name: 'Registrar voto da unidade 101' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByLabelText('Aprovo da unidade 101')).not.toBeChecked(),
    );

    await user.click(screen.getByLabelText('Aprovo da unidade 101'));
    await user.click(screen.getByRole('button', { name: 'Registrar voto da unidade 101' }));

    expect(mockPost).toHaveBeenCalledTimes(2);
    const [url, body] = mockPost.mock.calls[1];
    expect(url).toBe('/polls/poll-1/votes');
    expect(body).toMatchObject({ unitId: 'unit-1', optionId: 'option-1' });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta unidade ja possui voto registrado.',
    );
    expect(mockToastError).not.toHaveBeenCalled();
    // O refetch do 409 reconcilia: a linha sai de Pendente para Ja votou.
    expect(await screen.findByText('Já votou')).toBeInTheDocument();
  });

  it('IT-383: o filtro de status reduz as linhas sem erro de consulta', async () => {
    const many = Array.from({ length: 14 }, (_, index) => ({
      unitId: `unit-${index + 1}`,
      unitNumber: String(101 + index),
      status: index < 9 ? ('PENDING' as const) : ('VOTED' as const),
    }));
    world = serveAssemblies({ voteStatus: many });
    renderProxy();

    const management = await screen.findByRole('dialog');
    await waitFor(() => expect(within(management).getAllByRole('listitem')).toHaveLength(14));

    selectOption(within(management).getByLabelText('Exibir'), 'Pendente');

    expect(within(management).getAllByRole('listitem')).toHaveLength(9);
    expect(within(management).queryByText('111')).not.toBeInTheDocument();
    expect(within(management).getByText('101')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // O filtro e so recorte de render — nenhuma leitura nova e disparada.
    expect(mockGet).toHaveBeenCalledTimes(1);

    selectOption(within(management).getByLabelText('Exibir'), 'Todas');
    expect(within(management).getAllByRole('listitem')).toHaveLength(14);
  });

  it('IT-384: unidade que ja votou no app mostra ja-votou sem a alternativa', async () => {
    world = serveAssemblies({ voteStatus: [VOTED] });
    renderProxy();

    expect(await screen.findByText('102')).toBeInTheDocument();
    expect(screen.getByText('Já votou')).toBeInTheDocument();
    expect(world.voteStatus[0]).not.toHaveProperty('optionId');
    // Nenhum controle de escolha para quem ja votou — a lista e status only.
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Registrar voto/ })).not.toBeInTheDocument();
    // O rotulo da alternativa so existe junto do mini-form pendente.
    expect(screen.queryByText('Aprovo')).not.toBeInTheDocument();
    expect(mockPost).not.toBeCalled();
  });
});
