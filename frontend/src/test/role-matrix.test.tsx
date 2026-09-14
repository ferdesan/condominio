/**
 * A matriz de papeis conferida nas quatro telas de uma vez.
 *
 * Cada tela ja tem os proprios testes de permissao, mas cada um deles olha para
 * uma tela so. O que nao se enxerga de dentro de nenhuma e a matriz inteira: se
 * o porteiro, que o `_prd.md` descreve como leitura nas quatro colecoes mais
 * `reservation:update`, vai encontrar em alguma delas um botao que o servidor
 * recusaria. E justamente entre telas que esse tipo de defeito mora.
 *
 * O harness da tarefa 1 recebe papel e condominio por montagem, entao a matriz e
 * percorrida sem quatro arranjos diferentes.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import {
  makeCommonArea,
  makeCondominium,
  makeReservation,
  makeResident,
  makeUnit,
} from '@/test/fixtures';
import { renderWithProviders, screen } from '@/test/render';
import { serveAll } from '@/test/api-double';
import { CondominiumsPage } from '@/features/condominiums/condominiums-page';
import { UnitsPage } from '@/features/units/units-page';
import { ResidentsPage } from '@/features/residents/residents-page';
import { ReservationsPage } from '@/features/reservations/reservations-page';

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

const CONDOMINIUM = makeCondominium({ id: 'cond-1', name: 'Residencial Aurora' });

/** Um registro vivo e um removido em cada colecao: restaurar so aparece no removido. */
const WORLD = {
  condominiums: [
    CONDOMINIUM,
    makeCondominium({ id: 'cond-9', name: 'Residencial Antigo', deletedAt: '2026-02-01T10:00:00.000Z' }),
  ],
  blocks: [],
  units: [
    makeUnit({ id: 'unit-1', number: '101' }),
    makeUnit({ id: 'unit-9', number: '909', deletedAt: '2026-02-01T10:00:00.000Z' }),
  ],
  residents: [
    makeResident({ id: 'resident-1', name: 'Carlos Pereira' }),
    makeResident({ id: 'resident-9', name: 'Joana Antiga', deletedAt: '2026-02-01T10:00:00.000Z' }),
  ],
  // Nome proprio: 'Salao de Festas' aparece tambem nos indicadores e no filtro,
  // entao o solicitante e o unico texto que so existe na linha da tabela.
  reservations: [
    makeReservation({ id: 'reservation-1', status: 'PENDING', requestedByName: 'Marina Solicitante' }),
  ],
  commonAreas: [makeCommonArea({ id: 'area-1', name: 'Salao de Festas' })],
};

/** As quatro telas, com o texto que prova que a leitura chegou ate o fim. */
const SCREENS = [
  { name: 'Condominios', element: <CondominiumsPage />, readMarker: 'Residencial Aurora' },
  { name: 'Unidades', element: <UnitsPage />, readMarker: '101' },
  { name: 'Moradores', element: <ResidentsPage />, readMarker: 'Carlos Pereira' },
  { name: 'Reservas', element: <ReservationsPage />, readMarker: 'Marina Solicitante' },
] as const;

/**
 * Toda acao de escrita das quatro telas, pelo nome acessivel. Uma acao nova que
 * escape do rotulo previsto aqui passa despercebida, entao os padroes sao
 * deliberadamente largos — qualquer "Editar ...", nao apenas os conhecidos.
 */
const WRITE_ACTIONS = [
  /^Nov[ao] /,
  /^Cadastrar /,
  /^Criar /,
  /^Gerar unidades/,
  /^Editar/,
  /^Excluir/,
  /^Restaurar/,
  /^Aprovar/,
  /^Recusar/,
  /^Tornar .* responsavel/,
];

function writeActionsOnScreen(): string[] {
  return screen
    .queryAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '')
    .map((label) => label.trim())
    .filter((label) => WRITE_ACTIONS.some((pattern) => pattern.test(label)));
}

beforeEach(() => {
  vi.clearAllMocks();
  serveAll(WORLD);
});

describe('Visibilidade por papel', () => {
  it('IT-177: as quatro telas como porteiro nao oferecem criar, editar, excluir nem restaurar', async () => {
    for (const { name, element, readMarker } of SCREENS) {
      const view = renderWithProviders(element, {
        role: 'STAFF',
        condominium: CONDOMINIUM,
      });

      // A leitura precisa chegar ate o fim: ausencia de acoes numa tela que nao
      // carregou nada nao prova coisa alguma.
      expect(await screen.findByText(readMarker), name).toBeInTheDocument();

      const offered = writeActionsOnScreen();
      const forbidden = offered.filter((label) => !/^Cancelar reserva/.test(label));
      expect(forbidden, `${name} ofereceu acoes de escrita a um porteiro`).toEqual([]);

      // Nenhuma escrita saiu do cliente em nenhum momento.
      expect(vi.mocked(apiPost)).not.toHaveBeenCalled();
      expect(vi.mocked(apiPatch)).not.toHaveBeenCalled();
      expect(vi.mocked(apiDelete)).not.toHaveBeenCalled();

      view.unmount();
    }
  });

  it('IT-177: o porteiro cancela uma reserva mas nao a decide', async () => {
    // A celula mais estreita da matriz: `reservation:update` sem
    // `reservation:manage` da cancelar e nao da aprovar nem recusar (ADR-002).
    renderWithProviders(<ReservationsPage />, { role: 'STAFF', condominium: CONDOMINIUM });

    expect(await screen.findByText('Marina Solicitante')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Cancelar reserva/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Aprovar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Recusar/ })).not.toBeInTheDocument();
  });

  it('IT-177: o sindico decide, e um papel sem leitura nem chega a tela', async () => {
    // A outra ponta da matriz, para que a ausencia acima signifique alguma coisa.
    const view = renderWithProviders(<ReservationsPage />, {
      role: 'SINDICO',
      condominium: CONDOMINIUM,
    });
    expect(await screen.findByText('Marina Solicitante')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Aprovar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Recusar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova reserva' })).toBeInTheDocument();
    view.unmount();

    // Sem `reservation:read` a rota nega antes de a tela montar (US-026.AC-1),
    // que e o guarda de rota, e nao a tela — por isso a asercao e sobre ele.
    const { ProtectedRoute } = await import('@/routes/protected-route');
    renderWithProviders(<ProtectedRoute permission="reservation:read" />, {
      permissions: ['condominium:read'],
    });
    expect(screen.getByText('Acesso negado')).toBeInTheDocument();
  });

  it('IT-180: remontar com menos permissoes rende a interface reduzida', async () => {
    // As permissoes mudaram entre dois carregamentos — a interface precisa
    // seguir as atuais, e nao as que ja estavam na tela (US-026.EC-3).
    const full = renderWithProviders(<CondominiumsPage />, {
      permissions: ['condominium:manage'],
    });
    expect(await screen.findByText('Residencial Aurora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo condominio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Residencial Aurora' })).toBeInTheDocument();
    full.unmount();

    renderWithProviders(<CondominiumsPage />, { permissions: ['condominium:read'] });
    expect(await screen.findByText('Residencial Aurora')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo condominio' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Editar Residencial Aurora' }),
    ).not.toBeInTheDocument();
    // Restaurar segue `update`, e nao `delete` (ADR-006): perder um tira o outro.
    expect(
      screen.queryByRole('button', { name: 'Restaurar Residencial Antigo' }),
    ).not.toBeInTheDocument();
    // O caminho de leitura continua inteiro.
    expect(screen.getByRole('link', { name: 'Ver Residencial Aurora' })).toBeInTheDocument();
    expect(vi.mocked(apiGet)).not.toHaveBeenCalledWith('/condominiums', expect.anything());
  });

  it('IT-180: restaurar acompanha `update`, nao `delete`', async () => {
    // O lugar classico de errar a guarda (ADR-006), conferido nos dois sentidos.
    const canUpdate = renderWithProviders(<CondominiumsPage />, {
      permissions: ['condominium:read', 'condominium:update'],
    });
    expect(
      await screen.findByRole('button', { name: 'Restaurar Residencial Antigo' }),
    ).toBeInTheDocument();
    canUpdate.unmount();

    renderWithProviders(<CondominiumsPage />, {
      permissions: ['condominium:read', 'condominium:delete'],
    });
    expect(await screen.findByText('Residencial Antigo')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Restaurar Residencial Antigo' }),
    ).not.toBeInTheDocument();
  });
});
