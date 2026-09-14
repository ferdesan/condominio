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
import { NotFoundPage } from '@/features/misc/not-found-page';
import { PlaceholderPage } from '@/features/misc/placeholder-page';
import { NAV_ITEMS } from './navigation';
import { ProtectedRoute } from './protected-route';

/**
 * Itens do menu que ja possuem tela propria.
 *
 * `/blocos` nao entra: a gestao de blocos vive dentro da tela de unidades e a
 * entrada reservada continua levando ao placeholder (ADR-007).
 */
const IMPLEMENTED = new Set(['/', '/condominios', '/unidades', '/moradores', '/reservas']);

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
