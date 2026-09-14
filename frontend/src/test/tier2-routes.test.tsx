/**
 * O registro das rotas, conferido pelo roteador inteiro.
 *
 * Cada tela ja tem os proprios testes, e nenhum deles monta o roteador: eles
 * renderizam o componente direto. O que nao se enxerga de dentro de nenhum e se
 * o caminho do menu chega mesmo naquela tela — registrar uma rota aqui e sempre
 * duas coisas, declarar a rota real e acrescentar o caminho ao conjunto
 * `IMPLEMENTED`, e esquecer a segunda deixa o item levando ao
 * `PlaceholderPage` sem nenhum teste de tela perceber.
 *
 * Por isso o alvo e `<AppRouter />` montado no caminho, e nao a pagina.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiGetPaginated } from '@/lib/api';
import { AppRouter } from '@/routes/app-router';
import { ThemeProvider } from '@/providers/theme-provider';
import { makeCondominium, makeMeta } from '@/test/fixtures';
import { renderWithProviders, screen, within } from '@/test/render';
import type { DashboardOverview } from '@/types/api';

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

/** Montar o roteador inteiro custa mais do que montar uma tela. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const CONDOMINIUM = makeCondominium({ id: 'cond-1', name: 'Residencial Aurora' });

const ZERO_OVERVIEW: DashboardOverview = {
  condominium: { id: CONDOMINIUM.id, name: CONDOMINIUM.name },
  referenceMonth: '2026-03',
  units: { total: 0, occupied: 0, vacant: 0, occupancyRate: 0 },
  people: { residents: 0, employees: 0, visitorsInside: 0 },
  finance: {
    billed: 0,
    received: 0,
    open: 0,
    overdue: 0,
    delinquencyRate: 0,
    expenses: 0,
    expensesPaid: 0,
    balance: 0,
  },
  operations: {
    openIncidents: 0,
    pendingReservations: 0,
    pendingCorrespondences: 0,
    upcomingMaintenances: 0,
    upcomingAssemblies: 0,
  },
};

/** As leituras auxiliares de cada tela, todas zeradas. */
const AUXILIARY_READS: Record<string, unknown> = {
  '/visitors/inside-count': { inside: 0 },
  '/correspondences/pending-count': { pending: 0 },
  '/incidents/summary': [],
  '/maintenances/upcoming': [],
  '/notifications/unread-count': { unread: 0 },
  '/reservations/availability': [],
  '/dashboard/overview': ZERO_OVERVIEW,
  '/dashboard/financial-series': [],
  '/dashboard/expenses-by-category': [],
  '/dashboard/recent-activity': [],
};

/**
 * Um mundo vazio, com um unico condominio para o shell selecionar.
 *
 * O conteudo das listas nao importa aqui: o que se afirma e qual tela o caminho
 * alcancou, e o cabecalho dela existe com ou sem linhas. Uma leitura nao
 * prevista falha com 422 — que o `retry` do QueryProvider nao repete —, entao a
 * tela mostra o proprio estado de erro em vez de travar o caso.
 */
function serveEmptyWorld(): void {
  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    const data = url === '/condominiums' ? [CONDOMINIUM] : [];
    return {
      data,
      meta: makeMeta({
        total: data.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });

  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (url in AUXILIARY_READS) return AUXILIARY_READS[url] as never;
    if (url.endsWith('/stats')) return {} as never;
    throw new ApiError(`URL nao prevista no teste: ${url}`, 422, 'UNPROCESSABLE_ENTITY');
  });
}

/** As oito telas registradas por esta task, com a permissao de cada rota. */
const REGISTERED = [
  { path: '/visitantes', title: 'Visitantes', permission: 'visitor:read' },
  { path: '/correspondencias', title: 'Correspondencias', permission: 'correspondence:read' },
  { path: '/comunicados', title: 'Comunicados', permission: 'announcement:read' },
  { path: '/ocorrencias', title: 'Ocorrencias', permission: 'incident:read' },
  { path: '/manutencoes', title: 'Manutencoes', permission: 'maintenance:read' },
  { path: '/usuarios', title: 'Usuarios', permission: 'user:read' },
  { path: '/auditoria', title: 'Auditoria', permission: 'audit-log:read' },
  // Unico item sem permissao declarada em `navigation.ts`.
  { path: '/notificacoes', title: 'Notificacoes', permission: null },
] as const;

/** As onze rotas que ja existiam, para provar que o registro nao as mexeu. */
const ALREADY_REGISTERED = [
  { path: '/', title: 'Dashboard' },
  { path: '/condominios', title: 'Condominios' },
  { path: '/blocos', title: 'Blocos' },
  { path: '/unidades', title: 'Unidades' },
  { path: '/moradores', title: 'Moradores' },
  { path: '/dependentes', title: 'Dependentes' },
  { path: '/funcionarios', title: 'Funcionarios' },
  { path: '/prestadores', title: 'Prestadores' },
  { path: '/veiculos', title: 'Veiculos' },
  { path: '/areas-comuns', title: 'Areas comuns' },
  { path: '/reservas', title: 'Reservas' },
] as const;

/** Os tres modulos que seguem sem tela, e por isso continuam no placeholder. */
const STILL_PLACEHOLDER = [
  { path: '/financeiro', label: 'Financeiro' },
  { path: '/assembleias', label: 'Assembleias' },
  { path: '/documentos', label: 'Documentos' },
] as const;

const PLACEHOLDER_MARKER = 'Modulo em construcao';


/**
 * Monta o roteador inteiro no caminho pedido.
 *
 * O `ThemeProvider` entra aqui, e nao no harness compartilhado, porque so quem
 * monta o shell precisa dele: a topbar e a tela de login leem o tema, e as telas
 * isoladas — que e o que todos os outros arquivos montam — nao. Em producao ele
 * vem de `App.tsx`, acima do roteador, exatamente nesta posicao.
 */
function renderRoute(
  route: string,
  options: Parameters<typeof renderWithProviders>[1] = {},
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>,
    { route, condominium: CONDOMINIUM, ...options },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  serveEmptyWorld();
});

describe('As oito rotas registradas', () => {
  it('cada caminho renderiza a tela real, e nao o placeholder', async () => {
    for (const { path, title } of REGISTERED) {
      const view = renderRoute(path);

      // O titulo da pagina e um `h1`; o item de menu com o mesmo texto e um
      // link, entao o papel desambigua sem depender da ordem no documento.
      expect(
        await screen.findByRole('heading', { level: 1, name: title }),
        path,
      ).toBeInTheDocument();
      expect(screen.queryByText(PLACEHOLDER_MARKER), path).not.toBeInTheDocument();

      view.unmount();
    }
  });

  it('as sete com permissao negam acesso a um papel que nao a tem', async () => {
    for (const { path, title, permission } of REGISTERED) {
      if (!permission) continue;

      // Um papel autenticado que so enxerga o painel: tem sessao, e nao tem
      // nenhuma das sete permissoes.
      const view = renderRoute(path, { permissions: ['dashboard:read'] });

      expect(await screen.findByText('Acesso negado'), path).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 1, name: title }), path).not.toBeInTheDocument();

      view.unmount();
    }
  });

  it('notificacoes e alcancavel por qualquer papel autenticado', async () => {
    // Sem nenhuma permissao: o predicado do frontend trata permissao ausente
    // como liberada, e o servidor tambem nao exige uma que distinga papeis.
    renderRoute('/notificacoes', { permissions: [] });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Notificacoes' }),
    ).toBeInTheDocument();
  });

  it('notificacoes e negada a quem nao esta autenticado', async () => {
    renderRoute('/notificacoes', { user: null });

    // Sem sessao a rota leva ao login: a ausencia de permissao declarada nao
    // dispensa a guarda de autenticacao que envolve toda a area logada.
    expect(await screen.findByRole('heading', { level: 1, name: 'Condominio SaaS' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Notificacoes' })).not.toBeInTheDocument();
  });

  it('a navegacao lateral mostra os oito itens para o administrador', async () => {
    renderRoute('/');

    const menu = await screen.findByRole('navigation');
    for (const { path, title } of REGISTERED) {
      const link = within(menu).getByRole('link', { name: title });
      expect(link, title).toHaveAttribute('href', path);
    }
  });
});

describe('O que nao mudou', () => {
  it('os tres modulos sem tela continuam levando ao placeholder', async () => {
    for (const { path, label } of STILL_PLACEHOLDER) {
      const view = renderRoute(path);

      expect(await screen.findByText(PLACEHOLDER_MARKER), path).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: label }), path).toBeInTheDocument();

      view.unmount();
    }
  });

  it('as onze rotas ja existentes seguem chegando nas mesmas telas', async () => {
    for (const { path, title } of ALREADY_REGISTERED) {
      const view = renderRoute(path);

      expect(
        await screen.findByRole('heading', { level: 1, name: title }),
        path,
      ).toBeInTheDocument();
      expect(screen.queryByText(PLACEHOLDER_MARKER), path).not.toBeInTheDocument();

      view.unmount();
    }
  });
});
