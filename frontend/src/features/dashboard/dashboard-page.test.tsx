import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '@/lib/api';
import { renderWithProviders, screen } from '@/test/render';
import { ThemeProvider } from '@/providers/theme-provider';
import { DashboardPage } from './dashboard-page';

// O duble fica so na camada de transporte (ADR-010); `ApiError` continua real.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiGet: vi.fn() };
});

const mockGet = vi.mocked(apiGet);

const ACTIVITY = [
  {
    id: 'audit-1',
    action: 'CREATE',
    resource: 'reservation',
    resourceId: 'reservation-1',
    description: 'Reserva do salao de festas',
    userName: 'Carla Souza',
    createdAt: '2026-09-20T10:00:00.000Z',
  },
];

function renderDashboard(permissions: string[]): void {
  renderWithProviders(
    <ThemeProvider>
      <DashboardPage />
    </ThemeProvider>,
    { permissions },
  );
}

function activityRequests(): number {
  return mockGet.mock.calls.filter(([url]) => url === '/dashboard/recent-activity').length;
}

beforeEach(() => {
  vi.clearAllMocks();
  // O painel so precisa de respostas vazias; o que se observa aqui e o card.
  mockGet.mockImplementation(async (url) => {
    if (url === '/dashboard/recent-activity') return ACTIVITY as never;
    if (url === '/dashboard/overview') return undefined as never;
    return [] as never;
  });
});

describe('Card "Atividade recente" do painel', () => {
  it('aparece para quem tem dashboard-activity:read', async () => {
    renderDashboard(['dashboard:read', 'dashboard-activity:read']);

    expect(await screen.findByText('Atividade recente')).toBeInTheDocument();
    expect(await screen.findByText('Reserva do salao de festas')).toBeInTheDocument();
    expect(activityRequests()).toBe(1);
  });

  it('fica oculto, sem consultar o servidor, para quem so le o painel', async () => {
    renderDashboard(['dashboard:read']);

    // Espera o painel montar antes de afirmar a ausencia do card.
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByText('Atividade recente')).not.toBeInTheDocument();
    // Sem o gate a consulta sairia para um 403 e o toast global de permissao.
    expect(activityRequests()).toBe(0);
  });
});
