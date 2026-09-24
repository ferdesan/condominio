import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { CondominiumProvider } from '@/providers/condominium-provider';
import { LoginPage } from '@/features/auth/login-page';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';
import { ResetPasswordPage } from '@/features/auth/reset-password-page';
import { NotFoundPage } from '@/features/misc/not-found-page';
import { PlaceholderPage } from '@/features/misc/placeholder-page';
import { NAV_ITEMS } from './navigation';
import { ProtectedRoute } from './protected-route';

/*
  Code splitting por rota (A9 do review): o bundle monolitico carregava as ~30
  paginas (incl. Recharts do financeiro) no boot. As tres publicas e o shell
  ficam eager — login e guardas precisam na primeira pintura; o resto entra no
  clique/navegacao.
*/
const DashboardPage = lazy(() =>
  import('@/features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })),
);
const CondominiumsPage = lazy(() =>
  import('@/features/condominiums/condominiums-page').then((m) => ({ default: m.CondominiumsPage })),
);
const CondominiumDetailPage = lazy(() =>
  import('@/features/condominiums/condominium-detail-page').then((m) => ({
    default: m.CondominiumDetailPage,
  })),
);
const UnitsPage = lazy(() =>
  import('@/features/units/units-page').then((m) => ({ default: m.UnitsPage })),
);
const ResidentsPage = lazy(() =>
  import('@/features/residents/residents-page').then((m) => ({ default: m.ResidentsPage })),
);
const ReservationsPage = lazy(() =>
  import('@/features/reservations/reservations-page').then((m) => ({
    default: m.ReservationsPage,
  })),
);
const BlocksPage = lazy(() =>
  import('@/features/blocks/blocks-page').then((m) => ({ default: m.BlocksPage })),
);
const DependentsPage = lazy(() =>
  import('@/features/dependents/dependents-page').then((m) => ({ default: m.DependentsPage })),
);
const EmployeesPage = lazy(() =>
  import('@/features/employees/employees-page').then((m) => ({ default: m.EmployeesPage })),
);
const ServiceProvidersPage = lazy(() =>
  import('@/features/service-providers/service-providers-page').then((m) => ({
    default: m.ServiceProvidersPage,
  })),
);
const VehiclesPage = lazy(() =>
  import('@/features/vehicles/vehicles-page').then((m) => ({ default: m.VehiclesPage })),
);
const CommonAreasPage = lazy(() =>
  import('@/features/common-areas/common-areas-page').then((m) => ({ default: m.CommonAreasPage })),
);
const VisitorsPage = lazy(() =>
  import('@/features/visitors/visitors-page').then((m) => ({ default: m.VisitorsPage })),
);
const CorrespondencesPage = lazy(() =>
  import('@/features/correspondences/correspondences-page').then((m) => ({
    default: m.CorrespondencesPage,
  })),
);
const AnnouncementsPage = lazy(() =>
  import('@/features/announcements/announcements-page').then((m) => ({
    default: m.AnnouncementsPage,
  })),
);
const IncidentsPage = lazy(() =>
  import('@/features/incidents/incidents-page').then((m) => ({ default: m.IncidentsPage })),
);
const MaintenancesPage = lazy(() =>
  import('@/features/maintenances/maintenances-page').then((m) => ({ default: m.MaintenancesPage })),
);
const UsersPage = lazy(() =>
  import('@/features/users/users-page').then((m) => ({ default: m.UsersPage })),
);
const AuditPage = lazy(() =>
  import('@/features/audit/audit-page').then((m) => ({ default: m.AuditPage })),
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/notifications-page').then((m) => ({
    default: m.NotificationsPage,
  })),
);
const FinancialPage = lazy(() =>
  import('@/features/financial/financial-page').then((m) => ({ default: m.FinancialPage })),
);
const BalancetePage = lazy(() =>
  import('@/features/financial/balancete-page').then((m) => ({ default: m.BalancetePage })),
);
const AssembliesPage = lazy(() =>
  import('@/features/assemblies/assemblies-page').then((m) => ({ default: m.AssembliesPage })),
);
const VotePage = lazy(() =>
  import('@/features/assemblies/vote-page').then((m) => ({ default: m.VotePage })),
);
const DocumentsPage = lazy(() =>
  import('@/features/documents/documents-page').then((m) => ({ default: m.DocumentsPage })),
);
const RolesPage = lazy(() =>
  import('@/features/roles/roles-page').then((m) => ({ default: m.RolesPage })),
);
const TenantPage = lazy(() =>
  import('@/features/tenant/tenant-page').then((m) => ({ default: m.TenantPage })),
);
const LgpdPage = lazy(() =>
  import('@/features/lgpd/lgpd-page').then((m) => ({ default: m.LgpdPage })),
);
const ProfilePage = lazy(() =>
  import('@/features/profile/profile-page').then((m) => ({ default: m.ProfilePage })),
);

/** Fallback enxuto enquanto o chunk da rota baixa. */
function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status">
      <span className="text-sm text-muted-foreground">Carregando…</span>
    </div>
  );
}

/** Itens do menu que ja possuem tela propria. */
const IMPLEMENTED = new Set([
  '/',
  '/condominios',
  '/blocos',
  '/unidades',
  '/moradores',
  '/dependentes',
  '/funcionarios',
  '/prestadores',
  '/veiculos',
  '/areas-comuns',
  '/reservas',
  '/visitantes',
  '/correspondencias',
  '/comunicados',
  '/ocorrencias',
  '/manutencoes',
  '/usuarios',
  '/auditoria',
  '/notificacoes',
  '/financeiro',
  '/assembleias',
  '/documentos',
  '/configuracoes',
  '/papeis',
  '/lgpd',
]);

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/*
          Publicas, como o login: quem precisa delas e justamente quem nao
          consegue entrar. Nenhuma das duas redireciona sessao existente — o link
          de redefinicao chega por e-mail e precisa funcionar independentemente do
          que este navegador tenha guardado. Fora da navegacao, tambem: nao
          pertencem ao menu de quem ja entrou.
        */}
        <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route
          element={
            // Fica dentro da area autenticada: a lista de condominios so faz
            // sentido — e so e autorizada — apos o login.
            <CondominiumProvider>
              <AppShell />
            </CondominiumProvider>
          }
        >
          <Route element={<ProtectedRoute permission="dashboard:read" />}>
            <Route index element={<DashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="condominium:read" />}>
            <Route path="/condominios" element={<CondominiumsPage />} />
            {/* Rota de detalhe so aqui: os outros modulos vivem em dialogo (ADR-004). */}
            <Route path="/condominios/:id" element={<CondominiumDetailPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="unit:read" />}>
            <Route path="/unidades" element={<UnitsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="resident:read" />}>
            <Route path="/moradores" element={<ResidentsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="reservation:read" />}>
            {/* Sem rota de detalhe: a reserva vive em dialogo sobre a lista (ADR-004). */}
            <Route path="/reservas" element={<ReservationsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="block:read" />}>
            {/* Segundo caminho para a gestao de blocos, que tambem vive dentro
                de Unidades para nao travar o cadastro (ADR-007). */}
            <Route path="/blocos" element={<BlocksPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="dependent:read" />}>
            <Route path="/dependentes" element={<DependentsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="employee:read" />}>
            <Route path="/funcionarios" element={<EmployeesPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="service-provider:read" />}>
            <Route path="/prestadores" element={<ServiceProvidersPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="vehicle:read" />}>
            <Route path="/veiculos" element={<VehiclesPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="common-area:read" />}>
            {/* Os parametros daqui governam as regras aplicadas em /reservas. */}
            <Route path="/areas-comuns" element={<CommonAreasPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="visitor:read" />}>
            <Route path="/visitantes" element={<VisitorsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="correspondence:read" />}>
            <Route path="/correspondencias" element={<CorrespondencesPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="announcement:read" />}>
            <Route path="/comunicados" element={<AnnouncementsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="incident:read" />}>
            <Route path="/ocorrencias" element={<IncidentsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="maintenance:read" />}>
            <Route path="/manutencoes" element={<MaintenancesPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="user:read" />}>
            {/* Por tenant, e nao por condominio: nao herda o seletor do shell. */}
            <Route path="/usuarios" element={<UsersPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="role:read" />}>
            {/* Tambem por tenant. A guarda e a de leitura; criar, editar e
                excluir sao conferidos por dentro, e o servidor recusa as três
                operacoes sobre um papel do sistema de qualquer forma. */}
            <Route path="/papeis" element={<RolesPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="audit-log:read" />}>
            {/* Tambem por tenant, e somente leitura: a trilha e append-only. */}
            <Route path="/auditoria" element={<AuditPage />} />
          </Route>

          {/*
            Financeiro reune três recursos sob uma rota — cobranças, despesas e
            plano de contas. A guarda e a do item de menu (`charge:read`); as
            outras duas seções checam as próprias permissões por dentro, porque
            um papel pode ler cobranças sem ler despesas.
          */}
          <Route element={<ProtectedRoute permission="charge:read" />}>
            <Route path="/financeiro" element={<FinancialPage />} />
          </Route>

          {/*
            O balancete de um mes tem rota propria, e guarda propria (ADR-001).
            Fica fora do bloco acima de proposito: herdar `charge:read` deixaria
            quem le cobrancas alcancar a prestacao de contas digitando o
            endereco, e as duas permissoes existem justamente para separar isso.

            Nao entra em `navigation.ts` nem em `IMPLEMENTED`: nao e item de
            menu — chega-se a ela pela seção em `/financeiro` ou por um link que
            alguem colou —, e `IMPLEMENTED` so serve para tirar do gerador de
            placeholders os caminhos do menu que ja tem tela. Segundo caso do
            genero, depois de `/perfil`, e como ela e exercitada por um caso
            proprio em `routes.test.tsx`, a comparação entre as rotas
            registradas e `NAV_ITEMS.length` continua significando o que
            significava.
          */}
          <Route element={<ProtectedRoute permission="financial-closing:read" />}>
            <Route path="/financeiro/balancete/:mes" element={<BalancetePage />} />
          </Route>

          <Route element={<ProtectedRoute permission="assembly:read" />}>
            {/* As votacoes vivem em dialogo sobre a assembleia (ADR-004). */}
            <Route path="/assembleias" element={<AssembliesPage />} />
          </Route>

          {/*
            A votacao do morador em rota propria (ADR-001). Segundo caso de
            rota de detalhe fora do menu, depois de `/perfil` e como o
            balancete: chega-se por notificacao ou pela acao Votar, nao por um
            item lateral — e `IMPLEMENTED` so serve para caminhos de menu.

            A guarda e `vote:read`, e nao `assembly:read`: quem le assembleias
            sem voto nao alcance a tela digitando o endereco, e `vote:read` e a
            mesma permissao que o backend exige de `GET /my-vote`.
          */}
          <Route element={<ProtectedRoute permission="vote:read" />}>
            <Route path="/votacoes/:pollId" element={<VotePage />} />
          </Route>

          <Route element={<ProtectedRoute permission="document:read" />}>
            <Route path="/documentos" element={<DocumentsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="tenant:read" />}>
            {/* Por tenant, como /usuarios e /auditoria. A guarda e a de leitura
                porque o SINDICO so a tem; a edição e conferida por dentro, com
                `tenant:update`, e o servidor recusa os campos comerciais de
                qualquer forma. */}
            <Route path="/configuracoes" element={<TenantPage />} />
          </Route>

          {/*
            LGPD agrupa três recursos sob uma rota — pedidos, exportação e
            consentimento. A guarda e a do item de menu (`lgpd:read`); cada aba
            checa as próprias permissões por dentro, porque o morador tem so
            `lgpd-request:create` e a consulta de consentimento so faz sentido
            para quem tem morador vinculado.
          */}
          <Route element={<ProtectedRoute permission="lgpd:read" />}>
            <Route path="/lgpd" element={<LgpdPage />} />
          </Route>

          {/*
            Única rota sem guarda de permissao, e de proposito: o item de
            navegação não declara nenhuma porque o servidor também não exige uma
            que distinga papéis — os cinco papéis do sistema tem
            `notification:read`. Inventar uma aqui esconderia a tela de quem a
            API atenderia. Continua dentro do `ProtectedRoute` de sessao acima,
            entao ela exige login como todas as outras.
          */}
          <Route path="/notificacoes" element={<NotificationsPage />} />

          {NAV_ITEMS.filter((item) => !IMPLEMENTED.has(item.to)).map((item) => (
            <Route key={item.to} element={<ProtectedRoute permission={item.permission} />}>
              <Route path={item.to} element={<PlaceholderPage title={item.label} />} />
            </Route>
          ))}

          {/*
            Fora da navegação e sem guarda de permissao: chega-se pelo menu do
            usuario na topbar, e as quatro rotas de `/auth` que a tela usa sao
            protegidas so por `authenticate` — o alvo vem do token, entao uma
            pessoa sempre pode editar a própria conta. Continua dentro do
            `ProtectedRoute` de sessao acima, como todas as outras.
          */}
          <Route path="/perfil" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
