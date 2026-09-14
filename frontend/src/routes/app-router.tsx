import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { CondominiumProvider } from '@/providers/condominium-provider';
import { LoginPage } from '@/features/auth/login-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { CondominiumsPage } from '@/features/condominiums/condominiums-page';
import { CondominiumDetailPage } from '@/features/condominiums/condominium-detail-page';
import { UnitsPage } from '@/features/units/units-page';
import { ResidentsPage } from '@/features/residents/residents-page';
import { ReservationsPage } from '@/features/reservations/reservations-page';
import { BlocksPage } from '@/features/blocks/blocks-page';
import { DependentsPage } from '@/features/dependents/dependents-page';
import { EmployeesPage } from '@/features/employees/employees-page';
import { ServiceProvidersPage } from '@/features/service-providers/service-providers-page';
import { VehiclesPage } from '@/features/vehicles/vehicles-page';
import { CommonAreasPage } from '@/features/common-areas/common-areas-page';
import { NotFoundPage } from '@/features/misc/not-found-page';
import { PlaceholderPage } from '@/features/misc/placeholder-page';
import { NAV_ITEMS } from './navigation';
import { ProtectedRoute } from './protected-route';

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
]);

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

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

          {NAV_ITEMS.filter((item) => !IMPLEMENTED.has(item.to)).map((item) => (
            <Route key={item.to} element={<ProtectedRoute permission={item.permission} />}>
              <Route path={item.to} element={<PlaceholderPage title={item.label} />} />
            </Route>
          ))}

          <Route path="/perfil" element={<PlaceholderPage title="Meu perfil" />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
