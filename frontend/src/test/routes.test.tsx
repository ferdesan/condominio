/**
 * O registro das rotas, conferido pelo roteador inteiro.
 *
 * Cada tela ja tem os proprios testes, e nenhum deles monta o roteador: eles
 * renderizam o componente direto. O que nao se enxerga de dentro de nenhum e se
 * o caminho do menu chega mesmo naquela tela — registrar uma rota e sempre duas
 * coisas, declarar a rota real e acrescentar o caminho ao conjunto
 * `IMPLEMENTED`, e esquecer a segunda deixa o item levando ao `PlaceholderPage`
 * sem nenhum teste de tela perceber.
 *
 * Por isso o alvo e `<AppRouter />` montado no caminho, e nao a pagina.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiGetPaginated } from '@/lib/api';
import { AppRouter } from '@/routes/app-router';
import { NAV_ITEMS } from '@/routes/navigation';
import { ThemeProvider } from '@/providers/theme-provider';
import { makeCondominium, makeMeta } from '@/test/fixtures';
import { makeTenant } from '@/features/tenant/test-utils';
import { CATALOG } from '@/features/roles/test-utils';
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
vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

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
  '/assemblies/upcoming': [],
  '/financial/charges/summary': {
    billed: 0,
    received: 0,
    open: 0,
    overdue: 0,
    overdueCount: 0,
    pendingCount: 0,
    delinquencyRate: 0,
  },
  '/financial/charges/delinquency': [],
  '/dashboard/overview': ZERO_OVERVIEW,
  '/dashboard/financial-series': [],
  '/dashboard/expenses-by-category': [],
  '/dashboard/incidents-by-category': [],
  // O mural da tela de comunicados: array cru, sem envelope de paginacao.
  '/announcements/board': [],
  '/dashboard/recent-activity': [],
  '/auth/sessions': [],
  // A fixture nao mora em `test/fixtures.ts`: aquele arquivo so conhece
  // `types/api.ts`, fechado para contratos novos.
  '/tenants/me': makeTenant(),
  '/roles/permissions': { permissions: CATALOG },
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

/**
 * Todos os itens do menu, com a tela e a permissao de cada rota.
 *
 * A lista e escrita a mao de proposito: derivar de `NAV_ITEMS` faria o teste
 * concordar com o roteador por construcao, e e justamente a divergencia entre os
 * dois que ele existe para pegar. O que se compara com `NAV_ITEMS` e so a
 * **contagem**, para que um item novo nao passe despercebido.
 */
const REGISTERED = [
  { path: '/', title: 'Dashboard', permission: 'dashboard:read' },
  { path: '/condominios', title: 'Condomínios', permission: 'condominium:read' },
  { path: '/blocos', title: 'Blocos', permission: 'block:read' },
  { path: '/unidades', title: 'Unidades', permission: 'unit:read' },
  { path: '/moradores', title: 'Moradores', permission: 'resident:read' },
  { path: '/dependentes', title: 'Dependentes', permission: 'dependent:read' },
  { path: '/funcionarios', title: 'Funcionários', permission: 'employee:read' },
  { path: '/prestadores', title: 'Prestadores', permission: 'service-provider:read' },
  { path: '/visitantes', title: 'Visitantes', permission: 'visitor:read' },
  { path: '/veiculos', title: 'Veículos', permission: 'vehicle:read' },
  { path: '/correspondencias', title: 'Correspondências', permission: 'correspondence:read' },
  { path: '/areas-comuns', title: 'Áreas comuns', permission: 'common-area:read' },
  { path: '/reservas', title: 'Reservas', permission: 'reservation:read' },
  { path: '/assembleias', title: 'Assembleias', permission: 'assembly:read' },
  { path: '/comunicados', title: 'Comunicados', permission: 'announcement:read' },
  { path: '/financeiro', title: 'Financeiro', permission: 'charge:read' },
  { path: '/ocorrencias', title: 'Ocorrências', permission: 'incident:read' },
  { path: '/manutencoes', title: 'Manutenções', permission: 'maintenance:read' },
  { path: '/documentos', title: 'Documentos', permission: 'document:read' },
  { path: '/usuarios', title: 'Usuários', permission: 'user:read' },
  { path: '/auditoria', title: 'Auditoria', permission: 'audit-log:read' },
  { path: '/papeis', title: 'Papéis', permission: 'role:read' },
  { path: '/configuracoes', title: 'Configurações', permission: 'tenant:read' },
  { path: '/lgpd', title: 'LGPD', permission: 'lgpd:read' },
  // Unico item sem permissao declarada em `navigation.ts`.
  { path: '/notificacoes', title: 'Notificações', permission: null },
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

describe('Cobertura do menu', () => {
  it('todo item de navegacao tem uma rota real declarada neste teste', () => {
    // Se alguem acrescentar um item ao menu sem tela, a contagem diverge e o
    // caso abaixo — que percorre a lista — nao chegaria a exercita-lo.
    expect(REGISTERED).toHaveLength(NAV_ITEMS.length);

    const covered = new Set<string>(REGISTERED.map((route) => route.path));
    const missing = NAV_ITEMS.filter((item) => !covered.has(item.to)).map((item) => item.to);
    expect(missing).toEqual([]);
  });

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

  it('as rotas com permissao negam acesso a um papel que nao a tem', async () => {
    for (const { path, title, permission } of REGISTERED) {
      if (!permission) continue;
      // O painel e a unica que o papel de teste alcanca; para ela, o caso e o
      // inverso e ja esta coberto acima.
      if (permission === 'dashboard:read') continue;

      const view = renderRoute(path, { permissions: ['dashboard:read'] });

      expect(await screen.findByText('Acesso negado'), path).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { level: 1, name: title }),
        path,
      ).not.toBeInTheDocument();

      view.unmount();
    }
  });

  it('notificacoes e alcancavel por qualquer papel autenticado', async () => {
    // Sem nenhuma permissao: o predicado do frontend trata permissao ausente
    // como liberada, e o servidor tambem nao exige uma que distinga papeis.
    renderRoute('/notificacoes', { permissions: [] });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Notificações' }),
    ).toBeInTheDocument();
  });

  it('notificacoes e negada a quem nao esta autenticado', async () => {
    renderRoute('/notificacoes', { user: null });

    // Sem sessao a rota leva ao login: a ausencia de permissao declarada nao
    // dispensa a guarda de autenticacao que envolve toda a area logada.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Condominio SaaS' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Notificações' }),
    ).not.toBeInTheDocument();
  });

  it('a navegacao lateral mostra todos os itens para o administrador', async () => {
    renderRoute('/');

    const menu = await screen.findByRole('navigation');
    for (const item of NAV_ITEMS) {
      const link = within(menu).getByRole('link', { name: item.label });
      expect(link, item.label).toHaveAttribute('href', item.to);
    }
  });
});

describe('As rotas publicas de recuperacao de senha', () => {
  it('sao alcancaveis sem sessao', async () => {
    renderRoute('/esqueci-senha', { user: null });

    expect(await screen.findByRole('heading', { name: 'Esqueci minha senha' })).toBeInTheDocument();
  });

  it('a de redefinicao explica o link incompleto quando nao ha token', async () => {
    renderRoute('/redefinir-senha', { user: null });

    expect(await screen.findByRole('heading', { name: 'Link incompleto' })).toBeInTheDocument();
  });

  it('continuam alcancaveis com sessao', async () => {
    // Nao redirecionam de proposito: o link de redefinicao chega por e-mail e
    // precisa funcionar independentemente do que este navegador guardou.
    renderRoute('/esqueci-senha');

    expect(await screen.findByRole('heading', { name: 'Esqueci minha senha' })).toBeInTheDocument();
  });

  it('nao aparecem na navegacao lateral', async () => {
    renderRoute('/');

    const menu = await screen.findByRole('navigation');
    for (const item of NAV_ITEMS) {
      expect(item.to).not.toBe('/esqueci-senha');
      expect(item.to).not.toBe('/redefinir-senha');
    }
    expect(
      within(menu).queryByRole('link', { name: 'Esqueci minha senha' }),
    ).not.toBeInTheDocument();
  });

  it('o login leva a de pedido', async () => {
    renderRoute('/login', { user: null });

    const link = await screen.findByRole('link', { name: 'Esqueci minha senha' });
    expect(link).toHaveAttribute('href', '/esqueci-senha');
  });
});

describe('O mecanismo de placeholder', () => {
  it('nenhum item do menu leva mais ao placeholder', async () => {
    // Com todas as telas do menu registradas, o gerador de rotas de placeholder
    // nao produz nenhuma. Ele continua no roteador de proposito: um item de menu novo
    // ganha uma rota que explica a ausencia em vez de um 404.
    for (const item of NAV_ITEMS) {
      const view = renderRoute(item.to);
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByText(PLACEHOLDER_MARKER), item.to).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it('nao resta nenhuma rota servida pelo placeholder', async () => {
    // `/perfil` era a ultima, e ganhou tela propria. O componente continua no
    // roteador de proposito: um item de menu novo ganha uma rota que explica a
    // ausencia em vez de um 404.
    renderRoute('/perfil');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Meu perfil' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(PLACEHOLDER_MARKER)).not.toBeInTheDocument();
  });

  it('perfil fica fora da navegacao e nao exige permissao alguma', async () => {
    // Nem no menu — a lateral organiza o produto por modulo de negocio, e a
    // conta de quem esta olhando nao e um deles — nem sob `authorize`: as quatro
    // rotas de `/auth` que a tela usa derivam o alvo do token.
    renderRoute('/perfil', { permissions: [] });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Meu perfil' }),
    ).toBeInTheDocument();

    const menu = screen.getByRole('navigation');
    expect(within(menu).queryByRole('link', { name: 'Meu perfil' })).not.toBeInTheDocument();
  });

  it('perfil e negado a quem nao esta autenticado', async () => {
    renderRoute('/perfil', { user: null });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Condominio SaaS' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Meu perfil' })).not.toBeInTheDocument();
  });
});
