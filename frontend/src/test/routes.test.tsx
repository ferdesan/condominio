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
import { makeStatement } from '@/features/financial/test-utils';
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

/** A competencia da rota de balancete, usada na URL e nas leituras servidas. */
const STATEMENT_MONTH = '2026-08';

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

  /*
    As duas leituras de `/financeiro/balancete/:mes`, e as primeiras entradas
    desta lista desde que o balancete foi construido.

    **A mudanca e deliberada, e nao uma regressao.** A task_04 de
    `balancete-mensal` garantiu que esta lista nao cresceria, e o IT-315 provou a
    garantia: `/financeiro` nao le o balancete ao montar, porque a secao so faz a
    requisicao quando alguem a escolhe. Isso continua valendo palavra por
    palavra. A rota de detalhe e outra superficie — ela **existe para** ler o
    balancete na montagem —, entao sem estas duas chaves o `apiGet` do mundo
    vazio responderia o 422 de URL nao prevista e o caso da rota mediria o estado
    de erro da tela em vez da tela.

    Sao duas porque a tela faz duas leituras independentes: o resumo e os
    lancamentos. A competencia e a mesma constante que o caso usa na URL, para
    que uma nao possa mudar sem a outra.
  */
  [`/financial/closings/${STATEMENT_MONTH}`]: makeStatement({
    condominiumId: CONDOMINIUM.id,
    referenceMonth: STATEMENT_MONTH,
  }),
  [`/financial/closings/${STATEMENT_MONTH}/entries`]: { entries: [], frozen: false },
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

const PLACEHOLDER_MARKER = 'Modulo em construção';

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
  it('todo item de navegação tem uma rota real declarada neste teste', () => {
    // Se alguem acrescentar um item ao menu sem tela, a contagem diverge e o
    // caso abaixo — que percorre a lista — nao chegaria a exercita-lo.
    expect(REGISTERED).toHaveLength(NAV_ITEMS.length);

    const covered = new Set<string>(REGISTERED.map((route) => route.path));
    const missing = NAV_ITEMS.filter((item) => !covered.has(item.to)).map((item) => item.to);
    expect(missing).toEqual([]);
  });

  it('cada caminho renderiza a tela real, e não o placeholder', async () => {
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

  it('as rotas com permissao negam acesso a um papel que não a tem', async () => {
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

  it('notificações e alcancável por qualquer papel autenticado', async () => {
    // Sem nenhuma permissao: o predicado do frontend trata permissao ausente
    // como liberada, e o servidor tambem nao exige uma que distinga papeis.
    renderRoute('/notificacoes', { permissions: [] });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Notificações' }),
    ).toBeInTheDocument();
  });

  it('notificações e negada a quem não esta autenticado', async () => {
    renderRoute('/notificacoes', { user: null });

    // Sem sessao a rota leva ao login: a ausencia de permissao declarada nao
    // dispensa a guarda de autenticacao que envolve toda a area logada.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Condomínio SaaS' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Notificações' }),
    ).not.toBeInTheDocument();
  });

  it('a navegação lateral mostra todos os itens para o administrador', async () => {
    renderRoute('/');

    const menu = within(
      await screen.findByRole('complementary', { name: 'Navegação principal' }),
    ).getByRole('navigation');
    for (const item of NAV_ITEMS) {
      const link = within(menu).getByRole('link', { name: item.label });
      expect(link, item.label).toHaveAttribute('href', item.to);
    }
  });
});

describe('As rotas publicas de recuperação de senha', () => {
  it('sao alcancáveis sem sessão', async () => {
    renderRoute('/esqueci-senha', { user: null });

    expect(await screen.findByRole('heading', { name: 'Esqueci minha senha' })).toBeInTheDocument();
  });

  it('a de redefinição explica o link incompleto quando não ha token', async () => {
    renderRoute('/redefinir-senha', { user: null });

    expect(await screen.findByRole('heading', { name: 'Link incompleto' })).toBeInTheDocument();
  });

  it('continuam alcancáveis com sessão', async () => {
    // Nao redirecionam de proposito: o link de redefinicao chega por e-mail e
    // precisa funcionar independentemente do que este navegador guardou.
    renderRoute('/esqueci-senha');

    expect(await screen.findByRole('heading', { name: 'Esqueci minha senha' })).toBeInTheDocument();
  });

  it('não aparecem na navegação lateral', async () => {
    renderRoute('/');

    const menu = within(
      await screen.findByRole('complementary', { name: 'Navegação principal' }),
    ).getByRole('navigation');
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

  it('não resta nenhuma rota servida pelo placeholder', async () => {
    // `/perfil` era a ultima, e ganhou tela propria. O componente continua no
    // roteador de proposito: um item de menu novo ganha uma rota que explica a
    // ausencia em vez de um 404.
    renderRoute('/perfil');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Meu perfil' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(PLACEHOLDER_MARKER)).not.toBeInTheDocument();
  });

  it('perfil fica fora da navegação e não exige permissao alguma', async () => {
    // Nem no menu — a lateral organiza o produto por modulo de negocio, e a
    // conta de quem esta olhando nao e um deles — nem sob `authorize`: as quatro
    // rotas de `/auth` que a tela usa derivam o alvo do token.
    renderRoute('/perfil', { permissions: [] });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Meu perfil' }),
    ).toBeInTheDocument();

    const menu = within(
      screen.getByRole('complementary', { name: 'Navegação principal' }),
    ).getByRole('navigation');
    expect(within(menu).queryByRole('link', { name: 'Meu perfil' })).not.toBeInTheDocument();
  });

  it('perfil e negado a quem não esta autenticado', async () => {
    renderRoute('/perfil', { user: null });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Condomínio SaaS' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Meu perfil' })).not.toBeInTheDocument();
  });
});

/**
 * A segunda rota do sistema alcancável so por link, depois de `/perfil`.
 *
 * Fica fora de `REGISTERED` pelo mesmo motivo que aquela: nao e item de menu, e
 * `REGISTERED` existe para casar com `NAV_ITEMS`. Por isso e exercitada aqui,
 * num caso proprio, sem mexer na contagem que o primeiro caso deste arquivo
 * compara.
 */
describe('A rota do balancete', () => {
  const ROUTE = `/financeiro/balancete/${STATEMENT_MONTH}`;

  it('IT-346: e alcancável pelo endereço e não aparece na navegação lateral', async () => {
    renderRoute(ROUTE);

    // O resumo, e nao o `h1`: o esqueleto da tela carrega o mesmo titulo, entao
    // so a regiao com os dados prova que as duas leituras foram servidas — que e
    // justamente o que as entradas novas de `AUXILIARY_READS` garantem.
    expect(
      await screen.findByRole('region', { name: 'Resumo da competência' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /^Balancete de / })).toBeInTheDocument();
    expect(screen.queryByText(PLACEHOLDER_MARKER)).not.toBeInTheDocument();

    // Nem no menu: o documento se alcanca pela seção em `/financeiro` ou por um
    // link colado, e um item para uma tela aberta uma vez por mês foi recusado
    // junto com a decisao de dar rota a ela.
    const menu = within(
      screen.getByRole('complementary', { name: 'Navegação principal' }),
    ).getByRole('navigation');
    expect(within(menu).queryByRole('link', { name: /Balancete/ })).not.toBeInTheDocument();
    for (const item of NAV_ITEMS) {
      expect(item.to).not.toBe(ROUTE);
    }
  });

  it('IT-342: quem le cobranças sem ler a prestação de contas rende acesso negado', async () => {
    // `charge:read` de proposito, e nao uma lista vazia: e a permissao que
    // guarda `/financeiro`, e o caso so prova alguma coisa se quem a tem for
    // barrado aqui. Herdar aquela guarda deixaria o documento alcancável
    // digitando o endereço.
    renderRoute(ROUTE, { permissions: ['charge:read'] });

    expect(await screen.findByText('Acesso negado')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: /^Balancete de / }),
    ).not.toBeInTheDocument();
  });
});
